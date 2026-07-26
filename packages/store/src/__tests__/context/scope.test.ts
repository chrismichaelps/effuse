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

	it('should dispose withScope even if fn throws', () => {
		expect(() => {
			withScope(() => {
				throw new Error('boom');
			});
		}).toThrow('boom');
	});
});
