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

export interface ConcurrencyOptions<A extends unknown[] = unknown[]> {
	readonly strategy?: ConcurrencyStrategy;
	readonly debounceMs?: number;
	readonly throttleMs?: number;
	/** Inject an AbortSignal as the final action argument. */
	readonly cancellable?: boolean;
	/** Observes action failures after the helper has consumed the rejection. */
	readonly onError?: (error: Error, args: Readonly<A>) => void;
}

export interface CancellableConcurrencyOptions<
	A extends unknown[] = unknown[],
> extends ConcurrencyOptions<A> {
	readonly cancellable: true;
}

export interface ConcurrentAction<A extends unknown[]> {
	(...args: A): void;
	/** Abort active work, clear queued work, and ignore future calls. */
	readonly dispose: () => void;
	/** @deprecated Use dispose(). */
	readonly destroy: () => void;
	readonly disposed: boolean;
}

type Action<A extends unknown[], R> = (...args: A) => Promise<R> | R;
type CancellableAction<A extends unknown[], R> = (
	...args: [...A, AbortSignal]
) => Promise<R> | R;

interface RunningTask {
	readonly controller: AbortController;
	readonly promise: Promise<void>;
}

export function useConcurrency<A extends unknown[], R>(
	action: CancellableAction<A, R>,
	options: CancellableConcurrencyOptions<A>
): ConcurrentAction<A>;
export function useConcurrency<A extends unknown[], R>(
	action: Action<A, R>,
	options?: ConcurrencyOptions<A>
): ConcurrentAction<A>;
export function useConcurrency<A extends unknown[], R>(
	action: Action<A, R> | CancellableAction<A, R>,
	options: ConcurrencyOptions<A> = {}
): ConcurrentAction<A> {
	const {
		strategy = 'switch',
		debounceMs,
		throttleMs,
		cancellable = false,
		onError,
	} = options;

	let runningTask: RunningTask | null = null;
	let debounceTimeout: ReturnType<typeof setTimeout> | null = null;
	let lastCallTime = 0;
	let processingQueue = false;
	let disposed = false;
	const queue: A[] = [];
	const controllers = new Set<AbortController>();

	const normalizeError = (error: unknown): Error =>
		error instanceof Error ? error : new Error(String(error));

	const reportError = (error: unknown, args: A): void => {
		if (!onError) return;
		try {
			onError(normalizeError(error), args);
		} catch {
			// Error observers cannot create an unhandled control-flow rejection.
		}
	};

	const invoke = (args: A, controller: AbortController): Promise<R> => {
		try {
			const result = cancellable
				? (action as CancellableAction<A, R>)(...args, controller.signal)
				: (action as Action<A, R>)(...args);
			return Promise.resolve(result);
		} catch (error) {
			return Promise.reject(
				error instanceof Error ? error : new Error(String(error))
			);
		}
	};

	const startTask = (args: A): RunningTask => {
		const controller = new AbortController();
		controllers.add(controller);
		const promise = invoke(args, controller)
			.then(
				() => undefined,
				(error: unknown) => {
					if (!controller.signal.aborted) reportError(error, args);
				}
			)
			.finally(() => {
				controllers.delete(controller);
			});
		return { controller, promise };
	};

	const processQueue = async (): Promise<void> => {
		if (processingQueue) return;
		processingQueue = true;
		try {
			while (!disposed && queue.length > 0) {
				const args = queue.shift();
				if (!args) continue;
				const task = startTask(args);
				runningTask = task;
				await task.promise;
				if (runningTask === task) runningTask = null;
			}
		} finally {
			processingQueue = false;
		}
	};

	const execute = (...args: A): void => {
		if (disposed) return;

		switch (strategy) {
			case 'switch': {
				runningTask?.controller.abort();
				const task = startTask(args);
				runningTask = task;
				void task.promise.then(() => {
					if (runningTask === task) runningTask = null;
				});
				break;
			}

			case 'exhaust': {
				if (runningTask) return;
				const task = startTask(args);
				runningTask = task;
				void task.promise.then(() => {
					if (runningTask === task) runningTask = null;
				});
				break;
			}

			case 'merge': {
				startTask(args);
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
		if (disposed) return;
		const now = Date.now();

		if (throttleMs !== undefined && throttleMs > 0) {
			if (now - lastCallTime < throttleMs) return;
			lastCallTime = now;
		}

		if (debounceMs !== undefined && debounceMs > 0) {
			if (debounceTimeout) clearTimeout(debounceTimeout);
			debounceTimeout = setTimeout(() => {
				debounceTimeout = null;
				execute(...args);
			}, debounceMs);
			return;
		}

		execute(...args);
	};

	const dispose = (): void => {
		if (disposed) return;
		disposed = true;
		if (debounceTimeout) {
			clearTimeout(debounceTimeout);
			debounceTimeout = null;
		}
		queue.length = 0;
		for (const controller of controllers) controller.abort();
		controllers.clear();
		runningTask = null;
	};

	Object.defineProperties(wrapped, {
		dispose: { value: dispose, enumerable: true },
		destroy: { value: dispose, enumerable: true },
		disposed: { get: () => disposed, enumerable: true },
	});

	return wrapped as ConcurrentAction<A>;
}
