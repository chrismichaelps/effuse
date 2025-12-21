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

import { Effect, Option, pipe } from 'effect';
import { signal, type Signal } from '@effuse/core';
import type {
	Store,
	StoreState,
	StoreDefinition,
	StoreOptions,
	Middleware,
} from './types.js';
import { createAtomicState } from './state.js';
import { getStoreConfig } from '../config/index.js';
import { createMiddlewareManager } from '../middleware/index.js';
import { registerStore } from '../registry/index.js';
import {
	type StorageAdapter,
	runAdapter,
	localStorageAdapter,
} from '../persistence/index.js';
import {
	createCancellationScope,
	createCancellationToken,
	type CancellationScope,
	type CancellationToken,
} from '../actions/cancellation.js';

interface StoreInternals {
	signalMap: Map<string, Signal<unknown>>;
	initialState: Record<string, unknown>;
	actions: Record<string, (...args: unknown[]) => unknown>;
	subscribers: Set<() => void>;
	keySubscribers: Map<string, Set<(value: unknown) => void>>;
	computedSelectors: Map<
		(s: Record<string, unknown>) => unknown,
		Signal<unknown>
	>;
	isBatching: boolean;
	cancellationScope: CancellationScope;
	pendingActions: Map<string, CancellationToken>;
}

const getSnapshot = (
	signalMap: Map<string, Signal<unknown>>
): Record<string, unknown> => {
	const snapshot: Record<string, unknown> = {};
	for (const [key, sig] of signalMap) {
		snapshot[key] = sig.value;
	}
	return snapshot;
};

// Store configuration options
export interface CreateStoreOptions extends StoreOptions {
	storage?: StorageAdapter;
}

