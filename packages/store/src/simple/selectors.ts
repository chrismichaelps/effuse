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

import { signal, type Signal } from '@effuse/core';
import type { Store } from './index.js';

export const shallowEqual = <T>(a: T, b: T): boolean => {
	if (Object.is(a, b)) return true;
	if (
		typeof a !== 'object' ||
		a === null ||
		typeof b !== 'object' ||
		b === null
	) {
		return false;
	}

	if (Array.isArray(a) && Array.isArray(b)) {
		if (a.length !== b.length) return false;
		for (let i = 0; i < a.length; i++) {
			if (!Object.is(a[i], b[i])) return false;
		}
		return true;
	}

	const keysA = Object.keys(a);
	const keysB = Object.keys(b);
	if (keysA.length !== keysB.length) return false;

	for (const key of keysA) {
		if (!Object.prototype.hasOwnProperty.call(b, key)) return false;
		if (
			!Object.is(
				(a as Record<string, unknown>)[key],
				(b as Record<string, unknown>)[key]
			)
		) {
			return false;
		}
	}
	return true;
};

export type Selector<T, R> = (state: T) => R;

export type EqualityFn<T> = (a: T, b: T) => boolean;

export const createSelector = <T, R>(
	store: Store<T>,
	selector: Selector<ReturnType<Store<T>['getSnapshot']>, R>,
	equalityFn: EqualityFn<R> = shallowEqual
): Signal<R> => {
	const snapshot = store.getSnapshot();
	const initialValue = selector(snapshot);
	const derived = signal(initialValue);

	store.subscribe(() => {
		const currentSnapshot = store.getSnapshot();
		const newValue = selector(currentSnapshot);
		if (!equalityFn(derived.value, newValue)) {
			derived.value = newValue;
		}
	});

	return derived;
};

export const pick = <T, K extends keyof T>(
	store: Store<T>,
	keys: K[]
): Signal<Pick<T, K>> => {
	return createSelector(store, (state) => {
		const picked = {} as Pick<T, K>;
		for (const key of keys) {
			if (key in (state as object)) {
				picked[key] = (state as T)[key];
			}
		}
		return picked;
	});
};

export const combineSelectors = <T, R extends Record<string, unknown>>(
	store: Store<T>,
	selectors: {
		[K in keyof R]: Selector<ReturnType<Store<T>['getSnapshot']>, R[K]>;
	}
): Signal<R> => {
	return createSelector(store, (state) => {
		const result = {} as R;
		for (const key of Object.keys(selectors) as (keyof R)[]) {
			result[key] = selectors[key](state) as any;
		}
		return result;
	});
};
