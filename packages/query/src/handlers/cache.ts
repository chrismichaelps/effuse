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
import type {
	QueryHandlerDeps,
	GetEntryInput,
	SetEntryInput,
	RemoveEntryInput,
} from './types.js';

export const getEntry = <T>(
	deps: QueryHandlerDeps,
	input: GetEntryInput
): CacheEntry<T> | undefined => {
	return deps.internals.cache.get(input.keyStr) as CacheEntry<T> | undefined;
};

const notifySubscribersForKey = (
	deps: QueryHandlerDeps,
	keyStr: string
): void => {
	const subs = deps.internals.subscribers.get(keyStr);
	if (subs) {
		for (const callback of subs) {
			callback();
		}
	}
};

const scheduleGC = (deps: QueryHandlerDeps, keyStr: string): void => {
	const { internals, config } = deps;
	const existing = internals.gcTimers.get(keyStr);
	if (existing) {
		clearTimeout(existing);
	}
	const timer = setTimeout(() => {
		const subs = internals.subscribers.get(keyStr);
		if (!subs || subs.size === 0) {
			internals.cache.delete(keyStr);
			internals.subscribers.delete(keyStr);
			internals.gcTimers.delete(keyStr);
		}
	}, config.gcTimeMs);
	internals.gcTimers.set(keyStr, timer);
};

export const setEntry = <T>(
	deps: QueryHandlerDeps,
	input: SetEntryInput<T>
): void => {
	deps.internals.cache.set(input.keyStr, input.entry as CacheEntry<unknown>);
	scheduleGC(deps, input.keyStr);
	notifySubscribersForKey(deps, input.keyStr);
};

export const removeEntry = (
	deps: QueryHandlerDeps,
	input: RemoveEntryInput
): boolean => {
	const { internals } = deps;
	const timer = internals.gcTimers.get(input.keyStr);
	if (timer) {
		clearTimeout(timer);
		internals.gcTimers.delete(input.keyStr);
	}
	const result = internals.cache.delete(input.keyStr);
	notifySubscribersForKey(deps, input.keyStr);
	return result;
};

export const hasEntry = (
	deps: QueryHandlerDeps,
	input: GetEntryInput
): boolean => {
	return deps.internals.cache.has(input.keyStr);
};

export const clearCache = (deps: QueryHandlerDeps): void => {
	const { internals } = deps;
	for (const timer of internals.gcTimers.values()) {
		clearTimeout(timer);
	}
	internals.gcTimers.clear();
	internals.cache.clear();
	for (const subs of internals.subscribers.values()) {
		for (const callback of subs) {
			callback();
		}
	}
};

export const getQueryKeys = (deps: QueryHandlerDeps): string[] => {
	return Array.from(deps.internals.cache.keys());
};

export const isStale = (
	deps: QueryHandlerDeps,
	input: GetEntryInput,
	staleTime?: number
): boolean => {
	const entry = deps.internals.cache.get(input.keyStr);
	if (!entry) return true;
	const threshold = staleTime ?? deps.config.staleTimeMs;
	return Date.now() - entry.dataUpdatedAt > threshold;
};

export { notifySubscribersForKey };
