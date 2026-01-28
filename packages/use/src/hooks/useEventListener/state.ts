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

export type ListenerState = Data.TaggedEnum<{
	readonly Inactive: {};
	readonly Active: { readonly eventName: string };
	readonly Error: { readonly reason: string };
}>;

export const ListenerState = Data.taggedEnum<ListenerState>();

export const isInactive = ListenerState.$is('Inactive');
export const isActive = ListenerState.$is('Active');
export const isError = ListenerState.$is('Error');

export const matchListenerState = ListenerState.$match;

export const getEventName = (state: ListenerState): string | null =>
	matchListenerState(state, {
		Inactive: () => null,
		Active: ({ eventName }) => eventName,
		Error: () => null,
	});

export const getErrorReason = (state: ListenerState): string | null =>
	matchListenerState(state, {
		Inactive: () => null,
		Active: () => null,
		Error: ({ reason }) => reason,
	});
