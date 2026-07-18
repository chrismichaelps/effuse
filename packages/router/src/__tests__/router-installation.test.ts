import { afterEach, describe, expect, it } from 'vitest';
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
});
