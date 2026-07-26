import { describe, it, expect, vi } from 'vitest';
import { createStore } from '../../core/store.js';
import { createStoreStream, streamAll } from '../../reactivity/streams.js';

describe('reactivity / streams', () => {
	describe('createStoreStream', () => {
		it('should emit value changes', () => {
			const store = createStore('stream1', { count: 0 });
			const stream = createStoreStream(store, 'count');
			const values: number[] = [];
			const unsub = stream.subscribe((v) => values.push(v));

			// @ts-expect-error testing proxy assignment
			store.count = 1;
			// @ts-expect-error testing proxy assignment
			store.count = 2;

			expect(values).toEqual([1, 2]);
			unsub();
		});

		it('should not emit if value unchanged', () => {
			const store = createStore('stream2', { count: 0 });
			const stream = createStoreStream(store, 'count');
			const values: number[] = [];
			const unsub = stream.subscribe((v) => values.push(v));

			// @ts-expect-error testing proxy assignment
			store.count = 0;
			expect(values).toEqual([]);
			unsub();
		});

		it('should support map', () => {
			const store = createStore('streamMap', { count: 2 });
			const stream = createStoreStream(store, 'count');
			const mapped = stream.map((v) => v * 2);
			const values: number[] = [];
			const unsub = mapped.subscribe((v) => values.push(v));

			// @ts-expect-error testing proxy assignment
			store.count = 3;
			expect(values).toEqual([6]);
			unsub();
		});

		it('should support filter', () => {
			const store = createStore('streamFilter', { count: 0 });
			const stream = createStoreStream(store, 'count');
			const filtered = stream.filter((v) => v > 0);
			const values: number[] = [];
			const unsub = filtered.subscribe((v) => values.push(v));

			// @ts-expect-error testing proxy assignment
			store.count = -1;
			// @ts-expect-error testing proxy assignment
			store.count = 5;
			expect(values).toEqual([5]);
			unsub();
		});

		it('should support debounce', async () => {
			vi.useFakeTimers();
			const store = createStore('streamDebounce', { count: 0 });
			const stream = createStoreStream(store, 'count');
			const debounced = stream.debounce(100);
			const values: number[] = [];
			const unsub = debounced.subscribe((v) => values.push(v));

			// @ts-expect-error testing proxy assignment
			store.count = 1;
			// @ts-expect-error testing proxy assignment
			store.count = 2;
			// @ts-expect-error testing proxy assignment
			store.count = 3;

			await vi.advanceTimersByTimeAsync(100);
			expect(values).toEqual([3]);
			unsub();
			vi.useRealTimers();
		});

		it('should support throttle', async () => {
			vi.useFakeTimers();
			const store = createStore('streamThrottle', { count: 0 });
			const stream = createStoreStream(store, 'count');
			const throttled = stream.throttle(100);
			const values: number[] = [];
			const unsub = throttled.subscribe((v) => values.push(v));

			// @ts-expect-error testing proxy assignment
			store.count = 1;
			// @ts-expect-error testing proxy assignment
			store.count = 2;

			await vi.advanceTimersByTimeAsync(100);
			// @ts-expect-error testing proxy assignment
			store.count = 3;

			expect(values).toEqual([1, 3]);
			unsub();
			vi.useRealTimers();
		});

		it('should clean up parent listeners', () => {
			const store = createStore('streamCleanup', { count: 0 });
			const stream = createStoreStream(store, 'count');
			const mapped = stream.map((v) => v * 2);
			const values: number[] = [];
			const unsub = mapped.subscribe((v) => values.push(v));

			// @ts-expect-error testing proxy assignment
			store.count = 5;
			expect(values).toEqual([10]);

			unsub();
			// After unsubscribing, no more values should come through
			// @ts-expect-error testing proxy assignment
			store.count = 10;
			expect(values).toEqual([10]);
		});
	});

	describe('streamAll', () => {
		it('should emit full snapshots', () => {
			const store = createStore('streamAll1', { a: 1, b: 2 });
			const stream = streamAll(store);
			const snapshots: unknown[] = [];
			const unsub = stream.subscribe((v) => snapshots.push(v));

			// @ts-expect-error testing proxy assignment
			store.a = 10;
			expect(snapshots).toHaveLength(1);
			expect(snapshots[0]).toEqual({ a: 10, b: 2 });
			unsub();
		});
	});
});
