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

export type QueryStatus = 'pending' | 'success' | 'error';

export type FetchStatus = 'idle' | 'fetching' | 'paused';

/** Query function that receives an AbortSignal and returns a Promise. */
export type QueryFunction<T> = (context: {
	signal: AbortSignal;
}) => Promise<T>;

/** Internal state maintained by the Query class. */
export interface QueryState<TData = unknown, TError = Error> {
	readonly data: TData | undefined;
	readonly dataUpdatedAt: number;
	readonly error: TError | null;
	readonly errorUpdatedAt: number;
	readonly status: QueryStatus;
	readonly fetchStatus: FetchStatus;
	readonly fetchCount: number;
	readonly isInvalidated: boolean;
}

/** Actions that drive the Query state machine. */
export type QueryAction<TData = unknown, TError = Error> =
	| { readonly type: 'fetch' }
	| { readonly type: 'success'; readonly data: TData }
	| { readonly type: 'error'; readonly error: TError }
	| { readonly type: 'invalidate' }
	| { readonly type: 'cancel' }
	| { readonly type: 'setState'; readonly state: Partial<QueryState<TData, TError>> };

/** Base options for configuring a Query. */
export interface QueryConfig<TData = unknown> {
	readonly queryKey: QueryKey;
	readonly queryFn: QueryFunction<TData>;
	readonly staleTime?: number;
	readonly gcTime?: number;
	readonly retry?: RetryConfig | number | boolean;
	readonly retryDelay?: number;
	readonly timeout?: number;
}

/** Options specific to a QueryObserver. */
export interface QueryObserverOptions<
	TData = unknown,
	TError = Error,
	TSelected = TData,
> extends QueryConfig<TData> {
	readonly enabled?: boolean;
	readonly select?: (data: TData) => TSelected;
	readonly placeholderData?:
		| TSelected
		| ((previousData: TSelected | undefined) => TSelected);
	readonly initialData?: TData | (() => TData);
	readonly refetchOnWindowFocus?: boolean;
	readonly refetchOnReconnect?: boolean;
	readonly refetchInterval?: number | false;
	readonly notifyOnChangeProps?: Array<keyof QueryObserverResult<TSelected, TError>>;
	readonly structuralSharing?: boolean;
}

/** Result object produced by a QueryObserver. */
export interface QueryObserverResult<TData = unknown, TError = Error> {
	readonly data: TData | undefined;
	readonly dataUpdatedAt: number;
	readonly error: TError | null;
	readonly errorUpdatedAt: number;
	readonly status: QueryStatus;
	readonly fetchStatus: FetchStatus;
	readonly isPending: boolean;
	readonly isLoading: boolean;
	readonly isSuccess: boolean;
	readonly isError: boolean;
	readonly isFetching: boolean;
	readonly isRefetching: boolean;
	readonly isStale: boolean;
	readonly isPlaceholderData: boolean;
	readonly fetchCount: number;
}

/** Function called when the observer result changes. */
export type QueryObserverListener<TData = unknown, TError = Error> = (
	result: QueryObserverResult<TData, TError>
) => void;

/** Snapshot of a query for external inspection. */
export interface QuerySnapshot<TData = unknown, TError = Error> {
	readonly queryKey: QueryKey;
	readonly state: QueryState<TData, TError>;
	readonly observerCount: number;
	readonly isActive: boolean;
}

/** Interface that the Query class expects from observers. */
export interface QueryObserver {
	readonly onQueryUpdate: () => void;
}
