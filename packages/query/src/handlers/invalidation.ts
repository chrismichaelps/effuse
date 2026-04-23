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

import { Effect } from 'effect';
import type {
	QueryHandlerDeps,
	QueryKey,
	InvalidatePatternInput,
} from './types.js';
import { getEntry, setEntry, notifySubscribersForKey } from './cache.js';
import { partialMatchKey } from '../utils/index.js';

const parseKey = (keyStr: string): QueryKey => JSON.parse(keyStr) as QueryKey;

/**
 * Mark a single cache entry as invalidated (stale).
 * The entry is NOT deleted — it remains visible to observers
 * while a background refetch is triggered via subscriber notification.
 */
export const invalidateKey = (
	deps: QueryHandlerDeps,
	keyStr: string
): Effect.Effect<void> =>
	Effect.sync(() => {
		const entry = getEntry<unknown>(deps, { keyStr });
		if (!entry) return;

		setEntry(deps, {
			keyStr,
			entry: {
				...entry,
				isInvalidated: true,
			},
		});

		notifySubscribersForKey(deps, keyStr);
	});

/**
 * Mark all entries matching the prefix pattern as invalidated.
 * Uses deep prefix matching so `['todos']` invalidates `['todos', {page:1}]`.
 */
export const invalidatePattern = (
	deps: QueryHandlerDeps,
	input: InvalidatePatternInput
): Effect.Effect<void> =>
	Effect.sync(() => {
		for (const keyStr of deps.internals.cache.keys()) {
			const key = parseKey(keyStr);
			if (partialMatchKey(key, input.pattern)) {
				const entry = getEntry<unknown>(deps, { keyStr });
				if (!entry) continue;

				setEntry(deps, {
					keyStr,
					entry: {
						...entry,
						isInvalidated: true,
					},
				});

				notifySubscribersForKey(deps, keyStr);
			}
		}
	});

/**
 * Mark every cache entry as invalidated.
 */
export const invalidateAll = (deps: QueryHandlerDeps): Effect.Effect<void> =>
	Effect.sync(() => {
		for (const keyStr of deps.internals.cache.keys()) {
			const entry = getEntry<unknown>(deps, { keyStr });
			if (!entry) continue;

			setEntry(deps, {
				keyStr,
				entry: {
					...entry,
					isInvalidated: true,
				},
			});

			notifySubscribersForKey(deps, keyStr);
		}
	});
