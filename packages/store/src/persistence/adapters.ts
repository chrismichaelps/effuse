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
import {
	getItem,
	setItem,
	removeItem,
	hasItem,
	clearStorage,
	getStorageKeys,
	getStorageSize,
	type StorageHandlerDeps,
} from '../handlers/index.js';

export interface StorageAdapter {
	getItem: (key: string) => Effect.Effect<Option.Option<string>>;
	setItem: (key: string, value: string) => Effect.Effect<void>;
	removeItem: (key: string) => Effect.Effect<void>;
	has: (key: string) => Effect.Effect<boolean>;
	clear: () => Effect.Effect<void>;
	keys: () => Effect.Effect<string[]>;
	size: () => Effect.Effect<number>;
}

const createBrowserStorageAdapter = (storage: Storage): StorageAdapter => ({
	getItem: (key) =>
		Effect.try({
			try: () => Option.fromNullable(storage.getItem(key)),
			catch: () => Option.none<string>(),
		}).pipe(Effect.catchAll(() => Effect.succeed(Option.none<string>()))),
	setItem: (key, value) =>
		Effect.try(() => {
			storage.setItem(key, value);
		}).pipe(Effect.catchAll(() => Effect.void)),
	removeItem: (key) =>
		Effect.try(() => {
			storage.removeItem(key);
		}).pipe(Effect.catchAll(() => Effect.void)),
	has: (key) =>
		Effect.try({
			try: () => storage.getItem(key) !== null,
			catch: () => false,
		}).pipe(Effect.catchAll(() => Effect.succeed(false))),
	clear: () =>
		Effect.try(() => {
			storage.clear();
		}).pipe(Effect.catchAll(() => Effect.void)),
	keys: () =>
		Effect.try({
			try: () => Object.keys(storage),
			catch: () => [] as string[],
		}).pipe(Effect.catchAll(() => Effect.succeed([] as string[]))),
	size: () =>
		Effect.try({
			try: () => storage.length,
			catch: () => 0,
		}).pipe(Effect.catchAll(() => Effect.succeed(0))),
});

export const localStorageAdapter: StorageAdapter = createBrowserStorageAdapter(
	typeof localStorage !== 'undefined' ? localStorage : ({} as Storage)
);

export const sessionStorageAdapter: StorageAdapter =
	createBrowserStorageAdapter(
		typeof sessionStorage !== 'undefined' ? sessionStorage : ({} as Storage)
	);

export const createMemoryAdapter = (): StorageAdapter => {
	const storage = new Map<string, string>();
	const deps: StorageHandlerDeps = { storage };

	return {
		getItem: (key) => Effect.succeed(getItem(deps, { key })),
		setItem: (key, value) =>
			Effect.sync(() => {
				setItem(deps, { key, value });
			}),
		removeItem: (key) =>
			Effect.sync(() => {
				removeItem(deps, { key });
			}),
		has: (key) => Effect.succeed(hasItem(deps, { key })),
		clear: () =>
			Effect.sync(() => {
				clearStorage(deps);
			}),
		keys: () => Effect.succeed(getStorageKeys(deps)),
		size: () => Effect.succeed(getStorageSize(deps)),
	};
};

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
	has: (adapter: StorageAdapter, key: string): boolean =>
		Effect.runSync(adapter.has(key)),
	clear: (adapter: StorageAdapter): void => {
		Effect.runSync(adapter.clear());
	},
	keys: (adapter: StorageAdapter): string[] => Effect.runSync(adapter.keys()),
	size: (adapter: StorageAdapter): number => Effect.runSync(adapter.size()),
};
