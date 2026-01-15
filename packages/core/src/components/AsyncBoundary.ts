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

import type { EffuseNode, EffuseChild } from '../render/node.js';
import { createListNode } from '../render/node.js';
import type { Signal } from '../types/index.js';
import { signal } from '../reactivity/index.js';
import { Data, Predicate } from 'effect';

export type AsyncBoundaryStatus = 'idle' | 'loading' | 'success' | 'error';

export const isAsyncIdle = (s: AsyncBoundaryStatus): s is 'idle' =>
	s === 'idle';
export const isAsyncLoading = (s: AsyncBoundaryStatus): s is 'loading' =>
	s === 'loading';
export const isAsyncSuccess = (s: AsyncBoundaryStatus): s is 'success' =>
	s === 'success';
export const isAsyncError = (s: AsyncBoundaryStatus): s is 'error' =>
	s === 'error';

export const matchAsyncStatus = <R>(
	status: AsyncBoundaryStatus,
	handlers: {
		onIdle: () => R;
		onLoading: () => R;
		onSuccess: () => R;
		onError: () => R;
	}
): R => {
	switch (status) {
		case 'idle':
			return handlers.onIdle();
		case 'loading':
			return handlers.onLoading();
		case 'success':
			return handlers.onSuccess();
		case 'error':
			return handlers.onError();
	}
};

export type AsyncStatusEnum<T = unknown, E = unknown> = Data.TaggedEnum<{
	Idle: object;
	Loading: object;
	Success: { data: T };
	Error: { error: E };
}>;

const { Idle, Loading, Success, Error: ErrorState } =
	Data.taggedEnum<AsyncStatusEnum>();

export const AsyncStatusEnum = { Idle, Loading, Success, Error: ErrorState };

export class AsyncBoundaryError extends Data.TaggedError('AsyncBoundaryError')<{
	readonly cause: unknown;
	readonly retryCount: number;
}> { }

export interface AsyncBoundaryProps {
	loading?: EffuseChild | (() => EffuseChild);
	error?: EffuseChild | ((error: unknown, retry: () => void) => EffuseChild);
	onError?: (error: unknown) => void;
	onRetry?: () => void;
	children: EffuseChild;
}

type AsyncBoundaryCache = {
	status: Signal<AsyncBoundaryStatus>;
	error: Signal<unknown>;
	retryCount: Signal<number>;
};

const createCache = (): AsyncBoundaryCache => ({
	status: signal<AsyncBoundaryStatus>('idle'),
	error: signal<unknown>(null),
	retryCount: signal<number>(0),
});

const resolveFallback = (
	fallback: EffuseChild | (() => EffuseChild) | undefined
): EffuseChild | null => {
	if (!Predicate.isNotNullable(fallback)) {
		return null;
	}

	if (Predicate.isFunction(fallback)) {
		return fallback();
	}

	return fallback;
};

const resolveErrorFallback = (
	errorFallback:
		| EffuseChild
		| ((error: unknown, retry: () => void) => EffuseChild)
		| undefined,
	error: unknown,
	retry: () => void
): EffuseChild | null => {
	if (!Predicate.isNotNullable(errorFallback)) {
		return null;
	}

	if (Predicate.isFunction(errorFallback)) {
		return errorFallback(error, retry);
	}

	return errorFallback;
};

export const AsyncBoundary = (props: AsyncBoundaryProps): EffuseNode => {
	const cache = createCache();

	const retry = (): void => {
		cache.error.value = null;
		cache.status.value = 'idle';
		cache.retryCount.value += 1;
		props.onRetry?.();
	};

	const handleError = (error: unknown): void => {
		cache.error.value = error;
		cache.status.value = 'error';
		props.onError?.(error);
	};

	const listNode = createListNode([]) as ReturnType<typeof createListNode> & {
		_cache: AsyncBoundaryCache;
		_retry: () => void;
		_handleError: (error: unknown) => void;
	};

	listNode._cache = cache;
	listNode._retry = retry;
	listNode._handleError = handleError;

	Object.defineProperty(listNode, 'children', {
		enumerable: true,
		configurable: true,
		get() {
			const status = cache.status.value;

			return matchAsyncStatus(status, {
				onIdle: () => [props.children],
				onLoading: () => {
					const loadingChild = resolveFallback(props.loading);
					return Predicate.isNotNullable(loadingChild) ? [loadingChild] : [];
				},
				onSuccess: () => [props.children],
				onError: () => {
					const errorChild = resolveErrorFallback(
						props.error,
						cache.error.value,
						retry
					);
					return Predicate.isNotNullable(errorChild) ? [errorChild] : [];
				},
			});
		},
	});

	return listNode;
};

export const useAsyncBoundary = (
	node: EffuseNode
): {
	status: Signal<AsyncBoundaryStatus>;
	error: Signal<unknown>;
	retry: () => void;
	setLoading: () => void;
	setSuccess: () => void;
	setError: (error: unknown) => void;
	isIdle: () => boolean;
	isLoading: () => boolean;
	isSuccess: () => boolean;
	isError: () => boolean;
} => {
	const cacheNode = node as unknown as {
		_cache?: AsyncBoundaryCache;
		_retry?: () => void;
		_handleError?: (error: unknown) => void;
	};

	if (
		Predicate.isNotNullable(cacheNode._cache) &&
		Predicate.isNotNullable(cacheNode._retry) &&
		Predicate.isNotNullable(cacheNode._handleError)
	) {
		const cache = cacheNode._cache;
		const handleErrorFn = cacheNode._handleError;
		return {
			status: cache.status,
			error: cache.error,
			retry: cacheNode._retry,
			setLoading: () => {
				cache.status.value = 'loading';
			},
			setSuccess: () => {
				cache.status.value = 'success';
			},
			setError: (error: unknown) => {
				handleErrorFn(error);
			},
			isIdle: () => isAsyncIdle(cache.status.value),
			isLoading: () => isAsyncLoading(cache.status.value),
			isSuccess: () => isAsyncSuccess(cache.status.value),
			isError: () => isAsyncError(cache.status.value),
		};
	}

	const defaultStatus = signal<AsyncBoundaryStatus>('idle');
	const defaultError = signal<unknown>(null);
	return {
		status: defaultStatus,
		error: defaultError,
		retry: () => { },
		setLoading: () => { },
		setSuccess: () => { },
		setError: () => { },
		isIdle: () => true,
		isLoading: () => false,
		isSuccess: () => false,
		isError: () => false,
	};
};
