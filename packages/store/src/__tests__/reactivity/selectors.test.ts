import { describe, it, expect, vi } from 'vitest';
import { createStore } from '../../core/store.js';
import {
	shallowEqual,
	createSelector,
	createSelectorAsync,
	pick,
	combineSelectors,
} from '../../reactivity/selectors.js';

describe('reactivity / selectors', () => {
	describe('shallowEqual', () => {
		it('should return true for same reference', () => {
			const obj = { a: 1 };
			expect(shallowEqual(obj, obj)).toBe(true);
		});

		it('should compare primitives', () => {
			expect(shallowEqual(1, 1)).toBe(true);
			expect(shallowEqual(1, 2)).toBe(false);
			expect(shallowEqual('a', 'a')).toBe(true);
			expect(shallowEqual(null, null)).toBe(true);
			expect(shallowEqual(undefined, null)).toBe(false);
		});

		it('should compare arrays', () => {
			expect(shallowEqual([1, 2], [1, 2])).toBe(true);
			expect(shallowEqual([1, 2], [1, 3])).toBe(false);
			expect(shallowEqual([1, 2], [1, 2, 3])).toBe(false);
		});

		it('should compare objects', () => {
			expect(shallowEqual({ a: 1 }, { a: 1 })).toBe(true);
			expect(shallowEqual({ a: 1 }, { a: 2 })).toBe(false);
			expect(shallowEqual({ a: 1 }, { a: 1, b: 2 })).toBe(false);
		});
	});

	describe('createSelector', () => {
		it('should select a value', () => {
			const store = createStore('sel1', { count: 5 });
			const selected = createSelector(store, (state) => state.count);
			expect(selected.value).toBe(5);
			selected.cleanup();
		});

		it('should update when store changes', () => {
			const store = createStore('sel2', { count: 1 });
			const selected = createSelector(store, (state) => state.count);
			// @ts-expect-error testing proxy assignment
			store.count = 10;
			expect(selected.value).toBe(10);
			selected.cleanup();
		});

		it('should use custom equality function', () => {
			const store = createStore('sel3', { items: [1, 2] });
			const equalityFn = vi.fn((a: number[], b: number[]) =>
				a.length === b.length
			);
			const selected = createSelector(
				store,
				(state) => state.items,
				equalityFn
			);
			// @ts-expect-error testing proxy assignment
			store.items = [1, 2];
			expect(equalityFn).toHaveBeenCalled();
			selected.cleanup();
		});
	});

	describe('createSelectorAsync', () => {
		it('should set initial value and track pending', () => {
			const store = createStore('selAsync1', { count: 3 });
			const selected = createSelectorAsync(
				store,
				(state) => state.count * 2,
				0
			);
			expect(selected.value).toBe(0);
			expect(selected.pending.value).toBe(true);
			selected.cleanup();
		});

		it('should resolve async selector', async () => {
			const store = createStore('selAsync2', { count: 4 });
			const selected = createSelectorAsync(
				store,
				(state) => state.count * 2,
				0
			);
			await new Promise((r) => setTimeout(r, 10));
			expect(selected.value).toBe(8);
			expect(selected.pending.value).toBe(false);
			selected.cleanup();
		});
	});

	describe('pick', () => {
		it('should pick selected keys', () => {
			const store = createStore('pick1', { a: 1, b: 2, c: 3 });
			const picked = pick(store, ['a', 'c']);
			expect(picked.value).toEqual({ a: 1, c: 3 });
		});
	});

	describe('combineSelectors', () => {
		it('should combine multiple selectors', () => {
			const store = createStore('combine1', { a: 1, b: 2 });
			const combined = combineSelectors(store, {
				sum: (state) => state.a + state.b,
				product: (state) => state.a * state.b,
			});
			expect(combined.value).toEqual({ sum: 3, product: 2 });
		});
	});
});
