import { describe, it, expect } from 'vitest';
import { createAtomicState } from '../../core/state.js';

describe('core / state', () => {
	describe('createAtomicState', () => {
		it('should get initial value', () => {
			const state = createAtomicState({ count: 0 });
			expect(state.get()).toEqual({ count: 0 });
		});

		it('should set value', () => {
			const state = createAtomicState({ count: 0 });
			state.set({ count: 5 });
			expect(state.get()).toEqual({ count: 5 });
		});

		it('should update value via function', () => {
			const state = createAtomicState({ count: 0 });
			state.update((s) => ({ ...s, count: s.count + 1 }));
			expect(state.get()).toEqual({ count: 1 });
		});

		it('should maintain immutability', () => {
			const initial = { items: [1, 2, 3] };
			const state = createAtomicState(initial);
			state.set({ items: [4, 5] });
			expect(initial.items).toEqual([1, 2, 3]);
		});
	});
});
