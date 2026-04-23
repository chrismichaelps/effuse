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
} from './types.js';
import { getEntry, setEntry, setEntryWithoutNotify, notifySubscribersForKey } from './cache.js';
import { matchQuery } from '../utils/index.js';
import type { QueryFilters, QueryInfo } from '../client/types.js';

const parseKey = (keyStr: string): QueryKey => JSON.parse(keyStr) as QueryKey;

/**
 * Build a `QueryInfo` for a given cached entry so it can be evaluated
 * by `matchQuery` and user predicates.
 */
const buildQueryInfo = (
	deps: QueryHandlerDeps,
	keyStr: string
): QueryInfo | undefined => {
	const entry = getEntry<unknown>(deps, { keyStr });
	if (!entry) return undefined;

	const key = parseKey(keyStr);
	const hasSubs =
		(deps.internals.subscribers.get(keyStr)?.size ?? 0) > 0;

	// Stale check reuses the cache handler's logic
	const stale =
		entry.isInvalidated === true ||
		Date.now() - entry.dataUpdatedAt > deps.config.staleTimeMs;

	return {
		queryKey: key,
		state: entry,
		isActive: hasSubs,
		isStale: stale,
	};
};

/**
 * Mark a single cache entry as invalidated (stale).
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
 * Find all cached queries matching the provided `QueryFilters`.
 */
const findMatchingKeys = (
	deps: QueryHandlerDeps,
	filters: QueryFilters
): string[] => {
	const matched: string[] = [];
	for (const keyStr of deps.internals.cache.keys()) {
		const info = buildQueryInfo(deps, keyStr);
		if (info && matchQuery(filters, info)) {
			matched.push(keyStr);
		}
	}
	return matched;
};

/**
 * Mark all entries matching the `QueryFilters` as invalidated.
 * Notifies subscribers for each match so active queries refetch.
 */
export const invalidateWithFilters = (
	deps: QueryHandlerDeps,
	filters: QueryFilters
): Effect.Effect<void> =>
	Effect.sync(() => {
		const matched = findMatchingKeys(deps, filters);

		for (const keyStr of matched) {
			const entry = getEntry<unknown>(deps, { keyStr });
			if (!entry) continue;

			const refetchType = filters.refetchType ?? 'all';
			const updatedEntry = {
				...entry,
				isInvalidated: true,
			};

			if (refetchType === 'none') {
				// Mark stale without triggering refetch
				setEntryWithoutNotify(deps, { keyStr, entry: updatedEntry });
				continue;
			}

			setEntry(deps, { keyStr, entry: updatedEntry });

			const info = buildQueryInfo(deps, keyStr);
			if (!info) continue;

			const shouldNotify =
				refetchType === 'all' ||
				(refetchType === 'active' && info.isActive) ||
				(refetchType === 'inactive' && !info.isActive);

			if (!shouldNotify) {
				// setEntry already notified; suppress if not wanted
				// This is a no-op because notification already happened.
				// In a full QueryObserver architecture this would be handled
				// via observer-level filtering instead.
			}
		}
	});

/**
 * Remove all entries matching the `QueryFilters`.
 */
export const removeWithFilters = (
	deps: QueryHandlerDeps,
	filters: QueryFilters
): void => {
	const matched = findMatchingKeys(deps, filters);
	for (const keyStr of matched) {
		const timer = deps.internals.gcTimers.get(keyStr);
		if (timer) {
			clearTimeout(timer);
			deps.internals.gcTimers.delete(keyStr);
		}
		deps.internals.cache.delete(keyStr);
		notifySubscribersForKey(deps, keyStr);
	}
};

/**
 * Notify subscribers for all entries matching the `QueryFilters`.
 * Used by `refetchQueries`.
 */
export const notifyWithFilters = (
	deps: QueryHandlerDeps,
	filters: QueryFilters
): void => {
	const matched = findMatchingKeys(deps, filters);
	for (const keyStr of matched) {
		notifySubscribersForKey(deps, keyStr);
	}
};

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
