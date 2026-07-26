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

import { computed, signal, type ReadonlySignal } from '@effuse/core';
import { Context, Effect, Layer, Ref, Option, pipe } from 'effect';
import type {
	QueryKey,
	CacheEntry,
	QueryStatus,
	QueryFilters,
	QueryCacheSnapshot,
} from './types.js';
import { DEFAULT_GC_TIME_MS, DEFAULT_STALE_TIME_MS } from '../config/index.js';
import { QueryFetchError } from '../errors/index.js';
import {
	getEntry,
	setEntry,
	removeEntry,
	hasEntry,
	clearCache,
	getQueryKeys,
	isStale,
	invalidateKey,
	invalidateAll,
	invalidateWithFilters,
	removeWithFilters,
	notifyWithFilters,
	addSubscriber,
	notifySubscribersForKey,
	type QueryCacheInternals,
	type QueryHandlerDeps,
} from '../handlers/index.js';
import { QueryCache, MutationCache, type Query } from '../core/index.js';
import type { QueryConfig } from '../core/types.js';
import type { DehydratedState, DehydrateOptions } from '../core/hydration.js';

const serializeKey = (key: QueryKey): string => JSON.stringify(key);

const parseKey = (keyStr: string): QueryKey => JSON.parse(keyStr);

const normalizeFilters = (filters: QueryFilters | QueryKey): QueryFilters => {
	if (Array.isArray(filters)) {
		return { queryKey: filters };
	}
	return filters as QueryFilters;
};

export interface QueryClientApi {
	readonly get: <T>(key: QueryKey) => CacheEntry<T> | undefined;
	readonly set: <T>(key: QueryKey, entry: CacheEntry<T>) => void;
	readonly remove: (key: QueryKey) => boolean;
	readonly has: (key: QueryKey) => boolean;
	readonly clear: () => void;
	readonly getQueryKeys: () => QueryKey[];
	/** Monotonic signal that changes whenever cache metadata changes. */
	readonly cacheVersion: ReadonlySignal<number>;
	/** Reactive cache metadata for dashboards and devtools. */
	readonly cacheSnapshot: ReadonlySignal<QueryCacheSnapshot>;
	/** Read cache metadata outside reactive contexts. */
	readonly getCacheSnapshot: () => QueryCacheSnapshot;
	readonly invalidate: (key: QueryKey) => Promise<void>;
	readonly invalidateQueries: (
		filters: QueryFilters | QueryKey
	) => Promise<void>;
	readonly invalidateAll: () => Promise<void>;
	readonly refetchQueries: (filters?: QueryFilters | QueryKey) => void;
	readonly subscribe: (key: QueryKey, callback: () => void) => () => void;
	readonly notifySubscribers: (key: QueryKey) => void;
	readonly prefetch: <T>(
		key: QueryKey,
		queryFn: () => Promise<T>,
		staleTime?: number
	) => Promise<void>;
	readonly isStale: (key: QueryKey, staleTime?: number) => boolean;
	readonly getSnapshot: <T>(key: QueryKey) => CacheEntry<T> | undefined;
	readonly setOptimistic: <T>(
		key: QueryKey,
		data: T
	) => CacheEntry<T> | undefined;
	readonly rollback: <T>(key: QueryKey, snapshot: CacheEntry<T>) => void;
	/**
	 * Directly set query data in the cache.
	 * `updater` can be the new data or a function receiving the old data.
	 */
	readonly setQueryData: <T>(
		key: QueryKey,
		updater: T | ((old: T | undefined) => T)
	) => CacheEntry<T> | undefined;
	/** Read only the data for a query key. */
	readonly getQueryData: <T>(key: QueryKey) => T | undefined;
	/** Read the full cache entry (state) for a query key. */
	readonly getQueryState: <T>(key: QueryKey) => CacheEntry<T> | undefined;
	/** Remove queries matching the given filters. */
	readonly removeQueries: (filters: QueryFilters | QueryKey) => void;
	/** Get or create a Query from the new QueryCache. */
	readonly getQuery: <TData, TError = Error>(
		config: QueryConfig<TData>
	) => Query<TData, TError>;
	/** The underlying QueryCache instance. */
	readonly queryCache: QueryCache;
	/** The underlying MutationCache instance. */
	readonly mutationCache: MutationCache;
	/** Serialize cache state to a dehydrated object for SSR. */
	readonly dehydrate: (options?: DehydrateOptions) => DehydratedState;
	/** Restore cache state from a dehydrated object. */
	readonly hydrate: (state: DehydratedState, options?: DehydrateOptions) => void;
}

