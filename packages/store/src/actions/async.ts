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

import type { Store } from '../core/types.js';
import {
	DEFAULT_RETRY_INITIAL_DELAY_MS,
	DEFAULT_RETRY_MAX_DELAY_MS,
	DEFAULT_RETRY_BACKOFF_FACTOR,
} from '../config/constants.js';
import {
	ActionNotFoundError,
	TimeoutError,
	CancellationError,
} from '../errors.js';
import { runWithAbortSignal } from './cancellation.js';

export interface ActionResult<T> {
	data: T | null;
	error: Error | null;
	loading: boolean;
}

export interface AsyncAction<A extends unknown[], R> {
	(...args: A): Promise<R>;
	pending: boolean;
}

export interface CancellableAction<A extends unknown[], R> {
	(...args: A): Promise<R>;
	pending: boolean;
	cancel: () => void;
}

type ActionFn<A extends unknown[], R> = (...args: A) => Promise<R> | R;
type CooperativeActionFn<A extends unknown[], R> = (
	...args: [...A, AbortSignal]
) => Promise<R> | R;

export interface CancellableActionOptions {
	readonly cancellable: true;
}

const invokeAction = <A extends unknown[], R>(
	fn: ActionFn<A, R> | CooperativeActionFn<A, R>,
	args: A,
	signal: AbortSignal,
	cancellable: boolean
): Promise<R> => {
	try {
		const result = cancellable
			? (fn as CooperativeActionFn<A, R>)(...args, signal)
			: (fn as ActionFn<A, R>)(...args);
		return Promise.resolve(result);
	} catch (error) {
		return Promise.reject(
			error instanceof Error ? error : new Error(String(error))
		);
	}
};

export const createAsyncAction = <A extends unknown[], R>(
	fn: ActionFn<A, R>
): AsyncAction<A, R> => {
	let pending = false;

	const action = async (...args: A): Promise<R> => {
		pending = true;
		try {
			const result = await fn(...args);
			return result;
		} finally {
			pending = false;
		}
	};

	Object.defineProperty(action, 'pending', {
		get: () => pending,
		enumerable: true,
	});

	return action as AsyncAction<A, R>;
};

export function createCancellableAction<A extends unknown[], R>(
	fn: CooperativeActionFn<A, R>,
	options: CancellableActionOptions
): CancellableAction<A, R>;
export function createCancellableAction<A extends unknown[], R>(
	fn: ActionFn<A, R>
): CancellableAction<A, R>;
export function createCancellableAction<A extends unknown[], R>(
	fn: ActionFn<A, R> | CooperativeActionFn<A, R>,
	options?: CancellableActionOptions
): CancellableAction<A, R> {
	let pending = false;
	let active:
		| {
				readonly controller: AbortController;
				readonly reject: (error: Error) => void;
				settled: boolean;
		  }
		| undefined;

	const cancelActive = (): void => {
		const request = active;
		active = undefined;
		if (!request || request.settled) return;
		request.settled = true;
		request.controller.abort();
		pending = false;
		request.reject(new CancellationError());
	};

	const action = (...args: A): Promise<R> => {
		cancelActive();
		pending = true;
		const controller = new AbortController();

		return new Promise((resolve, reject) => {
			const request = { controller, reject, settled: false };
			active = request;

				invokeAction(
					fn,
					args,
					controller.signal,
					options?.cancellable === true
			).then(
				(result) => {
					if (active !== request || request.settled) return;
					request.settled = true;
					active = undefined;
					pending = false;
					resolve(result);
				},
				(error: unknown) => {
					if (active !== request || request.settled) return;
					request.settled = true;
					active = undefined;
					pending = false;
					reject(error instanceof Error ? error : new Error(String(error)));
				}
			);
		});
	};

	Object.defineProperty(action, 'pending', {
		get: () => pending,
		enumerable: true,
	});

	Object.defineProperty(action, 'cancel', {
		value: cancelActive,
		enumerable: true,
	});

	return action as CancellableAction<A, R>;
}

export const withTimeout = <A extends unknown[], R>(
	fn: ActionFn<A, R>,
	timeoutMs: number
): ((...args: A) => Promise<R>) => {
	return async (...args: A): Promise<R> => {
		const promise = Promise.resolve(fn(...args));
		const timeoutPromise = new Promise<never>((_, reject) => {
			const timer = setTimeout(() => {
				reject(new TimeoutError(timeoutMs));
			}, timeoutMs);
			promise
				.then(() => {
					clearTimeout(timer);
				})
				.catch(() => {
					clearTimeout(timer);
				});
		});
		return Promise.race([promise, timeoutPromise]);
	};
};

export interface RetryConfig {
	maxRetries: number;
	initialDelayMs?: number;
	maxDelayMs?: number;
	backoffFactor?: number;
}

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

	const sleep = (ms: number): Promise<void> =>
		new Promise((resolve) => setTimeout(resolve, ms));

	return async (...args: A): Promise<R> => {
		let lastError: Error | undefined;
		let delay = initialDelayMs;

		for (let attempt = 0; attempt <= maxRetries; attempt++) {
			try {
				return await fn(...args);
			} catch (error) {
				lastError = error instanceof Error ? error : new Error(String(error));
				if (attempt < maxRetries) {
					await sleep(delay);
					delay = Math.min(delay * backoffFactor, maxDelayMs);
				}
			}
		}

		throw lastError ?? new Error('Unknown error');
	};
};

export const dispatch = <T>(
	store: Store<T>,
	actionName: keyof T,
	...args: unknown[]
): Promise<unknown> => {
	const storeRecord = store as unknown as Record<string, unknown>;
	const action = storeRecord[actionName as string];
	if (typeof action !== 'function') {
		return Promise.reject(new ActionNotFoundError(String(actionName)));
	}
	return Promise.resolve((action as (...args: unknown[]) => unknown)(...args));
};

export const dispatchSync = <T>(
	store: Store<T>,
	actionName: keyof T,
	...args: unknown[]
): unknown => {
	const storeRecord = store as unknown as Record<string, unknown>;
	const action = storeRecord[actionName as string];
	if (typeof action !== 'function') {
		throw new ActionNotFoundError(String(actionName));
	}
	return (action as (...args: unknown[]) => unknown)(...args);
};

export function withAbortSignal<A extends unknown[], R>(
	fn: CooperativeActionFn<A, R>,
	options: CancellableActionOptions
): (signal: AbortSignal, ...args: A) => Promise<R>;
export function withAbortSignal<A extends unknown[], R>(
	fn: ActionFn<A, R>
): (signal: AbortSignal, ...args: A) => Promise<R>;
export function withAbortSignal<A extends unknown[], R>(
	fn: ActionFn<A, R> | CooperativeActionFn<A, R>,
	options?: CancellableActionOptions
): (signal: AbortSignal, ...args: A) => Promise<R> {
	return (signal: AbortSignal, ...args: A): Promise<R> => {
		if (signal.aborted) {
			return Promise.reject(new CancellationError());
		}
		const promise = invokeAction(
			fn,
			args,
			signal,
			options?.cancellable === true
		);
		return runWithAbortSignal(promise, signal);
	};
}
