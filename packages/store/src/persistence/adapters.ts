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

import { Effect, Option } from 'effect';
import { raceAll } from '../actions/cancellation.js';

// Storage engine interface
export interface StorageAdapter {
	getItem: (key: string) => Effect.Effect<Option.Option<string>>;
	setItem: (key: string, value: string) => Effect.Effect<void>;
	removeItem: (key: string) => Effect.Effect<void>;
}

// Browser local storage adapter
export const localStorageAdapter: StorageAdapter = {
	getItem: (key) =>
		Effect.try({
			try: () => Option.fromNullable(localStorage.getItem(key)),
			catch: () => Option.none<string>(),
		}).pipe(Effect.catchAll(() => Effect.succeed(Option.none<string>()))),
	setItem: (key, value) =>
		Effect.try(() => {
			localStorage.setItem(key, value);
		}).pipe(Effect.catchAll(() => Effect.void)),
	removeItem: (key) =>
		Effect.try(() => {
			localStorage.removeItem(key);
		}).pipe(Effect.catchAll(() => Effect.void)),
};

// Browser session storage adapter
export const sessionStorageAdapter: StorageAdapter = {
	getItem: (key) =>
		Effect.try({
			try: () => Option.fromNullable(sessionStorage.getItem(key)),
			catch: () => Option.none<string>(),
		}).pipe(Effect.catchAll(() => Effect.succeed(Option.none<string>()))),
	setItem: (key, value) =>
		Effect.try(() => {
			sessionStorage.setItem(key, value);
		}).pipe(Effect.catchAll(() => Effect.void)),
	removeItem: (key) =>
		Effect.try(() => {
			sessionStorage.removeItem(key);
		}).pipe(Effect.catchAll(() => Effect.void)),
};

// Build in memory storage adapter
export const createMemoryAdapter = (): StorageAdapter => {
	const storage = new Map<string, string>();
	return {
		getItem: (key) => Effect.succeed(Option.fromNullable(storage.get(key))),
		setItem: (key, value) =>
			Effect.sync(() => {
				storage.set(key, value);
			}),
		removeItem: (key) =>
			Effect.sync(() => {
				storage.delete(key);
			}),
	};
};

// No-op storage adapter
export const noopAdapter: StorageAdapter = {
	getItem: () => Effect.succeed(Option.none()),
	setItem: () => Effect.void,
	removeItem: () => Effect.void,
};

// Synchronous storage adapter bridge
export const runAdapter = {
	getItem: (adapter: StorageAdapter, key: string): string | null =>
		Effect.runSync(
			adapter.getItem(key).pipe(Effect.map((opt) => Option.getOrNull(opt)))
		),
	setItem: (adapter: StorageAdapter, key: string, value: string): void => {
		Effect.runSync(adapter.setItem(key, value));
	},
	removeItem: (adapter: StorageAdapter, key: string): void => {
		Effect.runSync(adapter.removeItem(key));
	},
};

export const raceAdapters = (
	adapters: StorageAdapter[],
	key: string
): Effect.Effect<Option.Option<string>> => {
	if (adapters.length === 0) {
		return Effect.succeed(Option.none());
	}
	return raceAll(adapters.map((adapter) => adapter.getItem(key)));
};
