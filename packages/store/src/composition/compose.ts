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
import type { Store, StoreDefinition } from '../core/types.js';
import { createStore as createStoreImpl } from '../core/store.js';
import {
	createCancellationToken,
	type CancellationToken,
} from '../actions/cancellation.js';

export interface ComposedStore<T, D extends readonly Store<unknown>[]> {
	store: Store<T>;
	dependencies: D;
	computed: <R>(
		selector: (
			state: T,
			deps: { [K in keyof D]: ReturnType<D[K]['getSnapshot']> }
		) => R
	) => Signal<R>;
	computedAsync: <R>(
		asyncSelector: (
			state: T,
			deps: { [K in keyof D]: ReturnType<D[K]['getSnapshot']> },
			token: CancellationToken
		) => Promise<R>,
		initialValue: R
	) => Signal<R> & { pending: Signal<boolean>; cleanup: () => void };
}

export const composeStores = <T, D extends readonly Store<unknown>[]>(
	mainStore: Store<T>,
	dependencies: D
): ComposedStore<T, D> => {
	const getDependencySnapshots = (): {
		[K in keyof D]: ReturnType<D[K]['getSnapshot']>;
	} => {
		return dependencies.map((dep) => dep.getSnapshot()) as {
			[K in keyof D]: ReturnType<D[K]['getSnapshot']>;
		};
	};

	return {
		store: mainStore,
		dependencies,
		computed: <R>(
			selector: (
				state: T,
				deps: { [K in keyof D]: ReturnType<D[K]['getSnapshot']> }
			) => R
		): Signal<R> => {
			const mainSnapshot = mainStore.getSnapshot() as T;
			const depSnapshots = getDependencySnapshots();
			const initialValue = selector(mainSnapshot, depSnapshots);
			const derived = signal<R>(initialValue);

			const update = () => {
				const mainState = mainStore.getSnapshot() as T;
				const depStates = getDependencySnapshots();
				const newValue = selector(mainState, depStates);
				if (derived.value !== newValue) {
					derived.value = newValue;
				}
			};

			mainStore.subscribe(update);
			for (const dep of dependencies) {
				dep.subscribe(update);
			}

			return derived;
		},
		computedAsync: <R>(
			asyncSelector: (
				state: T,
				deps: { [K in keyof D]: ReturnType<D[K]['getSnapshot']> },
				token: CancellationToken
			) => Promise<R>,
			initialValue: R
		): Signal<R> & { pending: Signal<boolean>; cleanup: () => void } => {
			const derived = signal<R>(initialValue);
			const pending = signal<boolean>(false);
			let currentToken = createCancellationToken();
			const unsubscribers: (() => void)[] = [];

			const update = () => {
				currentToken.cancel();
				currentToken = createCancellationToken();
				const myToken = currentToken;
				pending.value = true;

				const mainState = mainStore.getSnapshot() as T;
				const depStates = getDependencySnapshots();

				asyncSelector(mainState, depStates, myToken)
					.then((newValue) => {
						if (!myToken.isCancelled && derived.value !== newValue) {
							derived.value = newValue;
						}
					})
					.catch(() => {})
					.finally(() => {
						if (!myToken.isCancelled) {
							pending.value = false;
						}
					});
			};

			unsubscribers.push(mainStore.subscribe(update));
			for (const dep of dependencies) {
				unsubscribers.push(dep.subscribe(update));
			}
			update();

			const result = derived as Signal<R> & {
				pending: Signal<boolean>;
				cleanup: () => void;
			};
			result.pending = pending;
			result.cleanup = () => {
				currentToken.cancel();
				for (const unsub of unsubscribers) unsub();
			};

			return result;
		},
	};
};

export interface StoreSlice<T extends object, P extends object> {
	create: (parent: Store<P>) => Store<T>;
}

export const defineSlice = <T extends object, P extends object>(
	name: string,
	factory: (parent: Store<P>) => StoreDefinition<T>
): StoreSlice<T, P> => {
	return {
		create: (parent: Store<P>): Store<T> => {
			const definition = factory(parent);
			return createStoreImpl<T>(name, definition);
		},
	};
};

export const mergeStores = <A, B>(
	storeA: Store<A>,
	storeB: Store<B>
): {
	getSnapshot: () => ReturnType<Store<A>['getSnapshot']> &
		ReturnType<Store<B>['getSnapshot']>;
	subscribe: (callback: () => void) => () => void;
} => {
	return {
		getSnapshot: () => ({
			...storeA.getSnapshot(),
			...storeB.getSnapshot(),
		}),
		subscribe: (callback: () => void) => {
			const unsubA = storeA.subscribe(callback);
			const unsubB = storeB.subscribe(callback);
			return () => {
				unsubA();
				unsubB();
			};
		},
	};
};
