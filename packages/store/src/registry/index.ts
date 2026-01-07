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
import { getStoreConfig } from '../config/index.js';
import { StoreNotFoundError } from '../errors.js';

const stores = new Map<string, Store<unknown>>();

// Register store instance
export const registerStore = <T>(name: string, store: Store<T>): void => {
	if (stores.has(name) && getStoreConfig().debug) {
		// eslint-disable-next-line no-console
		console.warn(`[store] Overwriting existing store: ${name}`);
	}
	stores.set(name, store as Store<unknown>);
};

// Access registered store
export const getStore = <T>(name: string): Store<T> => {
	const store = stores.get(name);
	if (!store) {
		throw new StoreNotFoundError({ name });
	}
	return store as Store<T>;
};

// Detect registered store
export const hasStore = (name: string): boolean => stores.has(name);

// Remove registered store
export const removeStore = (name: string): boolean => stores.delete(name);

// Reset store registry
export const clearStores = (): void => {
	stores.clear();
};

// Access store names
export const getStoreNames = (): string[] => Array.from(stores.keys());
