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

type ThrottleStateCases<T> = {
	readonly Ready: { readonly value: T };
	readonly Throttled: { readonly value: T; readonly lastValue: T };
};

export type ThrottleState<T> = TaggedUnion<ThrottleStateCases<T>>;

interface ThrottleStateDefinition extends Data.TaggedEnum.WithGenerics<1> {
	readonly taggedEnum: ThrottleState<this['A']>;
}

interface ThrottleStateConstructors {
	readonly Ready: <T>(fields: {
		readonly value: T;
	}) => TaggedVariant<'Ready', { readonly value: T }>;
	readonly Throttled: <T>(fields: {
		readonly value: T;
		readonly lastValue: T;
	}) => TaggedVariant<
		'Throttled',
		{ readonly value: T; readonly lastValue: T }
	>;
	readonly $is: <K extends ThrottleState<unknown>['_tag']>(
		tag: K
	) => <T>(
		value: ThrottleState<T>
	) => value is Extract<ThrottleState<T>, { readonly _tag: K }>;
	readonly $match: {
		<T, R>(
			cases: TaggedHandlers<ThrottleStateCases<T>, R>
		): (value: ThrottleState<T>) => R;
		<T, R>(
			value: ThrottleState<T>,
			cases: TaggedHandlers<ThrottleStateCases<T>, R>
		): R;
	};
}

export const ThrottleState = Data.taggedEnum<ThrottleStateDefinition>() as unknown as
	ThrottleStateConstructors;

export const isReady = ThrottleState.$is('Ready');
export const isThrottled = ThrottleState.$is('Throttled');

export const matchThrottleState = ThrottleState.$match;

export const getCurrentValue = <T>(state: ThrottleState<T>): T => state.value;

export const getLastValue = <T>(state: ThrottleState<T>): T | undefined => {
	if (isThrottled(state)) return state.lastValue;
	return undefined;
};

export const getIsThrottled = <T>(state: ThrottleState<T>): boolean =>
	isThrottled(state);
