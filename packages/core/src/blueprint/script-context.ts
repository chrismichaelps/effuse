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

import { Effect } from 'effect';
import type { Scope } from 'effect';
import type { Signal } from '../types/index.js';
import { signal } from '../reactivity/index.js';
import { effect as createEffect } from '../effects/index.js';
import {
	createComponentLifecycleSync,
	type ComponentLifecycle,
} from './lifecycle.js';

export type ExposedValues = object;

// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export interface EffuseRegistry {}

type RouterType = EffuseRegistry extends { router: infer R } ? R : unknown;

export interface ScriptContext<P> {
	readonly props: Readonly<P>;

	expose: (values: ExposedValues) => void;

	signal: typeof signal;

	store: <T>(name: string) => T;

	router: RouterType;

	onMount: (callback: () => (() => void) | undefined) => void;

	onUnmount: (callback: () => void) => void;

	onBeforeMount: (callback: () => void) => void;

	onBeforeUnmount: (callback: () => void) => void;

	watch: <T>(
		source: Signal<T> | (() => T),
		callback: (value: T) => void
	) => void;
}

export interface ScriptState<E extends ExposedValues> {
	exposed: E;
	lifecycle: ComponentLifecycle;
	scope: Scope.CloseableScope | null;
}

let globalStoreGetter: ((name: string) => unknown) | null = null;
let globalRouter: unknown = null;

export const setGlobalStoreGetter = (
	getter: (name: string) => unknown
): void => {
	globalStoreGetter = getter;
};

export const setGlobalRouter = (router: unknown): void => {
	globalRouter = router;
};

export const createScriptContext = <P, E extends ExposedValues>(
	props: P,
	storeGetter?: (name: string) => unknown
): { context: ScriptContext<P>; state: ScriptState<E> } => {
	const lifecycle = createComponentLifecycleSync();

	const state: ScriptState<E> = {
		exposed: {} as E,
		lifecycle,
		scope: lifecycle.scope,
	};

	const getStore = storeGetter ?? globalStoreGetter;

	const context: ScriptContext<P> = {
		props: Object.freeze({ ...props }),

		expose: (values: ExposedValues): void => {
			Object.assign(state.exposed, values);
		},

		signal,

		store: <T>(name: string): T => {
			if (!getStore) {
				throw new Error(
					'Store getter not configured. Call setGlobalStoreGetter() with getStore.'
				);
			}
			return getStore(name) as T;
		},

		router: (() => {
			if (!globalRouter) {
				return new Proxy(
					{},
					{
						get: () => {
							throw new Error('Router not configured. Call setGlobalRouter().');
						},
					}
				);
			}
			return globalRouter;
		})(),

		onMount: (callback): void => {
			lifecycle.onMount(callback as () => (() => void) | undefined);
		},

		onUnmount: (callback): void => {
			lifecycle.onUnmount(callback);
		},

		onBeforeMount: (callback): void => {
			lifecycle.onBeforeMount(callback);
		},

		onBeforeUnmount: (callback): void => {
			lifecycle.onBeforeUnmount(callback);
		},

		watch: <T>(
			source: Signal<T> | (() => T),
			callback: (value: T) => void
		): void => {
			const getValue =
				typeof source === 'function' ? source : () => source.value;

			createEffect(() => {
				const value = getValue();
				callback(value);
			});
		},
	};

	return { context, state };
};

export const runMountCallbacks = <E extends ExposedValues>(
	state: ScriptState<E>
): void => {
	state.lifecycle.runMount();
};

export const runUnmountCallbacks = <E extends ExposedValues>(
	state: ScriptState<E>
): void => {
	Effect.runSync(state.lifecycle.runCleanup());
};

export const runCleanupEffect = <E extends ExposedValues>(
	state: ScriptState<E>
): Effect.Effect<void> => {
	return state.lifecycle.runCleanup();
};
