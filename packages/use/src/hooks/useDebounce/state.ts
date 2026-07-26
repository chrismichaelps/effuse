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

type DebounceStateCases<T> = {
	readonly Idle: { readonly value: T };
	readonly Pending: { readonly value: T; readonly pendingValue: T };
};

export type DebounceState<T> = TaggedUnion<DebounceStateCases<T>>;

interface DebounceStateDefinition extends Data.TaggedEnum.WithGenerics<1> {
	readonly taggedEnum: DebounceState<this['A']>;
}

interface DebounceStateConstructors {
	readonly Idle: <T>(fields: {
		readonly value: T;
	}) => TaggedVariant<'Idle', { readonly value: T }>;
	readonly Pending: <T>(fields: {
		readonly value: T;
		readonly pendingValue: T;
	}) => TaggedVariant<
		'Pending',
		{ readonly value: T; readonly pendingValue: T }
	>;
	readonly $is: <K extends DebounceState<unknown>['_tag']>(
		tag: K
	) => <T>(
		value: DebounceState<T>
	) => value is Extract<DebounceState<T>, { readonly _tag: K }>;
	readonly $match: {
		<T, R>(
			cases: TaggedHandlers<DebounceStateCases<T>, R>
		): (value: DebounceState<T>) => R;
		<T, R>(
			value: DebounceState<T>,
			cases: TaggedHandlers<DebounceStateCases<T>, R>
		): R;
	};
}

export const DebounceState = Data.taggedEnum<DebounceStateDefinition>() as unknown as
	DebounceStateConstructors;

export const isIdle = DebounceState.$is('Idle');
export const isPending = DebounceState.$is('Pending');

export const matchDebounceState = DebounceState.$match;

export const getCurrentValue = <T>(state: DebounceState<T>): T => state.value;

export const getPendingValue = <T>(state: DebounceState<T>): T | undefined => {
	if (isPending(state)) return state.pendingValue;
	return undefined;
};

export const getIsPending = <T>(state: DebounceState<T>): boolean =>
	isPending(state);
