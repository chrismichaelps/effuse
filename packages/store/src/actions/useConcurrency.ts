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

import { Effect, Fiber, Queue } from 'effect';

export type ConcurrencyStrategy = 'switch' | 'exhaust' | 'merge' | 'concat';

export interface ConcurrencyOptions {
	strategy?: ConcurrencyStrategy;
	debounceMs?: number;
	throttleMs?: number;
}

export function useConcurrency<A extends unknown[], R, E = never>(
	action: (...args: A) => Effect.Effect<R, E>,
	options: ConcurrencyOptions = {}
): (...args: A) => void {
	const { strategy = 'switch', debounceMs, throttleMs } = options;

	let runningFiber: Fiber.RuntimeFiber<unknown, unknown> | null = null;
	let debounceTimeout: ReturnType<typeof setTimeout> | null = null;
	let lastCallTime = 0;

	// Dedicated unbounded queue for sequential 'concat' strategy
	const queue =
		strategy === 'concat' ? Effect.runSync(Queue.unbounded<A>()) : null;

	if (queue) {
		// Spin up a background worker to consume the queue sequentially
		Effect.runFork(
			Effect.forever(
				Effect.gen(function* () {
					const args = yield* Queue.take(queue);
					// Catch all errors so the worker doesn't die on failure
					yield* Effect.catchAll(action(...args), () => Effect.void);
				})
			)
		);
	}

	const execute = (...args: A) => {
		switch (strategy) {
			case 'switch':
				if (runningFiber) {
					Effect.runFork(Fiber.interrupt(runningFiber));
				}
				runningFiber = Effect.runFork(
					Effect.match(action(...args), {
						onFailure: () => {
							runningFiber = null;
						},
						onSuccess: () => {
							runningFiber = null;
						},
					})
				);
				break;

			case 'exhaust':
				if (runningFiber) {
					return; // Ignore execution if already running
				}
				runningFiber = Effect.runFork(
					Effect.match(action(...args), {
						onFailure: () => {
							runningFiber = null;
						},
						onSuccess: () => {
							runningFiber = null;
						},
					})
				);
				break;

			case 'merge':
				// Unbounded concurrency: fire and forget
				Effect.runFork(
					Effect.catchAll(action(...args), () => Effect.void)
				);
				break;

			case 'concat':
				// Sequential execution via the background queue
				if (queue) {
					Effect.runFork(Queue.offer(queue, args));
				}
				break;
		}
	};

	return (...args: A) => {
		const now = Date.now();

		// 1. Evaluate Throttle
		if (throttleMs !== undefined && throttleMs > 0) {
			if (now - lastCallTime < throttleMs) {
				return;
			}
			lastCallTime = now;
		}

		// 2. Evaluate Debounce
		if (debounceMs !== undefined && debounceMs > 0) {
			if (debounceTimeout) {
				clearTimeout(debounceTimeout);
			}
			debounceTimeout = setTimeout(() => {
				execute(...args);
			}, debounceMs);
			return;
		}

		// 3. Fallthrough immediate execution
		execute(...args);
	};
}
