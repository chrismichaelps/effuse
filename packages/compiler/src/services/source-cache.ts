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
import { PerformanceThresholds } from '../constants/index.js';

export { createContentHash } from '../utils/index.js';

interface CacheEntry<T> {
	readonly value: T;
	readonly timestamp: number;
	readonly hash: string;
}

export interface SourceCacheService {
	readonly get: <T>(
		key: string,
		contentHash: string
	) => Effect.Effect<T | null>;

	readonly set: <T>(
		key: string,
		contentHash: string,
		value: T
	) => Effect.Effect<void>;

	readonly invalidate: (key: string) => Effect.Effect<void>;

	readonly clear: () => Effect.Effect<void>;

	readonly stats: () => Effect.Effect<{
		readonly size: number;
		readonly hits: number;
		readonly misses: number;
	}>;
}

export class SourceCache extends Context.Tag('effuse/compiler/SourceCache')<
	SourceCache,
	SourceCacheService
>() {}

const makeSourceCache = Effect.gen(function* () {
	const cache = yield* Ref.make(new Map<string, CacheEntry<unknown>>());
	const statsRef = yield* Ref.make({ hits: 0, misses: 0 });

	const isExpired = (entry: CacheEntry<unknown>): boolean => {
		return Date.now() - entry.timestamp > PerformanceThresholds.CACHE_TTL_MS;
	};

	return {
		get: <T>(key: string, contentHash: string) =>
			Effect.gen(function* () {
				const cacheMap = yield* Ref.get(cache);
				const entry = cacheMap.get(key) as CacheEntry<T> | undefined;

				if (!entry) {
					yield* Ref.update(statsRef, (s) => ({ ...s, misses: s.misses + 1 }));
					return null;
				}

				if (entry.hash !== contentHash || isExpired(entry)) {
					yield* Ref.update(statsRef, (s) => ({ ...s, misses: s.misses + 1 }));
					return null;
				}

				yield* Ref.update(statsRef, (s) => ({ ...s, hits: s.hits + 1 }));
				return entry.value;
			}),

		set: <T>(key: string, contentHash: string, value: T) =>
			Effect.gen(function* () {
				const entry: CacheEntry<T> = {
					value,
					timestamp: Date.now(),
					hash: contentHash,
				};
				yield* Ref.update(cache, (m) => {
					const newMap = new Map(m);
					newMap.set(key, entry);
					return newMap;
				});
			}),

		invalidate: (key: string) =>
			Ref.update(cache, (m) => {
				const newMap = new Map(m);
				newMap.delete(key);
				return newMap;
			}),

		clear: () => Ref.set(cache, new Map()),

		stats: () =>
			Effect.gen(function* () {
				const cacheMap = yield* Ref.get(cache);
				const { hits, misses } = yield* Ref.get(statsRef);
				return { size: cacheMap.size, hits, misses };
			}),
	} satisfies SourceCacheService;
});

export const SourceCacheLive = Layer.effect(SourceCache, makeSourceCache);
