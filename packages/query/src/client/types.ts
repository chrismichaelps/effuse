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

import type { Effect } from 'effect';
import type { RetryConfig } from '../execution/index.js';

export type QueryKey = readonly unknown[];

export type QueryStatus = 'idle' | 'loading' | 'success' | 'error';

export type FetchStatus = 'idle' | 'fetching' | 'paused';

/** Query function that returns either a Promise or an Effect. */
export type QueryFunction<T> = () => Promise<T> | Effect.Effect<T, Error, never>;

export interface CacheEntry<T = unknown> {
	readonly data: T;
	readonly dataUpdatedAt: number;
	readonly status: QueryStatus;
	readonly error?: unknown;
	readonly fetchCount: number;
	/** Marked stale by invalidateQueries; overrides staleTime. */
	readonly isInvalidated?: boolean;
	/** Timestamp when the error was last set. */
	readonly errorUpdatedAt?: number;
	/** Arbitrary metadata attached to the query. */
	readonly meta?: unknown;
	/** Current fetch status for the query. */
	readonly fetchStatus?: FetchStatus;
}

export interface QueryOptions<T = unknown> {
	readonly queryKey: QueryKey;
	readonly queryFn: QueryFunction<T>;
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
	readonly placeholderData?: T | ((previousData: T | undefined) => T);
	/**
	 * Initial data to use before the first fetch completes.
	 * When provided, the hook's `data` is guaranteed to be defined.
	 */
	readonly initialData?: T | (() => T);
	/**
	 * Explicit QueryClient instance. If omitted, the hook will inject
	 * from the nearest Effuse component scope via provideQueryClient(),
	 * falling back to the global singleton.
	 */
	readonly client?: import('./client.js').QueryClientApi;
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
	/**
	 * Explicit QueryClient instance. If omitted, the hook will inject
	 * from the nearest Effuse component scope via provideQueryClient(),
	 * falling back to the global singleton.
	 */
	readonly client?: import('./client.js').QueryClientApi;
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

/** Information about a cached query exposed to filter predicates. */
export interface QueryInfo {
	readonly queryKey: QueryKey;
	readonly state: CacheEntry<unknown>;
	/** Whether the query currently has active subscribers. */
	readonly isActive: boolean;
	/** Whether the query is currently stale. */
	readonly isStale: boolean;
}

/** Query filter options used by `invalidateQueries`, `removeQueries`, and `refetchQueries`. */
export interface QueryFilters {
	/**
	 * Match queries with a key that starts with this prefix.
	 * Use `exact: true` to require an exact match.
	 */
	readonly queryKey?: QueryKey;
	/**
	 * When `true`, only match queries with the exact `queryKey`.
	 * When `false` or omitted, prefix matching is used.
	 */
	readonly exact?: boolean;
	/**
	 * Filter by active status. Active queries have at least one subscriber.
	 */
	readonly type?: 'all' | 'active' | 'inactive';
	/**
	 * Filter by stale status.
	 */
	readonly stale?: boolean;
	/**
	 * Filter by fetch status.
	 */
	readonly fetchStatus?: FetchStatus;
	/**
	 * Custom predicate evaluated against each cached query.
	 * Receives the full `QueryInfo` for the query.
	 */
	readonly predicate?: (query: QueryInfo) => boolean;
	/**
	 * Which matched queries should be refetched after invalidation.
	 * - `'active'` — only queries with active subscribers
	 * - `'inactive'` — only queries without active subscribers
	 * - `'all'` — all matched queries (default)
	 * - `'none'` — do not refetch; only mark stale
	 */
	readonly refetchType?: 'active' | 'inactive' | 'all' | 'none';
}
