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

import { Context, Effect, Layer, Ref } from 'effect';
import type { QueryKey, CacheEntry, QueryStatus } from './types.js';
import { DEFAULT_GC_TIME_MS, DEFAULT_STALE_TIME_MS } from '../config/index.js';

const serializeKey = (key: QueryKey): string => JSON.stringify(key);

const matchesKeyPattern = (pattern: QueryKey, key: QueryKey): boolean => {
	if (pattern.length > key.length) return false;
	for (let i = 0; i < pattern.length; i++) {
		if (JSON.stringify(pattern[i]) !== JSON.stringify(key[i])) {
			return false;
		}
	}
	return true;
};

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
	const cache = new Map<string, CacheEntry<unknown>>();
	const subscribers = new Map<string, Set<() => void>>();
	const gcTimers = new Map<string, ReturnType<typeof setTimeout>>();

	const scheduleGC = (keyStr: string): void => {
		const existing = gcTimers.get(keyStr);
		if (existing) {
			clearTimeout(existing);
		}
		const timer = setTimeout(() => {
			const subs = subscribers.get(keyStr);
			if (!subs || subs.size === 0) {
				cache.delete(keyStr);
				subscribers.delete(keyStr);
				gcTimers.delete(keyStr);
			}
		}, DEFAULT_GC_TIME_MS);
		gcTimers.set(keyStr, timer);
	};

	const notifySubscribersForKey = (keyStr: string): void => {
		const subs = subscribers.get(keyStr);
		if (subs) {
			for (const callback of subs) {
				callback();
			}
		}
	};

	return {
		get: <T>(key: QueryKey): CacheEntry<T> | undefined => {
			const keyStr = serializeKey(key);
			return cache.get(keyStr) as CacheEntry<T> | undefined;
		},

		set: <T>(key: QueryKey, entry: CacheEntry<T>): void => {
			const keyStr = serializeKey(key);
			cache.set(keyStr, entry as CacheEntry<unknown>);
			scheduleGC(keyStr);
			notifySubscribersForKey(keyStr);
		},

		remove: (key: QueryKey): boolean => {
			const keyStr = serializeKey(key);
			const timer = gcTimers.get(keyStr);
			if (timer) {
				clearTimeout(timer);
				gcTimers.delete(keyStr);
			}
			const result = cache.delete(keyStr);
			notifySubscribersForKey(keyStr);
			return result;
		},

		has: (key: QueryKey): boolean => {
			const keyStr = serializeKey(key);
			return cache.has(keyStr);
		},

		clear: (): void => {
			for (const timer of gcTimers.values()) {
				clearTimeout(timer);
			}
			gcTimers.clear();
			cache.clear();
			for (const subs of subscribers.values()) {
				for (const callback of subs) {
					callback();
				}
			}
		},

		getQueryKeys: (): QueryKey[] => {
			const keys: QueryKey[] = [];
			for (const keyStr of cache.keys()) {
				keys.push(JSON.parse(keyStr) as QueryKey);
			}
			return keys;
		},

		invalidate: (key: QueryKey): Effect.Effect<void> =>
			Effect.sync(() => {
				const keyStr = serializeKey(key);
				cache.delete(keyStr);
				notifySubscribersForKey(keyStr);
			}),

		invalidateQueries: (pattern: QueryKey): Effect.Effect<void> =>
			Effect.sync(() => {
				for (const keyStr of cache.keys()) {
					const key = JSON.parse(keyStr) as QueryKey;
					if (matchesKeyPattern(pattern, key)) {
						cache.delete(keyStr);
						notifySubscribersForKey(keyStr);
					}
				}
			}),

		invalidateAll: (): Effect.Effect<void> =>
			Effect.sync(() => {
				const allKeys = Array.from(cache.keys());
				cache.clear();
				for (const keyStr of allKeys) {
					notifySubscribersForKey(keyStr);
				}
			}),

		subscribe: (key: QueryKey, callback: () => void): (() => void) => {
			const keyStr = serializeKey(key);
			let subs = subscribers.get(keyStr);
			if (!subs) {
				subs = new Set();
				subscribers.set(keyStr, subs);
			}
			subs.add(callback);
			return () => {
				subs?.delete(callback);
				if (subs?.size === 0) {
					subscribers.delete(keyStr);
				}
			};
		},

		notifySubscribers: (key: QueryKey): void => {
			const keyStr = serializeKey(key);
			notifySubscribersForKey(keyStr);
		},

		prefetch: <T>(
			key: QueryKey,
			queryFn: () => Promise<T>,
			staleTime: number = DEFAULT_STALE_TIME_MS
		): Effect.Effect<void> =>
			Effect.gen(function* () {
				const keyStr = serializeKey(key);
				const existing = cache.get(keyStr) as CacheEntry<T> | undefined;

				if (existing && Date.now() - existing.dataUpdatedAt <= staleTime) {
					return;
				}

				const data = yield* Effect.tryPromise({
					try: () => queryFn(),
					catch: (error) =>
						new Error(error instanceof Error ? error.message : String(error)),
				});

				const entry: CacheEntry<T> = {
					data,
					dataUpdatedAt: Date.now(),
					status: 'success' as QueryStatus,
					fetchCount: (existing?.fetchCount ?? 0) + 1,
				};

				cache.set(keyStr, entry as CacheEntry<unknown>);
				scheduleGC(keyStr);
			}).pipe(Effect.catchAll(() => Effect.void)),

		isStale: (
			key: QueryKey,
			staleTime: number = DEFAULT_STALE_TIME_MS
		): boolean => {
			const keyStr = serializeKey(key);
			const entry = cache.get(keyStr);
			if (!entry) return true;
			return Date.now() - entry.dataUpdatedAt > staleTime;
		},

		getSnapshot: <T>(key: QueryKey): CacheEntry<T> | undefined => {
			const keyStr = serializeKey(key);
			const entry = cache.get(keyStr);
			return entry ? ({ ...entry } as CacheEntry<T>) : undefined;
		},

		setOptimistic: <T>(key: QueryKey, data: T): CacheEntry<T> | undefined => {
			const keyStr = serializeKey(key);
			const previous = cache.get(keyStr) as CacheEntry<T> | undefined;

			const entry: CacheEntry<T> = {
				data,
				dataUpdatedAt: Date.now(),
				status: 'success' as QueryStatus,
				fetchCount: previous?.fetchCount ?? 0,
			};

			cache.set(keyStr, entry as CacheEntry<unknown>);
			notifySubscribersForKey(keyStr);

			return previous;
		},

		rollback: <T>(key: QueryKey, snapshot: CacheEntry<T>): void => {
			const keyStr = serializeKey(key);
			cache.set(keyStr, snapshot as CacheEntry<unknown>);
			notifySubscribersForKey(keyStr);
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

// Query client factory
export const createQueryClient = (): QueryClientApi => {
	return createQueryClientImpl();
};

// Invalidate single query by exact key
export const invalidateQuery = (key: QueryKey): void => {
	const client = getGlobalQueryClient();
	Effect.runFork(client.invalidate(key));
};

// Invalidate queries by key pattern
export const invalidateQueries = (pattern: QueryKey): void => {
	const client = getGlobalQueryClient();
	Effect.runFork(client.invalidateQueries(pattern));
};

// Invalidate all cached queries
export const invalidateAll = (): void => {
	const client = getGlobalQueryClient();
	Effect.runFork(client.invalidateAll());
};

// Invalidate single query by exact key
export const invalidateQueryAsync = async (key: QueryKey): Promise<void> => {
	const client = getGlobalQueryClient();
	await Effect.runPromise(client.invalidate(key));
};

// Invalidate queries by key pattern
export const invalidateQueriesAsync = async (
	pattern: QueryKey
): Promise<void> => {
	const client = getGlobalQueryClient();
	await Effect.runPromise(client.invalidateQueries(pattern));
};

// Invalidate all cached queries
export const invalidateAllAsync = async (): Promise<void> => {
	const client = getGlobalQueryClient();
	await Effect.runPromise(client.invalidateAll());
};
