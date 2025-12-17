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
	getItem: (key: string) => string | null | Promise<string | null>;
	setItem: (key: string, value: string) => void | Promise<void>;
	removeItem: (key: string) => void | Promise<void>;
}

export const localStorageAdapter: StorageAdapter = {
	getItem: (key) => {
		try {
			return localStorage.getItem(key);
		} catch {
			return null;
		}
	},
	setItem: (key, value) => {
		try {
			localStorage.setItem(key, value);
		} catch {}
	},
	removeItem: (key) => {
		try {
			localStorage.removeItem(key);
		} catch {}
	},
};

export const sessionStorageAdapter: StorageAdapter = {
	getItem: (key) => {
		try {
			return sessionStorage.getItem(key);
		} catch {
			return null;
		}
	},
	setItem: (key, value) => {
		try {
			sessionStorage.setItem(key, value);
		} catch {}
	},
	removeItem: (key) => {
		try {
			sessionStorage.removeItem(key);
		} catch {}
	},
};

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
	};
};

export const noopAdapter: StorageAdapter = {
	getItem: () => null,
	setItem: () => {},
	removeItem: () => {},
};
