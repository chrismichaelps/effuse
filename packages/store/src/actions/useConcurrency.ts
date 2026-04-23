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

interface RunningTask<R> {
	abort: () => void;
	promise: Promise<R>;
}

export function useConcurrency<A extends unknown[], R>(
	action: (...args: A) => Promise<R>,
	options: ConcurrencyOptions = {}
): (...args: A) => Promise<R> | undefined {
	const { strategy = 'switch', debounceMs, throttleMs } = options;

	let runningTask: RunningTask<R> | null = null;
	let debounceTimeout: ReturnType<typeof setTimeout> | null = null;
	let lastCallTime = 0;
	const queue: { args: A; resolve: (value: R) => void; reject: (error: unknown) => void }[] = [];
	let isProcessingQueue = false;
	let destroyed = false;

	const processQueue = async (): Promise<void> => {
		if (isProcessingQueue || queue.length === 0) return;
		isProcessingQueue = true;
		while (queue.length > 0) {
			if (destroyed) break;
			const item = queue.shift() as typeof queue[number];
			try {
				const result = await Promise.resolve(action(...item.args));
				item.resolve(result);
			} catch (error) {
				item.reject(error);
			}
		}
		isProcessingQueue = false;
	};

	const execute = (...args: A): Promise<R> | undefined => {
		if (destroyed) return undefined;

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
						(value) => {
							if (runningTask?.promise === promise) {
								runningTask = null;
							}
							return value;
						},
						(error: unknown) => {
							if (runningTask?.promise === promise) {
								runningTask = null;
							}
							throw error;
						}
					),
				};
				return runningTask.promise;
			}

			case 'exhaust': {
				if (runningTask) return runningTask.promise;
				const promise = Promise.resolve(action(...args));
				runningTask = {
					abort: () => {},
					promise: promise.finally(() => {
						runningTask = null;
					}),
				};
				return runningTask.promise;
			}

			case 'merge': {
				return Promise.resolve(action(...args)).catch((error: unknown) => {
					throw error;
				});
			}

			case 'concat': {
				return new Promise((resolve, reject) => {
					queue.push({ args, resolve, reject });
					void processQueue();
				});
			}
		}
	};

	const wrapped = (...args: A): Promise<R> | undefined => {
		if (destroyed) return undefined;
		const now = Date.now();

		if (throttleMs !== undefined && throttleMs > 0) {
			if (now - lastCallTime < throttleMs) {
				return undefined;
			}
			lastCallTime = now;
		}

		if (debounceMs !== undefined && debounceMs > 0) {
			if (debounceTimeout) {
				clearTimeout(debounceTimeout);
			}
			return new Promise((resolve, reject) => {
				debounceTimeout = setTimeout(() => {
					debounceTimeout = null;
					const result = execute(...args);
					if (result) {
						result.then(resolve).catch(reject);
					}
				}, debounceMs);
			});
		}

		return execute(...args);
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
