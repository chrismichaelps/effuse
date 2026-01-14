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
import { notifySubscribersForKey } from './cache.js';

const matchesKeyPattern = (pattern: QueryKey, key: QueryKey): boolean => {
	if (pattern.length === 0) return false;
	if (pattern.length > key.length) return false;
	for (let i = 0; i < pattern.length; i++) {
		if (JSON.stringify(pattern[i]) !== JSON.stringify(key[i])) {
			return false;
		}
	}
	return true;
};

export const invalidateKey = (
	deps: QueryHandlerDeps,
	keyStr: string
): Effect.Effect<void> =>
	Effect.sync(() => {
		const timer = deps.internals.gcTimers.get(keyStr);
		if (timer) {
			clearTimeout(timer);
			deps.internals.gcTimers.delete(keyStr);
		}
		deps.internals.cache.delete(keyStr);
		notifySubscribersForKey(deps, keyStr);
	});

export const invalidatePattern = (
	deps: QueryHandlerDeps,
	input: InvalidatePatternInput
): Effect.Effect<void> =>
	Effect.sync(() => {
		for (const keyStr of deps.internals.cache.keys()) {
			const key = JSON.parse(keyStr) as QueryKey;
			if (matchesKeyPattern(input.pattern, key)) {
				const timer = deps.internals.gcTimers.get(keyStr);
				if (timer) {
					clearTimeout(timer);
					deps.internals.gcTimers.delete(keyStr);
				}
				deps.internals.cache.delete(keyStr);
				notifySubscribersForKey(deps, keyStr);
			}
		}
	});

export const invalidateAll = (deps: QueryHandlerDeps): Effect.Effect<void> =>
	Effect.sync(() => {
		for (const timer of deps.internals.gcTimers.values()) {
			clearTimeout(timer);
		}
		deps.internals.gcTimers.clear();

		const allKeys = Array.from(deps.internals.cache.keys());
		deps.internals.cache.clear();
		for (const keyStr of allKeys) {
			notifySubscribersForKey(deps, keyStr);
		}
	});
