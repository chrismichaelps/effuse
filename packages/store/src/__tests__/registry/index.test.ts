import { describe, it, expect, beforeEach } from 'vitest';
import {
	registerStore,
	getStore,
	hasStore,
	removeStore,
	clearStores,
	getStoreNames,
} from '../../registry/index.js';
import { createStore } from '../../core/store.js';
import { StoreNotFoundError } from '../../errors.js';
import {
	createScope,
	disposeScope,
	runInScope,
	withScope,
} from '../../context/scope.js';

describe('registry', () => {
	beforeEach(() => {
		clearStores();
	});

	it('should register and get stores', () => {
		const store = createStore('reg1', { count: 0 });
		registerStore('reg1', store);
		expect(hasStore('reg1')).toBe(true);
		expect(getStore('reg1')).toBe(store);
	});

	it('should throw for missing stores', () => {
		expect(() => getStore('missing')).toThrow(StoreNotFoundError);
	});

	it('should remove stores', () => {
		const store = createStore('reg2', { count: 0 });
		registerStore('reg2', store);
		expect(removeStore('reg2')).toBe(true);
		expect(hasStore('reg2')).toBe(false);
	});

	it('should clear all stores', () => {
		registerStore('a', createStore('a', { x: 1 }));
		registerStore('b', createStore('b', { y: 2 }));
		clearStores();
		expect(getStoreNames()).toEqual([]);
	});

	it('should list store names', () => {
		registerStore('a', createStore('a', { x: 1 }));
		registerStore('b', createStore('b', { y: 2 }));
		const names = getStoreNames();
		expect(names).toContain('a');
		expect(names).toContain('b');
	});

	it('should prefer a request store and preserve the global fallback', async () => {
		const globalStore = createStore('session', { user: 'global' });
		const scope = createScope();

		try {
			await runInScope(scope, async () => {
				const requestStore = createStore('session', { user: 'request' });
				await Promise.resolve();
				expect(getStore('session')).toBe(requestStore);
				expect(getStoreNames()).toContain('session');
			});

			expect(getStore('session')).toBe(globalStore);
		} finally {
			disposeScope(scope);
		}
	});

	it('should resolve stores from a parent request scope', async () => {
		const parent = createScope();
		const child = createScope(parent);
		let parentStore: ReturnType<typeof createStore> | undefined;

		try {
			await runInScope(parent, async () => {
				parentStore = createStore('parent-session', { user: 'parent' });
				await runInScope(child, async () => {
					await Promise.resolve();
					expect(getStore('parent-session')).toBe(parentStore);
				});
			});
		} finally {
			disposeScope(child);
			disposeScope(parent);
		}
	});

	it('should isolate same-name stores across concurrent requests', async () => {
		const firstScope = createScope();
		const secondScope = createScope();
		let releaseFirst: (() => void) | undefined;
		const firstPaused = new Promise<void>((resolve) => {
			releaseFirst = resolve;
		});

		try {
			const first = runInScope(firstScope, async () => {
				const own = createStore('request-session', { user: 'first' });
				await firstPaused;
				return { own, resolved: getStore('request-session') };
			});
			const second = runInScope(secondScope, async () => {
				const own = createStore('request-session', { user: 'second' });
				await Promise.resolve();
				releaseFirst?.();
				return { own, resolved: getStore('request-session') };
			});

			const results = await Promise.all([first, second]);
			expect(results[0].resolved).toBe(results[0].own);
			expect(results[1].resolved).toBe(results[1].own);
		} finally {
			disposeScope(firstScope);
			disposeScope(secondScope);
		}
	});

	it('should remove transient stores when withScope settles', async () => {
		await withScope(async () => {
			createStore('transient-session', { user: 'request' });
			await Promise.resolve();
			expect(hasStore('transient-session')).toBe(true);
		});

		expect(hasStore('transient-session')).toBe(false);
		expect(() => getStore('transient-session')).toThrow(StoreNotFoundError);
	});

	it('should keep global stores when clearing a request scope', async () => {
		const globalStore = createStore('shared-session', { user: 'global' });

		await withScope(async () => {
			await Promise.resolve();
			const requestStore = createStore('shared-session', { user: 'request' });
			createStore('request-only', { active: true });
			expect(getStore('shared-session')).toBe(requestStore);

			expect(removeStore('shared-session')).toBe(true);
			expect(getStore('shared-session')).toBe(globalStore);

			clearStores();
			expect(hasStore('request-only')).toBe(false);
			expect(getStore('shared-session')).toBe(globalStore);
		});

		expect(getStore('shared-session')).toBe(globalStore);
	});
});
