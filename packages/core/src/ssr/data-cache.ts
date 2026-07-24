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

/**
 * Data cache: memoises the expensive work itself (a query, an upstream fetch),
 * as opposed to the HTTP response wrapping it.
 *
 * This is Effuse's answer to a `"use cache"` style directive, expressed as an
 * explicit wrapper rather than a compiler-interpreted string:
 *
 * - The wrapped function keeps the **exact** parameter and return types of the
 *   original, so caching is visible in the source and checked by the compiler
 *   instead of hidden behind a magic string.
 * - It needs no build step, so it behaves identically in dev, test, and
 *   production, and is unit-testable in isolation.
 * - Arguments participate in the key, and tags may derive from the arguments,
 *   so invalidation is as granular as the data.
 * - Concurrent cold calls are coalesced into one execution, so an expiring hot
 *   key cannot stampede the datastore.
 *
 * Entries live in this process only, the same boundary a directive-based
 * in-memory cache has. Multi-instance deployments must invalidate each
 * instance or front the cache with a shared store.
 */

import { runOutsideSSRContext } from './use-head.js';

/** Freshness window for a cached value, in seconds. */
export interface CacheLife {
	/** Seconds the value is served without revalidating. */
	readonly stale: number;
	/**
	 * Additional seconds the value may be served *while* one refresh runs.
	 * Omit to expire immediately at the end of the fresh window.
	 */
	readonly expire?: number;
}

export interface CachedOptions<Args extends readonly unknown[]> {
	readonly life: CacheLife;
	/** Static tags, or tags derived from the call arguments. */
	readonly tags?: readonly string[] | ((...args: Args) => readonly string[]);
	/**
	 * Custom key for arguments that do not serialise stably (class instances,
	 * dates that should not participate, request objects).
	 */
	readonly key?: (...args: Args) => string;
	/**
	 * Deep-freeze the cached value so no caller can mutate what every later
	 * caller receives. Defaults to `true`; freezing happens once at store time,
	 * so the cost is amortised across every hit. Disable only for values that
	 * must stay mutable and are never shared.
	 */
	readonly freeze?: boolean;
}

export interface DataCacheOptions {
	/** Maximum entries retained before least-recently-used eviction. */
	readonly maxEntries?: number;
	/** Clock injection point; defaults to `Date.now`. */
	readonly now?: () => number;
}

export interface DataCache {
	/** Wraps `fn`, returning a function with the identical signature. */
	cached<Args extends readonly unknown[], Result>(
		fn: (...args: Args) => Promise<Result>,
		options: CachedOptions<Args>
	): (...args: Args) => Promise<Result>;
	/** Drops every entry carrying any of `tags`. */
	invalidateTags(tags: readonly string[]): void;
	/** Drops every entry. */
	clear(): void;
	/** Resolves once background revalidation has settled. */
	idle(): Promise<void>;
	/** Current entry count. */
	readonly size: number;
}

interface CacheEntry {
	key: string;
	value: unknown;
	freshUntil: number;
	staleUntil: number;
	tags: readonly string[];
	/** Intrusive LRU links. */
	prev: CacheEntry | undefined;
	next: CacheEntry | undefined;
}

const DEFAULT_MAX_ENTRIES = 1000;

/**
 * Stable argument serialisation. Object keys are sorted so `{a,b}` and `{b,a}`
 * produce one entry rather than two.
 */
const stableKey = (args: readonly unknown[]): string => {
	const encode = (value: unknown): string => {
		if (value === null) return 'null';
		if (value === undefined) return 'undefined';
		if (typeof value !== 'object') return `${typeof value}:${String(value)}`;
		if (Array.isArray(value)) return `[${value.map(encode).join(',')}]`;
		const record = value as Record<string, unknown>;
		const keys = Object.keys(record).sort();
		return `{${keys.map((k) => `${k}:${encode(record[k])}`).join(',')}}`;
	};
	return args.map(encode).join('|');
};

/**
 * Deep-freezes a cached value. A cached result is handed to every subsequent
 * caller, so a mutation by one caller would silently corrupt the data for all
 * of them — including privilege-shaped fields such as a roles array. Freezing
 * once at store time makes that impossible without paying a clone per hit.
 */
const deepFreeze = (value: unknown, seen: WeakSet<object>): void => {
	if (value === null || typeof value !== 'object') return;
	const target = value as object;
	if (seen.has(target)) return;
	seen.add(target);
	Object.freeze(target);
	for (const nested of Object.values(target as Record<string, unknown>)) {
		deepFreeze(nested, seen);
	}
};

let cacheSequence = 0;

