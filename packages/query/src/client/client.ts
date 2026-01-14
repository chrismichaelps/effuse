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

import { Context, Effect, Layer, Ref, Option, pipe } from 'effect';
import type { QueryKey, CacheEntry, QueryStatus } from './types.js';
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
	invalidatePattern,
	invalidateAll,
	addSubscriber,
	notifySubscribersForKey,
	type QueryCacheInternals,
	type QueryHandlerDeps,
} from '../handlers/index.js';

const serializeKey = (key: QueryKey): string => JSON.stringify(key);

const parseKey = (keyStr: string): QueryKey => JSON.parse(keyStr);

export interface QueryClientApi {
	readonly get: <T>(key: QueryKey) => CacheEntry<T> | undefined;
	readonly set: <T>(key: QueryKey, entry: CacheEntry<T>) => void;
	readonly remove: (key: QueryKey) => boolean;
	readonly has: (key: QueryKey) => boolean;
	readonly clear: () => void;
	readonly getQueryKeys: () => QueryKey[];
	readonly invalidate: (key: QueryKey) => Effect.Effect<void>;
	readonly invalidateQueries: (pattern: QueryKey) => Effect.Effect<void>;
	readonly invalidateAll: () => Effect.Effect<void>;
	readonly subscribe: (key: QueryKey, callback: () => void) => () => void;
	readonly notifySubscribers: (key: QueryKey) => void;
	readonly prefetch: <T>(
		key: QueryKey,
		queryFn: () => Promise<T>,
		staleTime?: number
	) => Effect.Effect<void>;
	readonly isStale: (key: QueryKey, staleTime?: number) => boolean;
	readonly getSnapshot: <T>(key: QueryKey) => CacheEntry<T> | undefined;
	readonly setOptimistic: <T>(
		key: QueryKey,
		data: T
	) => CacheEntry<T> | undefined;
	readonly rollback: <T>(key: QueryKey, snapshot: CacheEntry<T>) => void;
}

export class QueryClient extends Context.Tag('effuse/query/QueryClient')<
	QueryClient,
	QueryClientApi
>() {}

const createQueryClientImpl = (): QueryClientApi => {
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
	};

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

		invalidate: (key: QueryKey): Effect.Effect<void> => {
			const keyStr = serializeKey(key);
			return invalidateKey(deps, keyStr);
		},

		invalidateQueries: (pattern: QueryKey): Effect.Effect<void> => {
			return invalidatePattern(deps, { pattern });
		},

		invalidateAll: (): Effect.Effect<void> => {
			return invalidateAll(deps);
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
		): Effect.Effect<void> =>
			Effect.gen(function* () {
				const keyStr = serializeKey(key);
				const existing = getEntry<T>(deps, { keyStr });

				if (existing && Date.now() - existing.dataUpdatedAt <= staleTime) {
					return;
				}

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
			}).pipe(Effect.catchAll(() => Effect.void)),

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
	};
};

export const QueryClientLive: Layer.Layer<QueryClient> = Layer.effect(
	QueryClient,
	Effect.gen(function* () {
		const clientRef = yield* Ref.make(createQueryClientImpl());
		return yield* Ref.get(clientRef);
	})
);

let globalQueryClient: QueryClientApi | null = null;

export const setGlobalQueryClient = (client: QueryClientApi): void => {
	globalQueryClient = client;
};

export const getGlobalQueryClient = (): QueryClientApi => {
	if (!globalQueryClient) {
		globalQueryClient = createQueryClientImpl();
	}
	return globalQueryClient;
};

export const createQueryClient = (): QueryClientApi => {
	return createQueryClientImpl();
};

export const invalidateQuery = (key: QueryKey): void => {
	const client = getGlobalQueryClient();
	Effect.runFork(client.invalidate(key));
};

export const invalidateQueries = (pattern: QueryKey): void => {
	const client = getGlobalQueryClient();
	Effect.runFork(client.invalidateQueries(pattern));
};

export const invalidateAllQueries = (): void => {
	const client = getGlobalQueryClient();
	Effect.runFork(client.invalidateAll());
};

export const invalidateQueryAsync = (key: QueryKey): Promise<void> => {
	const client = getGlobalQueryClient();
	return Effect.runPromise(client.invalidate(key));
};

export const invalidateQueriesAsync = (pattern: QueryKey): Promise<void> => {
	const client = getGlobalQueryClient();
	return Effect.runPromise(client.invalidateQueries(pattern));
};

export const invalidateAllAsync = (): Promise<void> => {
	const client = getGlobalQueryClient();
	return Effect.runPromise(client.invalidateAll());
};
