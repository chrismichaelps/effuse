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

import type { ReadonlySignal, Signal } from '../types/index.js';
import type { Reactive } from './reactive.js';
import { isDebugEnabled, isStrictMode } from '../config/index.js';
import { isSignal } from './signal.js';
import { READONLY_MARKER } from '../constants.js';

export type DeepReadonly<T> = T extends object
	? { readonly [K in keyof T]: DeepReadonly<T[K]> }
	: T;

export function readonly<T>(target: Signal<T>): ReadonlySignal<T>;
export function readonly<T extends object>(
	target: Reactive<T>
): DeepReadonly<Reactive<T>>;
export function readonly<T extends object>(target: T): DeepReadonly<T>;
export function readonly<T>(
	target: T | Signal<T> | Reactive<T & object>
): ReadonlySignal<T> | DeepReadonly<T> {
	if (isSignal<T>(target)) {
		return {
			get value(): T {
				return target.value;
			},
		};
	}

	if (typeof target === 'object' && target !== null) {
		return createReadonlyProxy(target as object) as DeepReadonly<T>;
	}

	return target as DeepReadonly<T>;
}

const createReadonlyProxy = <T extends object>(target: T): DeepReadonly<T> => {
	const handler: ProxyHandler<T> = {
		get(obj, key, receiver) {
			if (key === READONLY_MARKER) {
				return true;
			}

			const value = Reflect.get(obj, key, receiver);

			if (typeof value === 'object' && value !== null) {
				return createReadonlyProxy(value);
			}

			return value;
		},

		set(_obj, key) {
			if (isStrictMode() || isDebugEnabled()) {
				console.warn(
					`Cannot set property "${String(key)}" on a readonly value.`
				);
			}
			return false;
		},

		deleteProperty(_obj, key) {
			if (isStrictMode() || isDebugEnabled()) {
				console.warn(
					`Cannot delete property "${String(key)}" from a readonly value.`
				);
			}
			return false;
		},
	};

	return new Proxy(target, handler) as DeepReadonly<T>;
};

export const isReadonly = (value: unknown): boolean => {
	return (
		typeof value === 'object' &&
		value !== null &&
		(value as Record<symbol, unknown>)[READONLY_MARKER] === true
	);
};

export const shallowReadonly = <T extends object>(target: T): Readonly<T> => {
	const handler: ProxyHandler<T> = {
		get(obj, key, receiver) {
			if (key === READONLY_MARKER) {
				return true;
			}
			return Reflect.get(obj, key, receiver);
		},

		set(_obj, key) {
			if (isStrictMode() || isDebugEnabled()) {
				console.warn(
					`Cannot set property "${String(key)}" on a readonly value.`
				);
			}
			return false;
		},

		deleteProperty(_obj, key) {
			if (isStrictMode() || isDebugEnabled()) {
				console.warn(
					`Cannot delete property "${String(key)}" from a readonly value.`
				);
			}
			return false;
		},
	};

	return new Proxy(target, handler);
};
