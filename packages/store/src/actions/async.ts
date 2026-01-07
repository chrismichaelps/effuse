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

import { Effect, Duration, Schedule } from 'effect';
import type { Store } from '../core/types.js';
import { createCancellationToken } from './cancellation.js';
import { runWithAbortSignal } from './cancellation.js';
import {
	DEFAULT_RETRY_INITIAL_DELAY_MS,
	DEFAULT_RETRY_MAX_DELAY_MS,
	DEFAULT_RETRY_BACKOFF_FACTOR,
} from '../config/constants.js';
import {
	ActionNotFoundError,
	CancellationError,
	TimeoutError,
} from '../errors.js';

// Asynchronous operation outcome
export interface ActionResult<T> {
	data: T | null;
	error: Error | null;
	loading: boolean;
}

// Asynchronous action with pending state
export interface AsyncAction<A extends unknown[], R> {
	(...args: A): Promise<R>;
	pending: boolean;
}

// Cancellable asynchronous action
export interface CancellableAction<A extends unknown[], R> {
	(...args: A): Promise<R>;
	pending: boolean;
	cancel: () => void;
}

type ActionFn<A extends unknown[], R> = (...args: A) => Promise<R> | R;

// Build asynchronous action
export const createAsyncAction = <A extends unknown[], R>(
	fn: ActionFn<A, R>
): AsyncAction<A, R> => {
	let pending = false;

	const action = async (...args: A): Promise<R> => {
		pending = true;
		const result = await Effect.runPromise(
			Effect.tryPromise({
				try: async () => fn(...args),
				catch: (error) => error as Error,
			}).pipe(
				Effect.tapBoth({
					onSuccess: () =>
						Effect.sync(() => {
							pending = false;
						}),
					onFailure: () =>
						Effect.sync(() => {
							pending = false;
						}),
				})
			)
		);
		return result;
	};

	Object.defineProperty(action, 'pending', {
		get: () => pending,
		enumerable: true,
	});

	return action as AsyncAction<A, R>;
};

// Build cancellable asynchronous action
export const createCancellableAction = <A extends unknown[], R>(
	fn: ActionFn<A, R>
): CancellableAction<A, R> => {
	let pending = false;
	let currentController: AbortController | null = null;

	const action = async (...args: A): Promise<R> => {
		if (currentController) {
			currentController.abort();
		}

		currentController = new AbortController();
		const signal = currentController.signal;
		pending = true;

		try {
			const effect = Effect.tryPromise({
				try: async () => fn(...args),
				catch: (error) => error as Error,
			});
			const result = await Effect.runPromise(
				runWithAbortSignal(effect, signal)
			);
			return result;
		} finally {
			pending = false;
			currentController = null;
		}
	};

	Object.defineProperty(action, 'pending', {
		get: () => pending,
		enumerable: true,
	});

	Object.defineProperty(action, 'cancel', {
		value: () => {
			if (currentController) {
				currentController.abort();
				currentController = null;
				pending = false;
			}
		},
		enumerable: true,
	});

	return action as CancellableAction<A, R>;
};

// Enforce operation timeout
export const withTimeout = <A extends unknown[], R>(
	fn: ActionFn<A, R>,
	timeoutMs: number
): ((...args: A) => Promise<R>) => {
	return async (...args: A): Promise<R> => {
		const effect = Effect.tryPromise({
			try: async () => fn(...args),
			catch: (error) => error as Error,
		}).pipe(
			Effect.timeoutFail({
				duration: Duration.millis(timeoutMs),
				onTimeout: () => new TimeoutError({ ms: timeoutMs }),
			})
		);

		return Effect.runPromise(effect);
	};
};

// Retry configuration
export interface RetryConfig {
	maxRetries: number;
	initialDelayMs?: number;
	maxDelayMs?: number;
	backoffFactor?: number;
}

// Retry on failure
export const withRetry = <A extends unknown[], R>(
	fn: ActionFn<A, R>,
	config: RetryConfig
): ((...args: A) => Promise<R>) => {
	const {
		maxRetries,
		initialDelayMs = DEFAULT_RETRY_INITIAL_DELAY_MS,
		maxDelayMs = DEFAULT_RETRY_MAX_DELAY_MS,
		backoffFactor = DEFAULT_RETRY_BACKOFF_FACTOR,
	} = config;

	return async (...args: A): Promise<R> => {
		const schedule = Schedule.exponential(
			Duration.millis(initialDelayMs),
			backoffFactor
		).pipe(
			Schedule.either(Schedule.recurs(maxRetries)),
			Schedule.upTo(Duration.millis(maxDelayMs))
		);

		const effect = Effect.tryPromise({
			try: async () => fn(...args),
			catch: (error) => error as Error,
		}).pipe(Effect.retry(schedule));

		return Effect.runPromise(effect);
	};
};

