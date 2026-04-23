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

import type { QueryFilters, QueryInfo } from '../client/types.js';
import { deepEqual } from './deep-equal.js';
import { partialMatchKey } from './partial-match-key.js';

/**
 * Determine whether a cached query matches the provided `QueryFilters`.
 *
 * Filtering pipeline:
 * 1. `queryKey` → prefix match (or exact if `exact: true`)
 * 2. `type` → filter by active/inactive
 * 3. `stale` → filter by stale status
 * 4. `fetchStatus` → filter by fetch status
 * 5. `predicate` → custom predicate
 */
export const matchQuery = (
	filters: QueryFilters,
	query: QueryInfo
): boolean => {
	const {
		queryKey,
		exact,
		type = 'all',
		stale,
		fetchStatus,
		predicate,
	} = filters;

	if (queryKey) {
		if (exact) {
			if (!deepEqual(query.queryKey, queryKey)) {
				return false;
			}
		} else if (!partialMatchKey(query.queryKey, queryKey)) {
			return false;
		}
	}

	if (type !== 'all') {
		const isActive = query.isActive;
		if (type === 'active' && !isActive) {
			return false;
		}
		if (type === 'inactive' && isActive) {
			return false;
		}
	}

	if (typeof stale === 'boolean' && query.isStale !== stale) {
		return false;
	}

	if (fetchStatus && query.state.fetchStatus !== fetchStatus) {
		return false;
	}

	if (predicate && !predicate(query)) {
		return false;
	}

	return true;
};
