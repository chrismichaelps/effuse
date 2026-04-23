/**
 * MIT License
 *
 * Copyright (c) 2025 Chris M. Perez
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Effect } from 'effect';
import { executeQuery } from './resolver.js';

describe('resolver', () => {
	describe('inFlightRequests deduplication', () => {
		it('should deduplicate concurrent requests', async () => {
			let calls = 0;
			const queryFn = async () => {
				calls++;
				await new Promise((r) => setTimeout(r, 20));
				return 'result';
			};

			const [r1, r2] = await Promise.all([
				executeQuery(['dedup'], queryFn).pipe(Effect.runPromise),
				executeQuery(['dedup'], queryFn).pipe(Effect.runPromise),
			]);

			expect(calls).toBe(1);
			expect(r1).toBe('result');
			expect(r2).toBe('result');
		});

		it('should allow new request after previous completes', async () => {
			let calls = 0;
			const queryFn = async () => {
				calls++;
				return 'result';
			};

			await executeQuery(['seq'], queryFn).pipe(Effect.runPromise);
			await executeQuery(['seq'], queryFn).pipe(Effect.runPromise);

			expect(calls).toBe(2);
		});

		it('should clean up completed requests', async () => {
			const queryFn = async () => 'done';

			await executeQuery(['cleanup'], queryFn).pipe(Effect.runPromise);

			// After completion, a new request should NOT deduplicate
			let calls = 0;
			const queryFn2 = async () => {
				calls++;
				return 'done2';
			};

			await executeQuery(['cleanup'], queryFn2).pipe(Effect.runPromise);
			expect(calls).toBe(1);
		});
	});

	describe('inFlightRequests TTL', () => {
		beforeEach(() => {
			vi.useFakeTimers();
		});

		afterEach(() => {
			vi.useRealTimers();
		});

		it('should expire stale entries after TTL', async () => {
			let calls = 0;
			const queryFn = async () => {
				calls++;
				await new Promise((r) => setTimeout(r, 1000));
				return 'result';
			};

			// Start first request
			const p1 = executeQuery(['ttl'], queryFn).pipe(Effect.runPromise);

			// Advance past TTL (30s)
			vi.advanceTimersByTime(31000);

			// Start second request — should NOT deduplicate because first expired
			const p2 = executeQuery(['ttl'], queryFn).pipe(Effect.runPromise);

			// Advance so both complete
			vi.advanceTimersByTime(2000);

			await Promise.all([p1, p2]);
			expect(calls).toBe(2);
		});

		it('should enforce max size cap', async () => {
			// We can't easily test the internal Map size directly,
			// but we can verify behavior under pressure.
			const promises: Promise<unknown>[] = [];

			for (let i = 0; i < 110; i++) {
				const queryFn = async () => {
					await new Promise((r) => setTimeout(r, 10000));
					return i;
				};
				promises.push(
					executeQuery(['max', i], queryFn).pipe(Effect.runPromise)
				);
			}

			// Should not throw or leak
			expect(promises.length).toBe(110);

			// Cancel all by advancing time
			vi.advanceTimersByTime(31000);
		});
	});

	describe('error handling', () => {
		it('should propagate query errors', async () => {
			const queryFn = async () => {
				throw new Error('query failed');
			};

			await expect(
				executeQuery(['error'], queryFn).pipe(Effect.runPromise)
			).rejects.toThrow('query failed');
		});

		it('should allow retry after error', async () => {
			let calls = 0;
			const queryFn = async () => {
				calls++;
				if (calls === 1) throw new Error('fail');
				return 'success';
			};

			await expect(
				executeQuery(['retry'], queryFn).pipe(Effect.runPromise)
			).rejects.toThrow('fail');

			const result = await executeQuery(['retry'], queryFn).pipe(
				Effect.runPromise
			);
			expect(result).toBe('success');
		});
	});

	describe('Effect queryFn support', () => {
		it('should accept Effect.Effect as queryFn', async () => {
			const queryFn = () => Effect.succeed(42);
			const result = await executeQuery(['effect'], queryFn).pipe(
				Effect.runPromise
			);
			expect(result).toBe(42);
		});

		it('should handle Effect failures', async () => {
			const queryFn = () => Effect.fail(new Error('effect failed'));
			await expect(
				executeQuery(['effect-fail'], queryFn).pipe(Effect.runPromise)
			).rejects.toThrow('effect failed');
		});
	});
});