// Initialize reactive store
export const createStore = <T extends object>(
	name: string,
	definition: StoreDefinition<T>,
	options?: CreateStoreOptions
): Store<T> & StoreState<T> => {
	const config = getStoreConfig();
	const shouldPersist = options?.persist ?? config.persistByDefault;
	const storageKey = options?.storageKey ?? `${config.storagePrefix}${name}`;
	const enableDevtools = options?.devtools ?? config.debug;
	const adapter = options?.storage ?? localStorageAdapter;

	if (config.debug) {
		console.log(`[store] Creating: ${name}`);
	}

	const internals: StoreInternals = {
		signalMap: new Map(),
		initialState: {},
		actions: {},
		subscribers: new Set(),
		keySubscribers: new Map(),
		computedSelectors: new Map(),
		isBatching: false,
		cancellationScope: createCancellationScope(),
		pendingActions: new Map(),
	};

	const middlewareManager = createMiddlewareManager<Record<string, unknown>>();

	for (const [key, value] of Object.entries(definition)) {
		if (typeof value === 'function') {
			internals.actions[key] = value as (...args: unknown[]) => unknown;
		} else {
			internals.initialState[key] = value;
			internals.signalMap.set(key, signal(value));
		}
	}

	const atomicState = createAtomicState({ ...internals.initialState });

	if (shouldPersist) {
		pipe(
			runAdapter.getItem(adapter, storageKey),
			Option.fromNullable,
			Option.flatMap((saved) =>
				Effect.runSync(
					Effect.try(() => JSON.parse(saved) as Record<string, unknown>).pipe(
						Effect.map(Option.some),
						Effect.catchAll(() =>
							Effect.succeed(Option.none<Record<string, unknown>>())
						)
					)
				)
			),
			Option.map((parsed) => {
				for (const [key, value] of Object.entries(parsed)) {
					const sig = internals.signalMap.get(key);
					if (sig) sig.value = value;
				}
				atomicState.set({ ...atomicState.get(), ...parsed });
			})
		);
	}

	const notifySubscribers = (): void => {
		if (internals.isBatching) return;
		for (const callback of internals.subscribers) callback();
	};

	const notifyKeySubscribers = (key: string, value: unknown): void => {
		if (internals.isBatching) return;
		const subs = internals.keySubscribers.get(key);
		if (subs) for (const cb of subs) cb(value);
	};

	const persistState = (): void => {
		if (!shouldPersist) return;
		const snapshot = getSnapshot(internals.signalMap);
		runAdapter.setItem(adapter, storageKey, JSON.stringify(snapshot));
	};

	const updateComputed = (): void => {
		const snapshot = getSnapshot(internals.signalMap);
		for (const [selector, sig] of internals.computedSelectors) {
			const newValue = selector(snapshot);
			if (sig.value !== newValue) sig.value = newValue;
		}
	};

	const stateProxy = new Proxy({} as Record<string, unknown>, {
		get(_, prop: string) {
			const sig = internals.signalMap.get(prop);
			if (sig) return sig;
			const action = internals.actions[prop];
			if (action) return action.bind(stateProxy);
			return undefined;
		},
		set(_, prop: string, value: unknown) {
			if (!internals.signalMap.has(prop)) return false;

			const sig = internals.signalMap.get(prop);
			if (!sig) return false;
			const newState = middlewareManager.execute(
				{ ...atomicState.get(), [prop]: value },
				`set:${prop}`,
				[value]
			);

			sig.value = newState[prop];
			atomicState.update((s) => ({ ...s, [prop]: newState[prop] }));

			if (enableDevtools) {
				const time = new Date().toLocaleTimeString();
				console.groupCollapsed(
					`%caction %c${name}/set:${prop} %c@ ${time}`,
					'color: gray; font-weight: lighter;',
					'color: inherit; font-weight: bold;',
					'color: gray; font-weight: lighter;'
				);
				console.log(
					'%cprev state',
					'color: #9E9E9E; font-weight: bold;',
					atomicState.get()
				);
				console.log('%caction', 'color: #03A9F4; font-weight: bold;', {
					type: `set:${prop}`,
					payload: value,
				});
				console.log('%cnext state', 'color: #4CAF50; font-weight: bold;', {
					...atomicState.get(),
					[prop]: newState[prop],
				});
				console.groupEnd();
			}

			notifySubscribers();
			notifyKeySubscribers(prop, newState[prop]);
			persistState();
			updateComputed();
			return true;
		},
	});

	const boundActions: Record<string, (...args: unknown[]) => unknown> = {};
	for (const [key, action] of Object.entries(internals.actions)) {
		boundActions[key] = (...args: unknown[]) => {
			const prevState = enableDevtools
				? getSnapshot(internals.signalMap)
				: undefined;

			const existingToken = internals.pendingActions.get(key);
			if (existingToken) {
				existingToken.cancel();
			}

			const result = action.apply(stateProxy, args);

			if (result instanceof Promise) {
				const token = createCancellationToken();
				internals.pendingActions.set(key, token);

				return result
					.then((value: unknown) => {
						if (!token.isCancelled) {
							internals.pendingActions.delete(key);
							const currentState = getSnapshot(internals.signalMap);
							middlewareManager.execute(currentState, key, args);

							if (enableDevtools) {
								const time = new Date().toLocaleTimeString();
								console.groupCollapsed(
									`%caction %c${name}/${key} (async) %c@ ${time}`,
									'color: gray; font-weight: lighter;',
									'color: inherit; font-weight: bold;',
									'color: gray; font-weight: lighter;'
								);
								console.log(
									'%cprev state',
									'color: #9E9E9E; font-weight: bold;',
									prevState
								);
								console.log('%caction', 'color: #03A9F4; font-weight: bold;', {
									type: `${name}/${key}`,
									payload: args,
								});
								console.log(
									'%cnext state',
									'color: #4CAF50; font-weight: bold;',
									currentState
								);
								console.groupEnd();
							}

							notifySubscribers();
						}
						return value;
					})
					.catch((error: unknown) => {
						internals.pendingActions.delete(key);
						throw error;
					});
			}

			const currentState = getSnapshot(internals.signalMap);
			middlewareManager.execute(currentState, key, args);

			if (enableDevtools) {
				const time = new Date().toLocaleTimeString();
				console.groupCollapsed(
					`%caction %c${name}/${key} %c@ ${time}`,
					'color: gray; font-weight: lighter;',
					'color: inherit; font-weight: bold;',
					'color: gray; font-weight: lighter;'
				);
				console.log(
					'%cprev state',
					'color: #9E9E9E; font-weight: bold;',
					prevState
				);
				console.log('%caction', 'color: #03A9F4; font-weight: bold;', {
					type: `${name}/${key}`,
					payload: args,
				});
				console.log(
					'%cnext state',
					'color: #4CAF50; font-weight: bold;',
					currentState
				);
				console.groupEnd();
			}

			notifySubscribers();

			return result;
		};
	}

	const storeState: Record<string, unknown> = {};
	for (const [key, sig] of internals.signalMap) storeState[key] = sig;
	for (const [key, action] of Object.entries(boundActions))
		storeState[key] = action;

	const store: Store<T> = {
		name,
		state: storeState as StoreState<T>,

		subscribe: (callback) => {
			internals.subscribers.add(callback);
			return () => {
				internals.subscribers.delete(callback);
			};
		},

		subscribeToKey: (key, callback) => {
			const keyStr = String(key);
			let subs = internals.keySubscribers.get(keyStr);
			if (!subs) {
				subs = new Set();
				internals.keySubscribers.set(keyStr, subs);
			}
			const typedCallback = callback as (value: unknown) => void;
			subs.add(typedCallback);
			return () => {
				internals.keySubscribers.get(keyStr)?.delete(typedCallback);
			};
		},

		getSnapshot: () =>
			getSnapshot(internals.signalMap) as ReturnType<Store<T>['getSnapshot']>,

		computed: <R>(
			selector: (snapshot: Record<string, unknown>) => R
		): Signal<R> => {
			const selectorKey = selector as (s: Record<string, unknown>) => unknown;
			const existing = internals.computedSelectors.get(selectorKey);
			if (existing) return existing as Signal<R>;

			const initial = selector(getSnapshot(internals.signalMap));
			const sig = signal<R>(initial);
			internals.computedSelectors.set(selectorKey, sig as Signal<unknown>);
			return sig;
		},

		batch: (updates) => {
			internals.isBatching = true;
			updates();
			internals.isBatching = false;
			notifySubscribers();
			persistState();
			updateComputed();
		},

		reset: () => {
			for (const [key, value] of Object.entries(internals.initialState)) {
				const sig = internals.signalMap.get(key);
				if (sig) sig.value = value;
			}
			atomicState.set({ ...internals.initialState });
			notifySubscribers();
			persistState();
			updateComputed();
		},

		use: (middleware: Middleware<Record<string, unknown>>) =>
			middlewareManager.add(middleware),

		toJSON: () =>
			getSnapshot(internals.signalMap) as ReturnType<Store<T>['getSnapshot']>,

		update: (updater) => {
			const draft = { ...getSnapshot(internals.signalMap) } as {
				[K in keyof T]: T[K] extends (...args: unknown[]) => unknown
					? never
					: T[K];
			};

			updater(draft);

			internals.isBatching = true;
			for (const [key, val] of Object.entries(draft)) {
				const sig = internals.signalMap.get(key);
				if (sig && sig.value !== val) {
					sig.value = val;
					atomicState.update((s) => ({ ...s, [key]: val }));
				}
			}
			internals.isBatching = false;

			notifySubscribers();
			persistState();
			updateComputed();
		},

		select: <R>(
			selector: (snapshot: Record<string, unknown>) => R
		): Signal<R> => {
			const selectorKey = selector as (s: Record<string, unknown>) => unknown;
			const existing = internals.computedSelectors.get(selectorKey);
			if (existing) return existing as Signal<R>;

			const initial = selector(getSnapshot(internals.signalMap));
			const sig = signal<R>(initial);
			internals.computedSelectors.set(selectorKey, sig as Signal<unknown>);

			internals.subscribers.add(() => {
				const newValue = selector(getSnapshot(internals.signalMap));
				if (sig.value !== newValue) sig.value = newValue;
			});

			return sig;
		},
	};

	const storeProxy = new Proxy(store as unknown as Record<string, unknown>, {
		get(target, prop: string | symbol): unknown {
			const propStr = String(prop);
			if (propStr === 'toJSON') return () => getSnapshot(internals.signalMap);
			if (propStr in target) return target[propStr];
			const sig = internals.signalMap.get(propStr);
			if (sig) return sig;
			if (propStr in boundActions) return boundActions[propStr];
			return undefined;
		},
	}) as Store<T> & StoreState<T>;

	registerStore(name, storeProxy);
	return storeProxy;
};
