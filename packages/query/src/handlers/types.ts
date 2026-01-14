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

import type { CacheEntry } from '../client/types.js';

export type QueryKey = ReadonlyArray<unknown>;

export interface QueryCacheInternals {
	cache: Map<string, CacheEntry<unknown>>;
	subscribers: Map<string, Set<() => void>>;
	gcTimers: Map<string, ReturnType<typeof setTimeout>>;
}

export interface QueryCacheConfig {
	gcTimeMs: number;
	staleTimeMs: number;
}

export interface QueryHandlerDeps {
	internals: QueryCacheInternals;
	config: QueryCacheConfig;
}

export interface GetEntryInput {
	keyStr: string;
}

export interface SetEntryInput<T> {
	keyStr: string;
	entry: CacheEntry<T>;
}

export interface RemoveEntryInput {
	keyStr: string;
}

export interface InvalidatePatternInput {
	pattern: QueryKey;
}

export interface SubscribeInput {
	keyStr: string;
	callback: () => void;
}
