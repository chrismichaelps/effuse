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
} from '../core/router.js';
import { createMemoryHistory } from '../core/history.js';

const createTestRouter = (path: string) =>
	createRouter({
		history: createMemoryHistory(path),
		routes: [],
	});

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
