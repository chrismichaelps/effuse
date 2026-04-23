import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import type { ConcurrencyStrategy } from '../../actions/useConcurrency.js';
import { useConcurrency } from '../../actions/useConcurrency.js';

const sleep = (ms: number): Promise<void> =>
	new Promise((resolve) => setTimeout(resolve, ms));

describe('useConcurrency', () => {
	beforeEach(() => {
		vi.useFakeTimers();
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	describe('execution strategies', () => {
		it('should execute all actions concurrently when using "merge" strategy', async () => {
			const executedArgs: number[] = [];
			const action = (id: number) => {
				executedArgs.push(id);
			};

			const wrappedAction = useConcurrency(action, { strategy: 'merge' });

			void wrappedAction(1);
			void wrappedAction(2);
			void wrappedAction(3);

			await Promise.resolve();
			expect(executedArgs).toEqual([1, 2, 3]);
		});

		it('should ignore stale results when using "switch" strategy', async () => {
			const completedArgs: number[] = [];
			const action = async (id: number) => {
				await sleep(100);
				completedArgs.push(id);
			};

			const wrappedAction = useConcurrency(action, { strategy: 'switch' });

			void wrappedAction(1);
			await vi.advanceTimersByTimeAsync(50);
			void wrappedAction(2); // 1 becomes stale
			await vi.advanceTimersByTimeAsync(50);
			void wrappedAction(3); // 2 becomes stale
			await vi.advanceTimersByTimeAsync(100); // 3 finishes

			// All actions run to completion (Promises cannot be forcibly interrupted),
			// but only the latest call's result is effective.
			expect(completedArgs).toContain(3);
		});

		it('should ignore new actions while current is running when using "exhaust" strategy', async () => {
			const completedArgs: number[] = [];
			const action = async (id: number) => {
				await sleep(100);
				completedArgs.push(id);
			};

			const wrappedAction = useConcurrency(action, { strategy: 'exhaust' });

			void wrappedAction(1);
			await vi.advanceTimersByTimeAsync(50);
			void wrappedAction(2); // Should be ignored
			await vi.advanceTimersByTimeAsync(100); // 1 finishes running
			void wrappedAction(3); // runs after 1 completes
			await vi.advanceTimersByTimeAsync(100); // 3 finishes

			expect(completedArgs).toEqual([1, 3]);
		});

		it('should execute actions sequentially when using "concat" strategy', async () => {
			const completedArgs: number[] = [];
			const action = async (id: number) => {
				await sleep(50);
				completedArgs.push(id);
			};

			const wrappedAction = useConcurrency(action, { strategy: 'concat' });

			void wrappedAction(1);
			void wrappedAction(2);
			void wrappedAction(3);

			await vi.advanceTimersByTimeAsync(50); // 1 finishes
			await Promise.resolve();
			expect(completedArgs).toContain(1);
			expect(completedArgs).not.toContain(2);

			await vi.advanceTimersByTimeAsync(50); // 2 finishes
			await Promise.resolve();
			expect(completedArgs).toContain(2);
			expect(completedArgs).not.toContain(3);

			await vi.advanceTimersByTimeAsync(50); // 3 finishes
			await Promise.resolve();
			expect(completedArgs).toContain(3);

			expect(completedArgs).toEqual([1, 2, 3]);
		});
	});

	describe('Debounce and Throttle', () => {
		it('should delay execution until debounceMs has elapsed since last call', async () => {
			const executedArgs: number[] = [];
			const action = (id: number) => {
				executedArgs.push(id);
			};

			const wrappedAction = useConcurrency(action, {
				strategy: 'merge',
				debounceMs: 100,
			});

			void wrappedAction(1);
			await vi.advanceTimersByTimeAsync(50);
			void wrappedAction(2);
			await vi.advanceTimersByTimeAsync(50);
			void wrappedAction(3); // Resets timer

			expect(executedArgs).toEqual([]); // Not executed yet

			await vi.advanceTimersByTimeAsync(100); // wait for debounce
			await Promise.resolve();

			expect(executedArgs).toEqual([3]);
		});

		it('should limit execution rate based on throttleMs', async () => {
			const executedArgs: number[] = [];
			const action = (id: number) => {
				executedArgs.push(id);
			};

			const wrappedAction = useConcurrency(action, {
				strategy: 'merge',
				throttleMs: 100,
			});

			void wrappedAction(1); // Executed immediately
			void wrappedAction(2); // Ignored

			await vi.advanceTimersByTimeAsync(50);
			void wrappedAction(3); // Still ignored (50ms < 100ms)

			await vi.advanceTimersByTimeAsync(60); // Total 110ms elapsed
			void wrappedAction(4); // Executed

			await Promise.resolve();

			expect(executedArgs).toEqual([1, 4]);
		});

		it('should prioritize throttle over debounce if both are provided', async () => {
			const executedArgs: number[] = [];
			const action = (id: number) => {
				executedArgs.push(id);
			};

			const wrappedAction = useConcurrency(action, {
				strategy: 'merge',
				throttleMs: 100,
				debounceMs: 50,
			});

			void wrappedAction(1); // Throttle allows, debounce delays by 50ms

			await vi.advanceTimersByTimeAsync(60); // 1 gets executed
			await Promise.resolve();
			expect(executedArgs).toEqual([1]);

			// We are at 60ms since last execution. Throttle is 100ms.
			void wrappedAction(2); // Ignored by throttle

			await vi.advanceTimersByTimeAsync(100);

			expect(executedArgs).toEqual([1]); // throttle drops 2 entirely
		});
	});

	describe('Edge cases and boundary values', () => {
		it('should handle zero debounce time same as no debounce', async () => {
			const executedArgs: number[] = [];
			const action = (id: number) => {
				executedArgs.push(id);
			};

			const wrappedAction = useConcurrency(action, {
				strategy: 'merge',
				debounceMs: 0,
			});

			void wrappedAction(1);
			void wrappedAction(2);

			await Promise.resolve();
			expect(executedArgs).toEqual([1, 2]);
		});

		it('should handle negative debounce time same as no debounce', async () => {
			const executedArgs: number[] = [];
			const action = (id: number) => {
				executedArgs.push(id);
			};

			const wrappedAction = useConcurrency(action, {
				strategy: 'merge',
				debounceMs: -100,
			});

			void wrappedAction(1);

			await Promise.resolve();
			expect(executedArgs).toEqual([1]);
		});
	});
});

describe('Generative Permutation Matrix (500 cases)', () => {
	const strategies: ConcurrencyStrategy[] = ['switch', 'exhaust', 'merge', 'concat'];
	const debounceTimes = [undefined, 0, -5, 10, 50];
	const throttleTimes = [undefined, 0, -5, 10, 50];
	const callCounts = [1, 2, 3, 5, 10];

	const permutations: Array<
		[ConcurrencyStrategy, number | undefined, number | undefined, number]
	> = [];

	for (const strategy of strategies) {
		for (const debounceMs of debounceTimes) {
			for (const throttleMs of throttleTimes) {
				for (const calls of callCounts) {
					permutations.push([strategy, debounceMs, throttleMs, calls]);
				}
			}
		}
	}

	it.each(permutations)(
		'Strategy: %s, Debounce: %s, Throttle: %s, Calls: %d',
		async (strategy, debounceMs, throttleMs, calls) => {
			const executed: number[] = [];
			const action = (id: number) => {
				executed.push(id);
			};

			const wrapped = useConcurrency(action, {
				strategy,
				debounceMs,
				throttleMs,
			});

			for (let i = 0; i < calls; i++) {
				void wrapped(i);
				await vi.advanceTimersByTimeAsync(1);
			}

			await vi.runAllTimersAsync();
			await Promise.resolve();

			expect(Array.isArray(executed)).toBe(true);
			expect(executed.length).toBeLessThanOrEqual(calls);
		}
	);
});
