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

import type { Store } from '../core/types.js';

export interface StoreStream<T> {
	subscribe: (handler: (value: T) => void) => () => void;
	map: <R>(fn: (value: T) => R) => StoreStream<R>;
	filter: (predicate: (value: T) => boolean) => StoreStream<T>;
	debounce: (ms: number) => StoreStream<T>;
}

const createBaseStream = <T>(
	addListener: (handler: (value: T) => void) => () => void
): StoreStream<T> => {
	return {
		subscribe: addListener,

		map: <R>(fn: (value: T) => R): StoreStream<R> => {
			const mappedListeners = new Set<(value: R) => void>();
			addListener((value) => {
				const mapped = fn(value);
				for (const h of mappedListeners) h(mapped);
			});
			return createBaseStream((h) => {
				mappedListeners.add(h);
				return () => mappedListeners.delete(h);
			});
		},

		filter: (predicate): StoreStream<T> => {
			const filteredListeners = new Set<(value: T) => void>();
			addListener((value) => {
				if (predicate(value)) {
					for (const h of filteredListeners) h(value);
				}
			});
			return createBaseStream((h) => {
				filteredListeners.add(h);
				return () => filteredListeners.delete(h);
			});
		},

		debounce: (ms): StoreStream<T> => {
			const debouncedListeners = new Set<(value: T) => void>();
			let timeout: ReturnType<typeof setTimeout> | null = null;
			let latestValue: T | undefined;

			addListener((value) => {
				latestValue = value;
				if (timeout) clearTimeout(timeout);
				timeout = setTimeout(() => {
					if (latestValue !== undefined) {
						for (const h of debouncedListeners) h(latestValue);
					}
				}, ms);
			});

			return createBaseStream((h) => {
				debouncedListeners.add(h);
				return () => debouncedListeners.delete(h);
			});
		},
	};
};

export const createStoreStream = <T, K extends keyof T>(
	store: Store<T>,
	key: K
): StoreStream<T[K]> => {
	const listeners = new Set<(value: T[K]) => void>();
	let lastValue: T[K] = (store.getSnapshot() as Record<string, unknown>)[
		key as string
	] as T[K];

	store.subscribe(() => {
		const snapshot = store.getSnapshot() as Record<string, unknown>;
		const newValue = snapshot[key as string] as T[K];
		if (newValue !== lastValue) {
			lastValue = newValue;
			for (const listener of listeners) {
				listener(newValue);
			}
		}
	});

	return createBaseStream((handler) => {
		listeners.add(handler);
		return () => listeners.delete(handler);
	});
};

export const streamAll = <T>(
	store: Store<T>
): StoreStream<ReturnType<Store<T>['getSnapshot']>> => {
	const listeners = new Set<
		(value: ReturnType<Store<T>['getSnapshot']>) => void
	>();

	store.subscribe(() => {
		const snapshot = store.getSnapshot();
		for (const listener of listeners) {
			listener(snapshot);
		}
	});

	return createBaseStream((handler) => {
		listeners.add(handler);
		return () => listeners.delete(handler);
	});
};
