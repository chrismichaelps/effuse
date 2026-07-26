import { describe, it, expect, beforeEach } from 'vitest';
import { createStore } from '../../core/store.js';
import {
	deriveFrom,
	deriveFromAsync,
	serializeStores,
	hydrateStoresSync,
} from '../../reactivity/derived.js';
import { getStoreNames, clearStores } from '../../registry/index.js';

describe('reactivity / derived', () => {
	beforeEach(() => {
		clearStores();
	});

	describe('deriveFrom', () => {
		it('should derive from a single store', () => {
			const store = createStore('deriveSingle', { count: 2 });
			const doubled = deriveFrom([store], (snap) => snap.count * 2);
			expect(doubled.value).toBe(4);
		});

		it('should update when store changes', () => {
			const store = createStore('deriveUpdate', { count: 1 });
			const doubled = deriveFrom([store], (snap) => snap.count * 2);
			// @ts-expect-error testing proxy assignment
			store.count = 5;
			expect(doubled.value).toBe(10);
		});

		it('should derive from multiple stores', () => {
			const storeA = createStore('deriveA', { a: 1 });
			const storeB = createStore('deriveB', { b: 2 });
			const sum = deriveFrom(
				[storeA, storeB],
				(snapA, snapB) => snapA.a + snapB.b
			);
			expect(sum.value).toBe(3);
		});

		it('should clean up subscriptions', () => {
			const store = createStore('deriveCleanup', { count: 0 });
			const derived = deriveFrom([store], (snap) => snap.count);
			expect(derived.value).toBe(0);
			// @ts-expect-error testing proxy assignment
			store.count = 5;
			expect(derived.value).toBe(5);
			derived.cleanup();
			// After cleanup, changes should no longer propagate
			// @ts-expect-error testing proxy assignment
			store.count = 10;
			expect(derived.value).toBe(5);
		});
	});

	describe('deriveFromAsync', () => {
		it('should set initial value immediately', () => {
			const store = createStore('deriveAsyncInit', { count: 5 });
			const derived = deriveFromAsync(
				[store],
				(snaps) => snaps[0].count * 10,
				0
			);
			expect(derived.value).toBe(0);
			expect(derived.pending.value).toBe(true);
			derived.cleanup();
		});

		it('should resolve async value', async () => {
			const store = createStore('deriveAsyncResolve', { count: 3 });
			const derived = deriveFromAsync(
				[store],
				(snaps) => snaps[0].count * 10,
				0
			);
			await new Promise((r) => setTimeout(r, 10));
			expect(derived.value).toBe(30);
			expect(derived.pending.value).toBe(false);
			derived.cleanup();
		});
	});

	describe('serializeStores / hydrateStoresSync', () => {
		it('should round-trip store state', () => {
			const store = createStore('serializeTest', { count: 42, label: 'test' });
			const serialized = serializeStores();
			expect(serialized).toContain('serializeTest');

			// Reset store
			// @ts-expect-error testing proxy assignment
			store.count = 0;
			// @ts-expect-error testing proxy assignment
			store.label = '';

			hydrateStoresSync(serialized);
			expect(store.count.value).toBe(42);
			expect(store.label.value).toBe('test');
		});

		it('should handle empty registry', () => {
			expect(getStoreNames()).toEqual([]);
			expect(serializeStores()).toBe('{}');
		});
	});
});
