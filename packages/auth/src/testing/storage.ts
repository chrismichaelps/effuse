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
 * An in-memory {@link AuthStorage} for tests.
 *
 * `@effuse/server` already ships a production-grade memory storage with LRU
 * eviction; this exists so `@effuse/auth` can be tested without depending on the
 * server runtime, and so its notion of time is controllable.
 *
 * Values are isolated by structural copy on write and on read. Every remote
 * backend serialises, so an in-process implementation that shared references
 * would behave differently from every real one — and code written against it
 * would break on deployment rather than in test.
 */

import type { AuthStorage, Clock } from '../contract.js';
import { systemClock } from './index.js';

interface Entry {
	readonly value: unknown;
	/** Absolute expiry, or undefined when the entry does not expire. */
	readonly expiresAt: number | undefined;
}

const copy = <Value>(value: Value): Value =>
	value === undefined ? value : (structuredClone(value) as Value);

/** Creates an in-memory {@link AuthStorage} rooted at an empty namespace. */
export const createMemoryAuthStorage = (
	clock: Clock = systemClock
): AuthStorage => {
	const entries = new Map<string, Entry>();

	const build = (prefix: string): AuthStorage => {
		const scoped = (key: string): string => `${prefix}${key}`;

		const live = (fullKey: string): Entry | undefined => {
			const entry = entries.get(fullKey);
			if (entry === undefined) return undefined;

			if (entry.expiresAt !== undefined && entry.expiresAt <= clock.now()) {
				entries.delete(fullKey);
				return undefined;
			}

			return entry;
		};

		return {
			get: <Value = unknown>(key: string): Promise<Value | undefined> =>
				Promise.resolve(copy(live(scoped(key))?.value) as Value | undefined),

			set: (key, value, setOptions) => {
				entries.set(scoped(key), {
					value: copy(value),
					expiresAt:
						setOptions?.ttlMs === undefined
							? undefined
							: clock.now() + setOptions.ttlMs,
				});
				return Promise.resolve();
			},

			delete: (key) => {
				entries.delete(scoped(key));
				return Promise.resolve();
			},

			has: (key) => Promise.resolve(live(scoped(key)) !== undefined),

			keys: () =>
				Promise.resolve(
					[...entries.keys()]
						.filter((key) => key.startsWith(prefix) && live(key) !== undefined)
						.map((key) => key.slice(prefix.length))
				),

			clear: () => {
				// Only this namespace. Clearing a neighbour's keys is the failure the
				// conformance suite exists to catch.
				for (const key of [...entries.keys()]) {
					if (key.startsWith(prefix)) entries.delete(key);
				}
				return Promise.resolve();
			},

			namespace: (name) => build(`${prefix}${name}:`),
		};
	};

	return build('');
};
