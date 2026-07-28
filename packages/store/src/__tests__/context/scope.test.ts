import { describe, it, expect } from 'vitest';
import {
	createScope,
	disposeScope,
	enterScope,
	exitScope,
	getCurrentScope,
	getRootScope,
	registerScopedStore,
	getScopedStore,
	hasScopedStore,
	runInScope,
	withScope,
} from '../../context/scope.js';
import { createStore } from '../../core/store.js';

describe('context / scope', () => {
	it('should create child scopes', () => {
		const child = createScope();
		expect(child.id).toMatch(/^scope_/);
		expect(child.parent).toBe(getCurrentScope());
	});

	it('should dispose scopes', () => {
		const scope = createScope();
		const store = createStore('scopeStore1', { count: 0 });
		registerScopedStore('scoped1', store, scope);
		expect(hasScopedStore('scoped1', scope)).toBe(true);
		disposeScope(scope);
		expect(hasScopedStore('scoped1', scope)).toBe(false);
	});

	it('should enter and exit scopes', () => {
		const scope = createScope();
		const before = getCurrentScope();
		enterScope(scope);
		expect(getCurrentScope()).toBe(scope);
		exitScope();
		expect(getCurrentScope()).toBe(before);
	});

	it('should get root scope', () => {
		expect(getRootScope().id).toBe('__root__');
	});

	it('should find stores in parent scopes', () => {
		const parent = createScope();
		const child = createScope(parent);
		const store = createStore('parentStore', { value: 1 });
		registerScopedStore('shared', store, parent);
		expect(getScopedStore('shared', child)).toBe(store);
	});

	it('should return null for missing stores', () => {
		const scope = createScope();
		expect(getScopedStore('missing', scope)).toBeNull();
	});

	it('should run in scope', () => {
		const scope = createScope();
		const result = runInScope(scope, () => getCurrentScope());
		expect(result).toBe(scope);
	});

	it('should preserve scope across async boundaries', async () => {
		const scope = createScope();
		const store = createStore('asyncScopeStore', { value: 'request' });

		await runInScope(scope, async () => {
			registerScopedStore('async-store', store);
			await Promise.resolve();
			expect(getCurrentScope()).toBe(scope);
			expect(getScopedStore('async-store')).toBe(store);
		});

		expect(getCurrentScope()).toBe(getRootScope());
	});

	it('should isolate concurrent async scopes', async () => {
		const firstScope = createScope();
		const secondScope = createScope();
		let releaseFirst: (() => void) | undefined;
		const firstPaused = new Promise<void>((resolve) => {
			releaseFirst = resolve;
		});

		const first = runInScope(firstScope, async () => {
			await firstPaused;
			return getCurrentScope();
		});
		const second = runInScope(secondScope, async () => {
			await Promise.resolve();
			releaseFirst?.();
			return getCurrentScope();
		});

		expect(await Promise.all([first, second])).toEqual([
			firstScope,
			secondScope,
		]);
	});

	it('should restore an outer async scope after a nested scope settles', async () => {
		const outerScope = createScope();
		const innerScope = createScope(outerScope);

		await runInScope(outerScope, async () => {
			expect(getCurrentScope()).toBe(outerScope);
			await runInScope(innerScope, async () => {
				await Promise.resolve();
				expect(getCurrentScope()).toBe(innerScope);
			});
			expect(getCurrentScope()).toBe(outerScope);
		});

		expect(getCurrentScope()).toBe(getRootScope());
	});

	it('should restore scope after runInScope throws', () => {
		const before = getCurrentScope();
		const scope = createScope();
		expect(() => {
			runInScope(scope, () => {
				throw new Error('boom');
			});
		}).toThrow('boom');
		expect(getCurrentScope()).toBe(before);
	});

	it('should support withScope', () => {
		const result = withScope((scope) => {
			expect(getCurrentScope()).toBe(scope);
			return 42;
		});
		expect(result).toBe(42);
	});

	it('should keep withScope stores alive until async work settles', async () => {
		let ownedScope: ReturnType<typeof createScope> | undefined;
		const result = withScope(async (scope) => {
			ownedScope = scope;
			const store = createStore('transientAsyncStore', { value: 42 });
			registerScopedStore('transient', store);
			await Promise.resolve();
			expect(getCurrentScope()).toBe(scope);
			expect(getScopedStore('transient')).toBe(store);
			expect(scope.stores.size).toBe(1);
			return store.getSnapshot().value;
		});

		expect(await result).toBe(42);
		expect(ownedScope?.stores.size).toBe(0);
	});

	it('should dispose withScope even if fn throws', () => {
		expect(() => {
			withScope(() => {
				throw new Error('boom');
			});
		}).toThrow('boom');
	});

	it('should dispose withScope after an async rejection', async () => {
		let ownedScope: ReturnType<typeof createScope> | undefined;
		const result = withScope(async (scope) => {
			ownedScope = scope;
			registerScopedStore(
				'rejected',
				createStore('rejectedAsyncStore', { value: 1 })
			);
			await Promise.resolve();
			throw new Error('async boom');
		});

		await expect(result).rejects.toThrow('async boom');
		expect(ownedScope?.stores.size).toBe(0);
	});
});
