import { afterEach, describe, expect, it, vi } from 'vitest';
import {
	clearGlobalRouter as clearCoreRouter,
	define,
	type ScriptContext,
} from '@effuse/core';
import { clearContext, injectRouter } from '../core/context.js';
import {
	createRouter,
	getGlobalRouter,
	installRouter,
	runWithRouter,
} from '../core/router.js';
import { createMemoryHistory } from '../core/history.js';
import { useRoute, useRouter } from '../utils/composables.js';

const createTestRouter = (path: string) =>
	createRouter({
		history: createMemoryHistory(path),
		routes: [],
	});

const getScriptRouter = (): unknown => {
	let context: ScriptContext<Record<string, unknown>> | undefined;
	const Probe = define({
		script: (value) => {
			context = value;
			return {};
		},
		template: () => null,
	});
	(Probe.state as (props: Record<string, unknown>) => unknown)({});
	return context?.router;
};

afterEach(() => {
	clearContext();
	clearCoreRouter();
});

describe('router installation ownership', () => {
	it('restores nested router installations across all public contexts', () => {
		const first = installRouter(createTestRouter('/first'));
		let context: ScriptContext<Record<string, unknown>> | undefined;
		const Probe = define({
			script: (value) => {
				context = value;
				return {};
			},
			template: () => null,
		});
		(Probe.state as (props: Record<string, unknown>) => unknown)({});
		expect(getGlobalRouter()).toBe(first);
		expect(injectRouter()).toBe(first);
		expect(context?.router).toBe(first);

		const second = installRouter(createTestRouter('/second'));
		expect(getGlobalRouter()).toBe(second);
		expect(injectRouter()).toBe(second);
		expect(context?.router).toBe(second);

		second.cleanup();
		expect(getGlobalRouter()).toBe(first);
		expect(injectRouter()).toBe(first);
		expect(context?.router).toBe(first);

		first.cleanup();
		expect(getGlobalRouter()).toBeNull();
		expect(injectRouter()).toBeUndefined();
		expect(() => context?.router).toThrow(/Router not configured/);
	});

	it('can restart a router after cleanup', () => {
		const router = createTestRouter('/');
		installRouter(router).cleanup();
		const reinstalled = installRouter(router);

		expect(reinstalled.isReady).toBe(true);
		reinstalled.cleanup();
	});

	it('does not resurrect installations cleaned up out of order', () => {
		const first = installRouter(createTestRouter('/first'));
		const second = installRouter(createTestRouter('/second'));

		first.cleanup();
		expect(getGlobalRouter()).toBe(second);
		expect(injectRouter()).toBe(second);

		second.cleanup();
		expect(getGlobalRouter()).toBeNull();
		expect(injectRouter()).toBeUndefined();
	});

	it('isolates routers and routes across concurrent async contexts', async () => {
		const firstRouter = createTestRouter('/first');
		const secondRouter = createTestRouter('/second');
		let releaseFirst: (() => void) | undefined;
		const firstPaused = new Promise<void>((resolve) => {
			releaseFirst = resolve;
		});

		const first = runWithRouter(firstRouter, async () => {
			await firstPaused;
			return {
				router: useRouter(),
				scriptRouter: getScriptRouter(),
				path: useRoute().path,
			};
		});
		const second = runWithRouter(secondRouter, async () => {
			await Promise.resolve();
			releaseFirst?.();
			return {
				router: useRouter(),
				scriptRouter: getScriptRouter(),
				path: useRoute().path,
			};
		});

		expect(await Promise.all([first, second])).toEqual([
			{ router: firstRouter, scriptRouter: firstRouter, path: '/first' },
			{ router: secondRouter, scriptRouter: secondRouter, path: '/second' },
		]);
		expect(getGlobalRouter()).toBeNull();
		expect(injectRouter()).toBeUndefined();
	});

	it('restores the global application router after scoped async work', async () => {
		const application = installRouter(createTestRouter('/application'));
		const request = createTestRouter('/request');

		try {
			await runWithRouter(request, async () => {
				await Promise.resolve();
				expect(useRouter()).toBe(request);
				expect(useRoute().path).toBe('/request');
			});

			expect(useRouter()).toBe(application);
			expect(useRoute().path).toBe('/application');
		} finally {
			application.cleanup();
		}
	});

	it('keeps scoped route state current after async navigation', async () => {
		const Page = define({ template: () => null });
		const router = createRouter({
			history: createMemoryHistory('/'),
			routes: [
				{ path: '/', component: Page },
				{ path: '/about', name: 'about', component: Page },
			],
		});

		await runWithRouter(router, async () => {
			expect(useRoute().path).toBe('/');
			await router.push('/about');
			await Promise.resolve();
			expect(useRoute().path).toBe('/about');
			expect(useRoute().name).toBe('about');
		});
	});

	it('preserves installation state across module replacement', async () => {
		const firstModule = await import('../core/router.js');
		const first = firstModule.installRouter(createTestRouter('/hmr'));

		vi.resetModules();
		const replacementModule = await import('../core/router.js');
		const replacementContext = await import('../core/context.js');
		const replacementComposables = await import('../utils/composables.js');

		expect(replacementModule.getGlobalRouter()).toBe(first);
		expect(replacementContext.injectRouter()).toBe(first);
		expect(replacementComposables.useRoute().path).toBe('/hmr');

		first.cleanup();
		expect(replacementModule.getGlobalRouter()).toBeNull();
		expect(replacementContext.injectRouter()).toBeUndefined();
	});

	it('prevents stale module cleanup from clearing a replacement', async () => {
		const firstModule = await import('../core/router.js');
		const first = firstModule.installRouter(createTestRouter('/first'));

		vi.resetModules();
		const replacementModule = await import('../core/router.js');
		const replacementContext = await import('../core/context.js');
		const second = replacementModule.installRouter(createTestRouter('/second'));

		first.cleanup();
		expect(replacementModule.getGlobalRouter()).toBe(second);
		expect(replacementContext.injectRouter()).toBe(second);
		expect((await import('../utils/composables.js')).useRoute().path).toBe(
			'/second'
		);

		second.cleanup();
		expect(replacementModule.getGlobalRouter()).toBeNull();
		expect(replacementContext.injectRouter()).toBeUndefined();
	});

	it('rolls back a failed replacement without clearing the active router', () => {
		const first = installRouter(createTestRouter('/working'));
		let context: ScriptContext<Record<string, unknown>> | undefined;
		const Probe = define({
			script: (value) => {
				context = value;
				return {};
			},
			template: () => null,
		});
		(Probe.state as (props: Record<string, unknown>) => unknown)({});
		const failing = createTestRouter('/failing');
		Object.defineProperty(failing, 'start', {
			value: () => {
				throw new Error('replacement start failed');
			},
		});

		expect(() => installRouter(failing)).toThrow('replacement start failed');
		expect(getGlobalRouter()).toBe(first);
		expect(injectRouter()).toBe(first);
		expect(context?.router).toBe(first);

		first.cleanup();
	});
});
