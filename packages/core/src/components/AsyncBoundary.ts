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

type AsyncStatusInternal = Data.TaggedEnum<{
	Idle: object;
	Loading: object;
	Success: object;
	Error: { readonly error: unknown };
}>;

const { Idle, Loading, Success, Error, $is } =
	Data.taggedEnum<AsyncStatusInternal>();

export type AsyncStatus = 'idle' | 'loading' | 'success' | 'error';
export type AsyncBoundaryStatus = AsyncStatus;

const isAsyncIdleInternal = (
	s: AsyncStatusInternal
): s is Extract<AsyncStatusInternal, { _tag: 'Idle' }> => $is('Idle')(s);
const isAsyncLoadingInternal = (
	s: AsyncStatusInternal
): s is Extract<AsyncStatusInternal, { _tag: 'Loading' }> => $is('Loading')(s);
const isAsyncSuccessInternal = (
	s: AsyncStatusInternal
): s is Extract<AsyncStatusInternal, { _tag: 'Success' }> => $is('Success')(s);
const isAsyncErrorInternal = (
	s: AsyncStatusInternal
): s is Extract<AsyncStatusInternal, { _tag: 'Error' }> => $is('Error')(s);

export const isAsyncIdle = (s: AsyncStatus): s is 'idle' => s === 'idle';
export const isAsyncLoading = (s: AsyncStatus): s is 'loading' =>
	s === 'loading';
export const isAsyncSuccess = (s: AsyncStatus): s is 'success' =>
	s === 'success';
export const isAsyncError = (s: AsyncStatus): s is 'error' => s === 'error';

export const matchAsyncStatus = <R>(
	status: AsyncStatus,
	handlers: {
		onIdle: () => R;
		onLoading: () => R;
		onSuccess: () => R;
		onError: (error: unknown) => R;
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
			return handlers.onError(undefined);
	}
};

export class AsyncBoundaryError extends Data.TaggedError('AsyncBoundaryError')<{
	readonly cause: unknown;
	readonly retryCount: number;
}> {}

export interface AsyncBoundaryProps {
	loading?: EffuseChild | (() => EffuseChild);
	error?: EffuseChild | ((error: unknown, retry: () => void) => EffuseChild);
	onError?: (error: unknown) => void;
	onRetry?: () => void;
	children: EffuseChild;
}

type AsyncBoundaryCache = {
	status: Signal<AsyncStatusInternal>;
	error: Signal<unknown>;
	retryCount: Signal<number>;
};

const createCache = (): AsyncBoundaryCache => ({
	status: signal<AsyncStatusInternal>(Idle()),
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
		cache.status.value = Idle();
		cache.retryCount.value += 1;
		props.onRetry?.();
	};

	const handleError = (error: unknown): void => {
		cache.error.value = error;
		cache.status.value = Error({ error });
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

			switch (status._tag) {
				case 'Idle':
					return [props.children];
				case 'Loading': {
					const loadingChild = resolveFallback(props.loading);
					return Predicate.isNotNullable(loadingChild) ? [loadingChild] : [];
				}
				case 'Success':
					return [props.children];
				case 'Error': {
					const errorChild = resolveErrorFallback(
						props.error,
						status.error,
						retry
					);
					return Predicate.isNotNullable(errorChild) ? [errorChild] : [];
				}
			}
		},
	});

	return listNode;
};

export const useAsyncBoundary = (
	node: EffuseNode
): {
	status: AsyncStatus;
	error: unknown;
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

		const getStatus = (): AsyncStatus => {
			const s = cache.status.value;
			if (isAsyncIdleInternal(s)) return 'idle';
			if (isAsyncLoadingInternal(s)) return 'loading';
			if (isAsyncSuccessInternal(s)) return 'success';
			if (isAsyncErrorInternal(s)) return 'error';
			return 'idle';
		};

		return {
			get status() {
				return getStatus();
			},
			get error() {
				return cache.error.value;
			},
			retry: cacheNode._retry,
			setLoading: () => {
				cache.status.value = Loading();
			},
			setSuccess: () => {
				cache.status.value = Success();
			},
			setError: (error: unknown) => {
				handleErrorFn(error);
			},
			isIdle: () => isAsyncIdleInternal(cache.status.value),
			isLoading: () => isAsyncLoadingInternal(cache.status.value),
			isSuccess: () => isAsyncSuccessInternal(cache.status.value),
			isError: () => isAsyncErrorInternal(cache.status.value),
		};
	}

	return {
		status: 'idle',
		error: null,
		retry: () => {},
		setLoading: () => {},
		setSuccess: () => {},
		setError: () => {},
		isIdle: () => true,
		isLoading: () => false,
		isSuccess: () => false,
		isError: () => false,
	};
};
