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

import type { RetryConfig } from '../execution/index.js';

export type QueryKey = readonly unknown[];

export type QueryStatus = 'idle' | 'loading' | 'success' | 'error';

export interface CacheEntry<T = unknown> {
	readonly data: T;
	readonly dataUpdatedAt: number;
	readonly status: QueryStatus;
	readonly error?: unknown;
	readonly fetchCount: number;
}

export interface QueryOptions<T = unknown> {
	readonly queryKey: QueryKey;
	readonly queryFn: () => Promise<T>;
	readonly staleTime?: number;
	readonly cacheTime?: number;
	readonly retry?: RetryConfig | number | boolean;
	readonly retryDelay?: number;
	readonly timeout?: number;
	readonly enabled?: boolean;
	readonly suspense?: boolean;
	readonly refetchOnWindowFocus?: boolean;
	readonly refetchOnReconnect?: boolean;
	readonly refetchInterval?: number | false;
	readonly onSuccess?: (data: T) => void;
	readonly onError?: (error: unknown) => void;
	readonly onSettled?: (
		data: T | undefined,
		error: unknown | undefined
	) => void;
	readonly select?: (data: T) => T;
	readonly placeholderData?: T | (() => T);
}

export interface MutationOptions<TData = unknown, TVariables = unknown> {
	readonly mutationKey?: QueryKey;
	readonly mutationFn: (variables: TVariables) => Promise<TData>;
	readonly retry?: RetryConfig | number | boolean;
	readonly timeout?: number;
	readonly onSuccess?: (data: TData, variables: TVariables) => void;
	readonly onError?: (error: unknown, variables: TVariables) => void;
	readonly onSettled?: (
		data: TData | undefined,
		error: unknown | undefined,
		variables: TVariables
	) => void;
	readonly onMutate?: (variables: TVariables) => unknown | Promise<unknown>;
}

export interface QueryState<T = unknown> {
	readonly data: T | undefined;
	readonly error: unknown | undefined;
	readonly status: QueryStatus;
	readonly isFetching: boolean;
	readonly isLoading: boolean;
	readonly isSuccess: boolean;
	readonly isError: boolean;
	readonly isStale: boolean;
	readonly dataUpdatedAt: number | undefined;
	readonly errorUpdatedAt: number | undefined;
	readonly fetchCount: number;
}

export interface MutationState<TData = unknown> {
	readonly data: TData | undefined;
	readonly error: unknown | undefined;
	readonly status: 'idle' | 'pending' | 'success' | 'error';
	readonly isPending: boolean;
	readonly isSuccess: boolean;
	readonly isError: boolean;
	readonly isIdle: boolean;
}