export class QueryClient extends Context.Tag('effuse/query/QueryClient')<
	QueryClient,
	QueryClientApi
>() {}

const createQueryClientImpl = (): QueryClientApi => {
	const cacheVersion = signal(0);
	const bumpCacheVersion = (): void => {
		cacheVersion.value += 1;
	};
	const internals: QueryCacheInternals = {
		cache: new Map(),
		subscribers: new Map(),
		gcTimers: new Map(),
	};

	const deps: QueryHandlerDeps = {
		internals,
		config: {
			gcTimeMs: DEFAULT_GC_TIME_MS,
			staleTimeMs: DEFAULT_STALE_TIME_MS,
		},
		onCacheChange: bumpCacheVersion,
	};

	const queryCache = new QueryCache();
	const mutationCache = new MutationCache();
	queryCache.subscribe(bumpCacheVersion);
	mutationCache.subscribe(bumpCacheVersion);

	const getCacheSnapshot = (): QueryCacheSnapshot => {
		const version = cacheVersion.value;
		const queryKeys = getQueryKeys(deps).map(parseKey);
		const cacheEntries = Array.from(internals.cache.values());
		const observerQueries = queryCache.getAll();

		const staleCacheEntries = cacheEntries.filter((entry) => {
			if (entry.isInvalidated) return true;
			return Date.now() - entry.dataUpdatedAt > deps.config.staleTimeMs;
		});
		const fetchingCacheEntries = cacheEntries.filter(
			(entry) => entry.fetchStatus === 'fetching'
		);

		return {
			version,
			queryKeys,
			queryCount: queryKeys.length,
			observerQueryCount: queryCache.size,
			activeQueryCount: observerQueries.filter((query) => query.isActive).length,
			staleQueryCount:
				staleCacheEntries.length +
				observerQueries.filter((query) => query.isStale).length,
			fetchingQueryCount:
				fetchingCacheEntries.length +
				observerQueries.filter((query) => query.isFetching).length,
			mutationCount: mutationCache.size,
			pendingMutationCount: mutationCache.pendingCount,
		};
	};
	const cacheSnapshot = computed(getCacheSnapshot);

	return {
		get: <T>(key: QueryKey): CacheEntry<T> | undefined => {
			const keyStr = serializeKey(key);
			return getEntry<T>(deps, { keyStr });
		},

		set: <T>(key: QueryKey, entry: CacheEntry<T>): void => {
			const keyStr = serializeKey(key);
			setEntry(deps, { keyStr, entry });
		},

		remove: (key: QueryKey): boolean => {
			const keyStr = serializeKey(key);
			return removeEntry(deps, { keyStr });
		},

		has: (key: QueryKey): boolean => {
			const keyStr = serializeKey(key);
			return hasEntry(deps, { keyStr });
		},

		clear: (): void => {
			clearCache(deps);
		},

		getQueryKeys: (): QueryKey[] => {
			return getQueryKeys(deps).map(parseKey);
		},

		cacheVersion,

		cacheSnapshot,

		getCacheSnapshot,

		invalidate: (key: QueryKey): Promise<void> => {
			const keyStr = serializeKey(key);
			return Effect.runPromise(invalidateKey(deps, keyStr));
		},

		invalidateQueries: (
			filters: QueryFilters | QueryKey
		): Promise<void> => {
			return Effect.runPromise(
				invalidateWithFilters(deps, normalizeFilters(filters))
			);
		},

		invalidateAll: (): Promise<void> => {
			return Effect.runPromise(invalidateAll(deps));
		},

		refetchQueries: (filters?: QueryFilters | QueryKey): void => {
			const normalized: QueryFilters =
				filters === undefined ? {} : normalizeFilters(filters);
			notifyWithFilters(deps, normalized);
		},

		subscribe: (key: QueryKey, callback: () => void): (() => void) => {
			const keyStr = serializeKey(key);
			return addSubscriber(deps, { keyStr, callback });
		},

		notifySubscribers: (key: QueryKey): void => {
			const keyStr = serializeKey(key);
			notifySubscribersForKey(deps, keyStr);
		},

		prefetch: <T>(
			key: QueryKey,
			queryFn: () => Promise<T>,
			staleTime: number = DEFAULT_STALE_TIME_MS
		): Promise<void> => {
			const keyStr = serializeKey(key);
			const existing = getEntry<T>(deps, { keyStr });

			if (existing && Date.now() - existing.dataUpdatedAt <= staleTime) {
				return Promise.resolve();
			}

			const effect = Effect.gen(function* () {
				const data = yield* Effect.tryPromise({
					try: () => queryFn(),
					catch: (error) =>
						new QueryFetchError({
							message: error instanceof Error ? error.message : String(error),
							cause: error,
						}),
				});

				const status: QueryStatus = 'success';
				const fetchCount =
					pipe(
						Option.fromNullable(existing),
						Option.map((e) => e.fetchCount),
						Option.getOrElse(() => 0)
					) + 1;

				const entry: CacheEntry<T> = {
					data,
					dataUpdatedAt: Date.now(),
					status,
					fetchCount,
				};

				setEntry(deps, { keyStr, entry });
			});

			return Effect.runPromise(effect).catch(() => undefined);
		},

		isStale: (key: QueryKey, staleTime?: number): boolean => {
			const keyStr = serializeKey(key);
			return isStale(deps, { keyStr }, staleTime);
		},

		getSnapshot: <T>(key: QueryKey): CacheEntry<T> | undefined => {
			const keyStr = serializeKey(key);
			const entry = getEntry<T>(deps, { keyStr });
			if (!entry) return undefined;
			return { ...entry };
		},

		setOptimistic: <T>(key: QueryKey, data: T): CacheEntry<T> | undefined => {
			const keyStr = serializeKey(key);
			const previous = getEntry<T>(deps, { keyStr });

			const status: QueryStatus = 'success';
			const fetchCount = pipe(
				Option.fromNullable(previous),
				Option.map((p) => p.fetchCount),
				Option.getOrElse(() => 0)
			);

			const entry: CacheEntry<T> = {
				data,
				dataUpdatedAt: Date.now(),
				status,
				fetchCount,
			};

			setEntry(deps, { keyStr, entry });
			return previous;
		},

		rollback: <T>(key: QueryKey, snapshot: CacheEntry<T>): void => {
			const keyStr = serializeKey(key);
			setEntry(deps, { keyStr, entry: snapshot });
		},

		setQueryData: <T>(
			key: QueryKey,
			updater: T | ((old: T | undefined) => T)
		): CacheEntry<T> | undefined => {
			const keyStr = serializeKey(key);
			const existing = getEntry<T>(deps, { keyStr });
			const prevData = existing?.data;
			const nextData =
				typeof updater === 'function'
					? (updater as (old: T | undefined) => T)(prevData)
					: updater;

			const entry: CacheEntry<T> = {
				data: nextData,
				dataUpdatedAt: Date.now(),
				status: 'success',
				fetchCount: existing?.fetchCount ?? 0,
				meta: existing?.meta,
			};

			setEntry(deps, { keyStr, entry });
			return entry;
		},

		getQueryData: <T>(key: QueryKey): T | undefined => {
			const keyStr = serializeKey(key);
			return getEntry<T>(deps, { keyStr })?.data;
		},

		getQueryState: <T>(key: QueryKey): CacheEntry<T> | undefined => {
			const keyStr = serializeKey(key);
			return getEntry<T>(deps, { keyStr });
		},

		removeQueries: (filters: QueryFilters | QueryKey): void => {
			removeWithFilters(deps, normalizeFilters(filters));
		},

		getQuery: <TData, TError = Error>(
			config: QueryConfig<TData>
		): Query<TData, TError> => {
			const query = queryCache.getOrCreate(config);

			// Seed from old cache if present and query is fresh
			const keyStr = serializeKey(config.queryKey);
			const existing = getEntry<TData>(deps, { keyStr });
			if (
				existing &&
				query.currentState.fetchCount === 0 &&
				existing.data !== undefined
			) {
				query.setState({
					data: existing.data,
					status: existing.status === 'error' ? 'error' : 'success',
					dataUpdatedAt: existing.dataUpdatedAt,
					fetchCount: existing.fetchCount ?? 0,
					isInvalidated: existing.isInvalidated ?? false,
					...(existing.error
						? { error: existing.error as unknown as Error, errorUpdatedAt: existing.errorUpdatedAt ?? Date.now() }
						: {}),
				});
			}

			return query as Query<TData, TError>;
		},

		queryCache,
		mutationCache,

		dehydrate: (options?: DehydrateOptions): DehydratedState => {
			return queryCache.dehydrate(options);
		},

		hydrate: (state: DehydratedState, options?: DehydrateOptions): void => {
			queryCache.hydrate(state, options);
		},
	};
};

export const QueryClientLive: Layer.Layer<QueryClient> = Layer.effect(
	QueryClient,
	Effect.gen(function* () {
		const clientRef = yield* Ref.make(createQueryClientImpl());
		return yield* Ref.get(clientRef);
	})
);

export const createQueryClient = (): QueryClientApi => {
	return createQueryClientImpl();
};
