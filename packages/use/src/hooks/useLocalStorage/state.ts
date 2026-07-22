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

import { Data } from 'effect';
import type {
	TaggedHandlers,
	TaggedUnion,
	TaggedVariant,
} from '../../internal/tagged.js';

type StorageStateCases<T> = {
	readonly Unavailable: { readonly fallback: T };
	readonly Loaded: { readonly value: T };
	readonly Error: { readonly error: string; readonly fallback: T };
};

export type StorageState<T> = TaggedUnion<StorageStateCases<T>>;

interface StorageStateDefinition extends Data.TaggedEnum.WithGenerics<1> {
	readonly taggedEnum: StorageState<this['A']>;
}

interface StorageStateConstructors {
	readonly Unavailable: <T>(fields: {
		readonly fallback: T;
	}) => TaggedVariant<'Unavailable', { readonly fallback: T }>;
	readonly Loaded: <T>(fields: {
		readonly value: T;
	}) => TaggedVariant<'Loaded', { readonly value: T }>;
	readonly Error: <T>(fields: {
		readonly error: string;
		readonly fallback: T;
	}) => TaggedVariant<
		'Error',
		{ readonly error: string; readonly fallback: T }
	>;
	readonly $is: <K extends StorageState<unknown>['_tag']>(
		tag: K
	) => <T>(
		value: StorageState<T>
	) => value is Extract<StorageState<T>, { readonly _tag: K }>;
	readonly $match: {
		<T, R>(
			cases: TaggedHandlers<StorageStateCases<T>, R>
		): (value: StorageState<T>) => R;
		<T, R>(
			value: StorageState<T>,
			cases: TaggedHandlers<StorageStateCases<T>, R>
		): R;
	};
}

export const StorageState = Data.taggedEnum<StorageStateDefinition>() as unknown as
	StorageStateConstructors;

export const isUnavailable = StorageState.$is('Unavailable');
export const isLoaded = StorageState.$is('Loaded');
export const isError = StorageState.$is('Error');

export const matchStorageState = StorageState.$match;

export const getValue = <T>(state: StorageState<T>): T => {
	if (isLoaded(state)) return state.value;
	if (isUnavailable(state)) return state.fallback;
	return state.fallback;
};

export const getError = <T>(state: StorageState<T>): string | null => {
	if (isError(state)) return state.error;
	return null;
};
