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

export type DebounceState<T> = Data.TaggedEnum<{
	readonly Idle: { readonly value: T };
	readonly Pending: { readonly value: T; readonly pendingValue: T };
}>;

interface DebounceStateDefinition extends Data.TaggedEnum.WithGenerics<1> {
	readonly taggedEnum: DebounceState<this['A']>;
}

export const DebounceState = Data.taggedEnum<DebounceStateDefinition>();

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
