import { describe, it, expect } from 'vitest';
import { createStore } from '../../core/store.js';
import {
	composeStores,
	defineSlice,
	mergeStores,
} from '../../composition/compose.js';

describe('composition', () => {
	describe('composeStores', () => {
		it('should compose stores with computed', () => {
			const main = createStore('composeMain', { count: 2 });
			const dep = createStore('composeDep', { multiplier: 3 });
			const composed = composeStores(main, [dep]);

			const result = composed.computed((state, deps) => {
				return state.count * ((deps[0] as Record<string, unknown>).multiplier as number);
			});

			expect(result.value).toBe(6);
		});

		it('should update computed when dependencies change', () => {
			const main = createStore('composeMain2', { count: 2 });
			const dep = createStore('composeDep2', { multiplier: 3 });
			const composed = composeStores(main, [dep]);

			const result = composed.computed((state, deps) => {
				return state.count * ((deps[0] as Record<string, unknown>).multiplier as number);
			});

			// @ts-expect-error testing proxy assignment
			main.count = 5;
			expect(result.value).toBe(15);
		});
	});

	describe('defineSlice', () => {
		it('should create a slice from parent', () => {
			const parent = createStore('sliceParent', { base: 10 });
			const slice = defineSlice('slice1', (p) => ({
				derived: (p as unknown as Record<string, { value: number }>).base.value * 2,
			}));
			const child = slice.create(parent);
			expect((child as unknown as Record<string, { value: number }>).derived.value).toBe(20);
		});
	});

	describe('mergeStores', () => {
		it('should merge two stores', () => {
			const storeA = createStore('mergeA', { a: 1 });
			const storeB = createStore('mergeB', { b: 2 });
			const merged = mergeStores(storeA, storeB);

			expect(merged.getSnapshot()).toEqual({ a: 1, b: 2 });
		});

		it('should notify on either store change', () => {
			const storeA = createStore('mergeA2', { a: 1 });
			const storeB = createStore('mergeB2', { b: 2 });
			const merged = mergeStores(storeA, storeB);

			let calls = 0;
			const unsub = merged.subscribe(() => calls++);

			// @ts-expect-error testing proxy assignment
			storeA.a = 10;
			expect(calls).toBe(1);

			// @ts-expect-error testing proxy assignment
			storeB.b = 20;
			expect(calls).toBe(2);

			unsub();
		});
	});
});
