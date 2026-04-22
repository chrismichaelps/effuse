import { describe, it, expect } from 'vitest';
import { For } from '../../components/For.js';
import { signal } from '../../reactivity/signal.js';
import { isSignal } from '../../reactivity/index.js';
import { EFFUSE_NODE } from '../../constants.js';

describe('For.Dynamic', () => {
	it('should give each item its own index signal with the correct value', () => {
		const items = signal(['a', 'b', 'c']);
		const capturedIndices: number[] = [];

		const node = For.Dynamic(items, (item, indexSignal) => {
			capturedIndices.push(indexSignal.value);
			return {
				[EFFUSE_NODE]: true,
				_tag: 'Text',
				text: `${item}:${indexSignal.value}`,
			} as any;
		});

		// Trigger children getter
		const children = (node as any).children;

		expect(children).toHaveLength(3);
		expect(capturedIndices).toEqual([0, 1, 2]);
	});

	it('should update index signals when the list changes', () => {
		const items = signal(['x', 'y']);
		const indexSignals: any[] = [];

		const node = For.Dynamic(items, (item, indexSignal) => {
			indexSignals.push(indexSignal);
			return {
				[EFFUSE_NODE]: true,
				_tag: 'Text',
				text: item,
			} as any;
		});

		// First access
		void (node as any).children;
		expect(indexSignals).toHaveLength(2);
		expect(indexSignals[0].value).toBe(0);
		expect(indexSignals[1].value).toBe(1);

		// Add an item
		items.value = ['x', 'y', 'z'];
		indexSignals.length = 0;
		void (node as any).children;
		expect(indexSignals).toHaveLength(3);
		expect(indexSignals[0].value).toBe(0);
		expect(indexSignals[1].value).toBe(1);
		expect(indexSignals[2].value).toBe(2);
	});
});
