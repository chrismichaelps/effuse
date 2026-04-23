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

export type ConcurrencyStrategy = 'switch' | 'exhaust' | 'merge' | 'concat';

export interface ConcurrencyOptions {
	strategy?: ConcurrencyStrategy;
	debounceMs?: number;
	throttleMs?: number;
}

interface RunningTask {
	abort: () => void;
	promise: Promise<unknown>;
}

export function useConcurrency<A extends unknown[], R>(
	action: (...args: A) => Promise<R>,
	options: ConcurrencyOptions = {}
): (...args: A) => void {
	const { strategy = 'switch', debounceMs, throttleMs } = options;

	let runningTask: RunningTask | null = null;
	let debounceTimeout: ReturnType<typeof setTimeout> | null = null;
	let lastCallTime = 0;
	const queue: A[] = [];
	let isProcessingQueue = false;
	let destroyed = false;

	const processQueue = async (): Promise<void> => {
		if (isProcessingQueue || queue.length === 0) return;
		isProcessingQueue = true;
		while (queue.length > 0) {
			if (destroyed) break;
			const args = queue.shift() as A;
			try {
				await Promise.resolve(action(...args));
			} catch {
				// Ignore errors so the queue doesn't stall
			}
		}
		isProcessingQueue = false;
	};

	const execute = (...args: A): void => {
		if (destroyed) return;

		switch (strategy) {
			case 'switch': {
				if (runningTask) {
					runningTask.abort();
				}
				const controller = new AbortController();
				const promise = Promise.resolve(action(...args));
					runningTask = {
						abort: () => {
							controller.abort();
						},
						promise: promise.then(
						() => {
							if (runningTask?.promise === promise) {
								runningTask = null;
							}
						},
						() => {
							if (runningTask?.promise === promise) {
								runningTask = null;
							}
						}
					),
				};
				break;
			}

			case 'exhaust': {
				if (runningTask) return;
				const promise = Promise.resolve(action(...args));
				runningTask = {
					abort: () => {},
					promise: promise.finally(() => {
						runningTask = null;
					}),
				};
				break;
			}

			case 'merge': {
				// Unbounded concurrency: fire and forget
				Promise.resolve(action(...args)).catch(() => {});
				break;
			}

			case 'concat': {
				queue.push(args);
				void processQueue();
				break;
			}
		}
	};

	const wrapped = (...args: A): void => {
		if (destroyed) return;
		const now = Date.now();

		if (throttleMs !== undefined && throttleMs > 0) {
			if (now - lastCallTime < throttleMs) {
				return;
			}
			lastCallTime = now;
		}

		if (debounceMs !== undefined && debounceMs > 0) {
			if (debounceTimeout) {
				clearTimeout(debounceTimeout);
			}
			debounceTimeout = setTimeout(() => {
				execute(...args);
			}, debounceMs);
			return;
		}

		execute(...args);
	};

	(wrapped as unknown as { destroy: () => void }).destroy = () => {
		destroyed = true;
		if (debounceTimeout) {
			clearTimeout(debounceTimeout);
		}
		if (runningTask) {
			runningTask.abort();
		}
		queue.length = 0;
	};

	return wrapped;
}
