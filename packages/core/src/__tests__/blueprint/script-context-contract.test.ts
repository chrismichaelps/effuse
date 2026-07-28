import { afterEach, describe, expect, it, vi } from 'vitest';
import {
	clearGlobalRouter,
	clearGlobalStoreGetter,
	createScriptContext,
	runWithRouterContext,
	setGlobalRouter,
	setGlobalStoreGetter,
} from '../../blueprint/script-context.js';
import {
	StoreGetterNotConfiguredError,
	StoreNotFoundError,
} from '../../errors.js';
import {
	LayerRuntimeNotInitializedError,
	RouterNotConfiguredError,
} from '../../layers/errors.js';

afterEach(() => {
	clearGlobalRouter();
	clearGlobalStoreGetter();
});

describe('ScriptContext dependency contracts', () => {
	it('resolves router lazily and restores scoped installations', () => {
		const { context } = createScriptContext({});
		expect(() => context.router).toThrow(RouterNotConfiguredError);

		const router = { push: () => undefined };
		const restore = setGlobalRouter(router);
		expect(context.router).toBe(router);
		restore();
		expect(() => context.router).toThrow(/Router not configured/);
	});

	it('preserves router installations across module replacement', async () => {
		const firstModule = await import('../../blueprint/script-context.js');
		const router = { push: () => undefined };
		const restore = firstModule.setGlobalRouter(router);

		vi.resetModules();
		const replacementModule = await import('../../blueprint/script-context.js');
		const { context } = replacementModule.createScriptContext({});

		expect(context.router).toBe(router);
		restore();
		expect(() => context.router).toThrow(/Router not configured/);
	});

	it('isolates routers across concurrent async contexts', async () => {
		const firstRouter = { name: 'first' };
		const secondRouter = { name: 'second' };
		let releaseFirst: (() => void) | undefined;
		const firstPaused = new Promise<void>((resolve) => {
			releaseFirst = resolve;
		});

		const first = runWithRouterContext(firstRouter, async () => {
			const { context } = createScriptContext({});
			await firstPaused;
			return context.router;
		});
		const second = runWithRouterContext(secondRouter, async () => {
			const { context } = createScriptContext({});
			await Promise.resolve();
			releaseFirst?.();
			return context.router;
		});

		expect(await Promise.all([first, second])).toEqual([
			firstRouter,
			secondRouter,
		]);
	});

	it('uses one strict store contract for store and useStore', () => {
		const { context } = createScriptContext({});
		expect(() => context.store('session')).toThrow(
			StoreGetterNotConfiguredError
		);
		expect(() => context.useStore('session')).toThrow(
			StoreGetterNotConfiguredError
		);

		const session = { user: 'Chris' };
		const restore = setGlobalStoreGetter((name) =>
			name === 'session' ? session : undefined
		);
		expect(context.store('session')).toBe(session);
		expect(context.useStore('session')).toBe(session);
		expect(() => context.store('missing')).toThrow(StoreNotFoundError);
		restore();
		expect(() => context.store('session')).toThrow(
			StoreGetterNotConfiguredError
		);
	});

	it('reports service access before layer runtime installation', () => {
		const { context } = createScriptContext({});
		expect(() => context.useService('api')).toThrow(
			LayerRuntimeNotInitializedError
		);
	});
});
