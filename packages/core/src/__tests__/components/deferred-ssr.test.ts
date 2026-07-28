import { describe, expect, it, vi } from 'vitest';
import { Deferred, useDeferredState } from '../../components/Deferred.js';

describe('Deferred SSR behavior', () => {
	it('uses runtime-neutral timers when rendered without window', () => {
		vi.useFakeTimers();
		try {
			const node = Deferred({
				timeout: 10,
				fallback: 'Loading',
				children: 'Ready',
			});
			if (node._tag !== 'List') throw new Error('Expected a List node');

			expect(node.children).toEqual(['Loading']);
			vi.advanceTimersByTime(10);
			expect(node.children).toEqual(['Ready']);
			useDeferredState(node).cancel();
		} finally {
			vi.useRealTimers();
		}
	});
});
