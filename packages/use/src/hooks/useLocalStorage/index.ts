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

import { Option, Either } from 'effect';
import { defineHook, type Signal } from '@effuse/core';
import {
	isClient,
	safeJsonParse,
	safeJsonStringify,
} from '../../internal/utils.js';
import { STORAGE_EVENT } from './constants.js';
import { readStorage, writeStorage, removeStorage } from './utils.js';
import {
	traceLocalStorageInit,
	traceLocalStorageWrite,
	traceLocalStorageRemove,
	traceLocalStorageError,
} from './telemetry.js';
import {
	type StorageState,
	StorageState as SS,
	getValue,
	getError,
} from './state.js';

export { StorageState, isLoaded, isError, isUnavailable } from './state.js';
export { LocalStorageError } from './errors.js';

export interface UseLocalStorageConfig<T> {
	readonly key: string;

	readonly defaultValue: T;

	readonly serializer?: (value: T) => string;

	readonly deserializer?: (value: string) => T;

	readonly syncTabs?: boolean;
}

export interface UseLocalStorageReturn<T> {
	readonly value: Signal<T>;

	readonly isAvailable: boolean;

	readonly error: string | null;

	readonly remove: () => void;
}

export const useLocalStorage = defineHook<
	UseLocalStorageConfig<unknown>,
	UseLocalStorageReturn<unknown>
>({
	name: 'useLocalStorage',
	setup: (ctx) => {
		const {
			key,
			defaultValue,
			serializer = safeJsonStringify,
			deserializer = (v: string) => safeJsonParse(v, defaultValue),
			syncTabs = true,
		} = ctx.config;

		const createInitialState = (): StorageState<unknown> => {
			if (!isClient()) {
				return SS.Unavailable({ fallback: defaultValue });
			}

			const stored = readStorage(key);
			return Option.match(stored, {
				onNone: () => {
					const serialized = serializer(defaultValue);
					if (serialized !== null) {
						writeStorage(key, serialized);
					}
					return SS.Loaded({ value: defaultValue });
				},
				onSome: (raw) =>
					Either.match(
						Either.try(() => deserializer(raw)),
						{
							onLeft: () =>
								SS.Error({
									error: 'Failed to deserialize stored value',
									fallback: defaultValue,
								}),
							onRight: (parsed) => SS.Loaded({ value: parsed }),
						}
					),
			});
		};

		const internalState =
			ctx.signal<StorageState<unknown>>(createInitialState());

		traceLocalStorageInit(key);

		const value = ctx.signal<unknown>(getValue(internalState.value));

		let isExternalUpdate = false;

		ctx.effect(() => {
			const current = value.value;
			if (!isClient()) return undefined;

			if (isExternalUpdate) {
				isExternalUpdate = false;
				return undefined;
			}

			const serialized = serializer(current);
			if (serialized !== null) {
				const success = writeStorage(key, serialized);
				if (success) {
					traceLocalStorageWrite(key);
					internalState.value = SS.Loaded({ value: current });
				} else {
					traceLocalStorageError(key, 'Failed to write');
					internalState.value = SS.Error({
						error: 'Failed to write to localStorage',
						fallback: defaultValue,
					});
				}
			}

			return undefined;
		});

		ctx.effect(() => {
			if (!isClient() || !syncTabs) return undefined;

			const handleStorage = (event: StorageEvent): void => {
				if (event.key !== key) return;

				isExternalUpdate = true;

				if (event.newValue === null) {
					value.value = defaultValue;
					internalState.value = SS.Loaded({ value: defaultValue });
				} else {
					const newValue = event.newValue;
					Either.match(
						Either.try(() => deserializer(newValue)),
						{
							onLeft: () => {
								internalState.value = SS.Error({
									error: 'Failed to sync value from another tab',
									fallback: defaultValue,
								});
							},
							onRight: (parsed) => {
								value.value = parsed;
								internalState.value = SS.Loaded({ value: parsed });
							},
						}
					);
				}
			};

			window.addEventListener(STORAGE_EVENT, handleStorage);

			return () => {
				window.removeEventListener(STORAGE_EVENT, handleStorage);
			};
		});

		const remove = (): void => {
			if (!isClient()) return;
			traceLocalStorageRemove(key);
			removeStorage(key);
			value.value = defaultValue;
			internalState.value = SS.Loaded({ value: defaultValue });
		};

		return {
			value,
			isAvailable: isClient(),
			get error() {
				return getError(internalState.value);
			},
			remove,
		};
	},
});
