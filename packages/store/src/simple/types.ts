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

import { Schema } from 'effect';
import type { Signal } from '@effuse/core';

export const StoreOptionsSchema = Schema.Struct({
	persist: Schema.optional(Schema.Boolean),
	storageKey: Schema.optional(Schema.String),
	devtools: Schema.optional(Schema.Boolean),
});

export type StoreOptions = Schema.Schema.Type<typeof StoreOptionsSchema>;

export type StoreState<T> = {
	[K in keyof T]: T[K] extends (...args: infer A) => infer R
		? (...args: A) => R
		: Signal<T[K]>;
};

export type StoreContext<T> = {
	[K in keyof T]: T[K] extends (...args: unknown[]) => unknown
		? T[K]
		: Signal<T[K]>;
};

export type StoreDefinition<T> = {
	[K in keyof T]: T[K] extends (...args: infer A) => infer R
		? (this: StoreContext<T>, ...args: A) => R
		: T[K];
};

export type ActionContext<T> = StoreContext<T>;

export type Middleware<T> = (
	state: T,
	action: string,
	args: unknown[]
) => T | undefined;

export interface Store<T> {
	readonly name: string;
	readonly state: StoreState<T>;

	subscribe: (callback: () => void) => () => void;
	subscribeToKey: <K extends keyof T>(
		key: K,
		callback: (value: T[K]) => void
	) => () => void;
	getSnapshot: () => {
		[K in keyof T]: T[K] extends (...args: unknown[]) => unknown ? never : T[K];
	};
	computed: <R>(
		selector: (snapshot: Record<string, unknown>) => R
	) => Signal<R>;
	batch: (updates: () => void) => void;
	reset: () => void;
	use: (middleware: Middleware<Record<string, unknown>>) => () => void;
	toJSON: () => {
		[K in keyof T]: T[K] extends (...args: unknown[]) => unknown ? never : T[K];
	};
	update: (
		updater: (draft: {
			[K in keyof T]: T[K] extends (...args: unknown[]) => unknown
				? never
				: T[K];
		}) => void
	) => void;
	select: <R>(selector: (snapshot: Record<string, unknown>) => R) => Signal<R>;
}

export type InferStoreState<S> =
	S extends Store<infer T>
		? {
				[K in keyof T]: T[K] extends (...args: unknown[]) => unknown
					? never
					: T[K];
			}
		: never;
