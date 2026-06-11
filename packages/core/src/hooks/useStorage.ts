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

import { signal, readonly } from '../reactivity/index.js';
import type { ReadonlySignal } from '../types/index.js';
import { getActiveLifecycle } from '../blueprint/lifecycle.js';

export interface StorageOptions<T> {
	/** Serializer. Defaults to JSON.stringify. */
	serialize?: (value: T) => string;
	/** Deserializer. Defaults to JSON.parse. */
	deserialize?: (raw: string) => T;
	/** Sync signal across browser tabs (storage event). Defaults to true. */
	sync?: boolean;
}

const getStorage = (
	type: 'local' | 'session'
): Storage | null => {
	if (typeof window === 'undefined') return null;
	return type === 'local' ? window.localStorage : window.sessionStorage;
};

const createStorageHook = <T>(
	type: 'local' | 'session',
	key: string,
	initialValue: T,
	options: StorageOptions<T> = {}
): { value: ReadonlySignal<T>; setValue: (value: T) => void } => {
	const {
		serialize = JSON.stringify,
		deserialize = JSON.parse,
		sync = true,
	} = options;

	const storage = getStorage(type);

	const read = (): T => {
		if (!storage) return initialValue;
		try {
			const raw = storage.getItem(key);
			return raw !== null ? deserialize(raw) : initialValue;
		} catch {
			return initialValue;
		}
	};

	const write = (value: T): void => {
		if (!storage) return;
		try {
			storage.setItem(key, serialize(value));
		} catch {
			// Ignore quota errors or serialization failures
		}
	};

	const sig = signal<T>(read());

	// Subscribe to external storage changes (cross-tab sync)
	if (sync && typeof window !== 'undefined') {
		const handler = (e: StorageEvent) => {
			if (e.key === key && e.newValue !== null) {
				try {
					sig.value = deserialize(e.newValue);
				} catch {
					/* ignore deserialization errors from other tabs */
				}
			}
		};

		window.addEventListener('storage', handler);

		const lifecycle = getActiveLifecycle();
		if (lifecycle) {
			lifecycle.onUnmount(() => {
				window.removeEventListener('storage', handler);
			});
		}
	}

	return {
		value: readonly(sig),
		setValue: (value: T) => {
			sig.value = value;
			write(value);
		},
	};
};

/**
 * Reactive hook backed by `localStorage`.
 *
 * The returned signal stays in sync with the storage key, including across
 * browser tabs via the `storage` event.
 *
 * @example
 * ```ts
 * const theme = useLocalStorage('theme', 'light');
 * // theme.value reads from localStorage
 * // theme.setValue('dark') writes to localStorage
 * ```
 */
export const useLocalStorage = <T>(
	key: string,
	initialValue: T,
	options?: StorageOptions<T>
): { value: ReadonlySignal<T>; setValue: (value: T) => void } =>
	createStorageHook('local', key, initialValue, options);

/**
 * Reactive hook backed by `sessionStorage`.
 *
 * Same API as `useLocalStorage`, but scoped to the current session.
 */
export const useSessionStorage = <T>(
	key: string,
	initialValue: T,
	options?: StorageOptions<T>
): { value: ReadonlySignal<T>; setValue: (value: T) => void } =>
	createStorageHook('session', key, initialValue, options);
