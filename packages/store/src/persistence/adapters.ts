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

export interface StorageAdapter {
	getItem: (key: string) => string | null;
	setItem: (key: string, value: string) => void;
	removeItem: (key: string) => void;
	has: (key: string) => boolean;
	clear: () => void;
	keys: () => string[];
	size: () => number;
}

const createBrowserStorageAdapter = (storage: Storage): StorageAdapter => ({
	getItem: (key) => {
		try {
			return storage.getItem(key);
		} catch {
			return null;
		}
	},
	setItem: (key, value) => {
		try {
			storage.setItem(key, value);
		} catch {
			// QuotaExceeded or other storage errors are silently ignored
		}
	},
	removeItem: (key) => {
		try {
			storage.removeItem(key);
		} catch {
			// Ignore
		}
	},
	has: (key) => {
		try {
			return storage.getItem(key) !== null;
		} catch {
			return false;
		}
	},
	clear: () => {
		try {
			storage.clear();
		} catch {
			// Ignore
		}
	},
	keys: () => {
		try {
			return Object.keys(storage);
		} catch {
			return [];
		}
	},
	size: () => {
		try {
			return storage.length;
		} catch {
			return 0;
		}
	},
});

const noopAdapter: StorageAdapter = {
	getItem: () => null,
	setItem: () => {},
	removeItem: () => {},
	has: () => false,
	clear: () => {},
	keys: () => [],
	size: () => 0,
};

export const localStorageAdapter: StorageAdapter =
	typeof localStorage !== 'undefined'
		? createBrowserStorageAdapter(localStorage)
		: noopAdapter;

export const sessionStorageAdapter: StorageAdapter =
	typeof sessionStorage !== 'undefined'
		? createBrowserStorageAdapter(sessionStorage)
		: noopAdapter;

export const createMemoryAdapter = (): StorageAdapter => {
	const storage = new Map<string, string>();
	return {
		getItem: (key) => storage.get(key) ?? null,
		setItem: (key, value) => {
			storage.set(key, value);
		},
		removeItem: (key) => {
			storage.delete(key);
		},
		has: (key) => storage.has(key),
		clear: () => {
			storage.clear();
		},
		keys: () => Array.from(storage.keys()),
		size: () => storage.size,
	};
};
