import { afterEach, describe, expect, it } from 'vitest';
import {
	clearGlobalRouter,
	clearGlobalStoreGetter,
	createScriptContext,
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
		expect(() => context.router).toThrow(RouterNotConfiguredError);
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