export const createDataCache = (options: DataCacheOptions = {}): DataCache => {
	const maxEntries = options.maxEntries ?? DEFAULT_MAX_ENTRIES;
	const now = options.now ?? Date.now;

	const entries = new Map<string, CacheEntry>();
	/** Inverted tag index: invalidation costs the affected entries, not a scan. */
	const tagIndex = new Map<string, Set<string>>();
	/** In-flight runs for single-flight coalescing. */
	const inflight = new Map<string, Promise<unknown>>();
	const background = new Set<Promise<unknown>>();

	// LRU list: `head` is most recently used, `tail` is the eviction candidate.
	let head: CacheEntry | undefined;
	let tail: CacheEntry | undefined;

	const detach = (entry: CacheEntry): void => {
		if (entry.prev) entry.prev.next = entry.next;
		else head = entry.next;
		if (entry.next) entry.next.prev = entry.prev;
		else tail = entry.prev;
		entry.prev = undefined;
		entry.next = undefined;
	};

	const pushFront = (entry: CacheEntry): void => {
		entry.prev = undefined;
		entry.next = head;
		if (head) head.prev = entry;
		head = entry;
		tail ??= entry;
	};

	const touch = (entry: CacheEntry): void => {
		if (head === entry) return;
		detach(entry);
		pushFront(entry);
	};

	const remove = (entry: CacheEntry): void => {
		detach(entry);
		entries.delete(entry.key);
		for (const tag of entry.tags) {
			const keys = tagIndex.get(tag);
			if (!keys) continue;
			keys.delete(entry.key);
			if (keys.size === 0) tagIndex.delete(tag);
		}
	};

	const store = (
		key: string,
		value: unknown,
		life: CacheLife,
		tags: readonly string[]
	): void => {
		const existing = entries.get(key);
		if (existing) remove(existing);

		const timestamp = now();
		const entry: CacheEntry = {
			key,
			value,
			freshUntil: timestamp + life.stale * 1000,
			staleUntil: timestamp + (life.stale + (life.expire ?? 0)) * 1000,
			tags,
			prev: undefined,
			next: undefined,
		};

		entries.set(key, entry);
		pushFront(entry);
		for (const tag of tags) {
			let keys = tagIndex.get(tag);
			if (!keys) {
				keys = new Set<string>();
				tagIndex.set(tag, keys);
			}
			keys.add(key);
		}

		while (entries.size > maxEntries && tail) remove(tail);
	};

	/**
	 * Single-flight: concurrent callers for a key share one execution, and the
	 * in-flight record is always cleared — including on rejection, so a failure
	 * never poisons the key.
	 */
	const coalesce = <Result>(
		key: string,
		run: () => Promise<Result>
	): Promise<Result> => {
		const existing = inflight.get(key) as Promise<Result> | undefined;
		if (existing) return existing;

		const pending = run().finally(() => {
			inflight.delete(key);
		});
		inflight.set(key, pending);
		return pending;
	};

	const cache: DataCache = {
		cached<Args extends readonly unknown[], Result>(
			fn: (...args: Args) => Promise<Result>,
			cachedOptions: CachedOptions<Args>
		): (...args: Args) => Promise<Result> {
			// Namespace by wrapper instance so two functions sharing an argument
			// shape never collide on one key.
			const namespace = `fn${String((cacheSequence += 1))}`;
			const { life, tags, key: keyFn } = cachedOptions;
			const shouldFreeze = cachedOptions.freeze !== false;

			const resolveTags = (args: Args): readonly string[] =>
				typeof tags === 'function' ? tags(...args) : (tags ?? []);

			/**
			 * Runs the wrapped function detached from the request context and
			 * freezes the result before it is stored. A cached value outlives the
			 * request that produced it, so it must neither observe that request
			 * nor be mutable afterwards.
			 */
			const execute = async (args: Args): Promise<Result> => {
				const value = await runOutsideSSRContext(() => fn(...args));
				if (shouldFreeze) deepFreeze(value, new WeakSet<object>());
				return value;
			};

			return (...args: Args): Promise<Result> => {
				const argKey = keyFn ? keyFn(...args) : stableKey(args);
				const key = `${namespace}:${argKey}`;

				const entry = entries.get(key);
				if (entry) {
					const timestamp = now();
					if (timestamp < entry.freshUntil) {
						touch(entry);
						return Promise.resolve(entry.value as Result);
					}
					if (timestamp < entry.staleUntil) {
						touch(entry);
						// Refresh behind the stale serve, coalesced so a burst of
						// stale reads triggers exactly one run.
						if (!inflight.has(key)) {
							const refresh = coalesce(key, async () => {
								const value = await execute(args);
								store(key, value, life, resolveTags(args));
								return value;
							}).catch(() => undefined);
							background.add(refresh);
							void refresh.finally(() => background.delete(refresh));
						}
						return Promise.resolve(entry.value as Result);
					}
					remove(entry);
				}

				return coalesce(key, async () => {
					const value = await execute(args);
					store(key, value, life, resolveTags(args));
					return value;
				});
			};
		},

		invalidateTags(tags) {
			for (const tag of tags) {
				const keys = tagIndex.get(tag);
				if (!keys) continue;
				// Copy: remove() mutates the index while we iterate.
				for (const key of [...keys]) {
					const entry = entries.get(key);
					if (entry) remove(entry);
				}
				tagIndex.delete(tag);
			}
		},

		clear() {
			entries.clear();
			tagIndex.clear();
			head = undefined;
			tail = undefined;
		},

		async idle() {
			while (background.size > 0) {
				await Promise.allSettled([...background]);
			}
		},

		get size() {
			return entries.size;
		},
	};

	return cache;
};