// Execute only latest call
export const takeLatest = <A extends unknown[], R>(
	fn: ActionFn<A, R>
): CancellableAction<A, R> => {
	let pending = false;
	let currentToken = createCancellationToken();
	let callId = 0;

	const action = async (...args: A): Promise<R> => {
		currentToken.cancel();
		currentToken = createCancellationToken();
		const myToken = currentToken;
		const myCallId = ++callId;

		pending = true;

		try {
			const result = await fn(...args);

			if (myToken.isCancelled || myCallId !== callId) {
				throw new CancellationError({ message: 'Superseded by newer call' });
			}

			return result;
		} finally {
			if (myCallId === callId) {
				pending = false;
			}
		}
	};

	Object.defineProperty(action, 'pending', {
		get: () => pending,
		enumerable: true,
	});

	Object.defineProperty(action, 'cancel', {
		value: () => {
			currentToken.cancel();
			pending = false;
		},
		enumerable: true,
	});

	return action as CancellableAction<A, R>;
};

// Execute only first call
export const takeFirst = <A extends unknown[], R>(
	fn: ActionFn<A, R>
): AsyncAction<A, R | undefined> => {
	let pending = false;

	const action = async (...args: A): Promise<R | undefined> => {
		if (pending) {
			return undefined;
		}

		pending = true;
		try {
			return await fn(...args);
		} finally {
			pending = false;
		}
	};

	Object.defineProperty(action, 'pending', {
		get: () => pending,
		enumerable: true,
	});

	return action as AsyncAction<A, R | undefined>;
};

// Debounce action execution
export const debounceAction = <A extends unknown[], R>(
	fn: ActionFn<A, R>,
	delayMs: number
): ((...args: A) => Promise<R>) => {
	let timeout: ReturnType<typeof setTimeout> | null = null;
	let currentToken = createCancellationToken();

	return (...args: A): Promise<R> => {
		if (timeout) {
			clearTimeout(timeout);
			currentToken.cancel();
		}

		currentToken = createCancellationToken();
		const myToken = currentToken;

		return new Promise((resolve, reject) => {
			timeout = setTimeout(() => {
				if (myToken.isCancelled) return;

				Promise.resolve(fn(...args))
					.then((result) => {
						if (!myToken.isCancelled) resolve(result);
					})
					.catch((error: unknown) => {
						if (!myToken.isCancelled) reject(error as Error);
					});
			}, delayMs);
		});
	};
};

// Throttle action execution
export const throttleAction = <A extends unknown[], R>(
	fn: ActionFn<A, R>,
	intervalMs: number
): ((...args: A) => Promise<R | undefined>) => {
	let lastCallTime = 0;
	let pending = false;

	return async (...args: A): Promise<R | undefined> => {
		const now = Date.now();
		if (now - lastCallTime < intervalMs || pending) {
			return undefined;
		}

		lastCallTime = now;
		pending = true;

		try {
			return await fn(...args);
		} finally {
			pending = false;
		}
	};
};

// Dispatch store action asynchronously
export const dispatch = <T>(
	store: Store<T>,
	actionName: keyof T,
	...args: unknown[]
): Promise<unknown> => {
	const storeRecord = store as unknown as Record<string, unknown>;
	const action = storeRecord[actionName as string];
	if (typeof action !== 'function') {
		return Promise.reject(
			new ActionNotFoundError({ actionName: String(actionName) })
		);
	}
	const actionFn = action as (...a: unknown[]) => unknown;
	return Effect.runPromise(
		Effect.tryPromise({
			try: () => Promise.resolve(actionFn(...args)),
			catch: (error) => error as Error,
		})
	);
};

// Dispatch store action synchronously
export const dispatchSync = <T>(
	store: Store<T>,
	actionName: keyof T,
	...args: unknown[]
): unknown => {
	const storeRecord = store as unknown as Record<string, unknown>;
	const action = storeRecord[actionName as string];
	if (typeof action !== 'function') {
		throw new ActionNotFoundError({ actionName: String(actionName) });
	}
	const actionFn = action as (...a: unknown[]) => unknown;
	return actionFn(...args);
};

// Attach external abort signal
export const withAbortSignal = <A extends unknown[], R>(
	fn: ActionFn<A, R>
): ((signal: AbortSignal, ...args: A) => Promise<R>) => {
	return (signal: AbortSignal, ...args: A): Promise<R> => {
		const effect = Effect.tryPromise({
			try: async () => fn(...args),
			catch: (error) => error as Error,
		});
		return Effect.runPromise(runWithAbortSignal(effect, signal));
	};
};
