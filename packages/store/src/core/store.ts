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
import type {
	Store,
	StoreState,
	StoreDefinition,
	StoreOptions,
	Middleware,
	StoreSnapshot,
} from './types.js';
import { createAtomicState } from './state.js';
import { getStoreConfig } from '../config/index.js';
import { createMiddlewareManager } from '../middleware/index.js';
import { registerStore, removeStore } from '../registry/index.js';
import {
	type StorageAdapter,
	localStorageAdapter,
} from '../persistence/index.js';
import {
	createCancellationScope,
	createCancellationToken,
} from '../actions/cancellation.js';
import {
	setValue,
	resetState,
	batchUpdates,
	updateState,
	addSubscriber,
	addKeySubscriber,
	getSnapshot,
	type StoreInternals,
	type StoreHandlerDeps,
} from '../handlers/index.js';

export interface CreateStoreOptions extends StoreOptions {
	storage?: StorageAdapter;
}

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
		// eslint-disable-next-line no-console
		console.log(`[store] Creating: ${name}`);
	}

	const internals: StoreInternals = {
		signalMap: new Map(),
		initialState: {},
		actions: {},
		subscribers: new Set(),
		keySubscribers: new Map(),
		computedSelectors: new Map(),
		computedSelectorCleanups: new Map(),
		batchDepth: 0,
		cancellationScope: createCancellationScope(),
		pendingActions: new Map(),
		destroyed: false,
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

	const handlerDeps: StoreHandlerDeps = {
		internals,
		atomicState,
		middlewareManager,
		config: {
			name,
			shouldPersist,
			storageKey,
			enableDevtools,
			adapter,
		},
	};

	if (shouldPersist) {
		try {
			const saved = adapter.getItem(storageKey);
			if (saved !== null) {
				const parsed = JSON.parse(saved) as Record<string, unknown>;
				for (const [key, value] of Object.entries(parsed)) {
					const sig = internals.signalMap.get(key);
					if (sig) sig.value = value;
				}
				atomicState.set({ ...atomicState.get(), ...parsed });
			}
		} catch {
			// Ignore parse errors for corrupted storage
		}
	}

	const stateProxy = new Proxy({} as Record<string, unknown>, {
		get(_, prop: string) {
			const sig = internals.signalMap.get(prop);
			if (sig) return sig;
			const action = internals.actions[prop];
			if (action) return action.bind(stateProxy);
			return undefined;
		},
		set(_, prop: string, value: unknown) {
			return setValue(handlerDeps, { prop, value });
		},
	});

	const boundActions: Record<string, (...args: unknown[]) => unknown> = {};
	for (const [key, action] of Object.entries(internals.actions)) {
		boundActions[key] = (...args: unknown[]) => {
			if (internals.destroyed) {
				throw new Error(
					`Cannot call action "${key}" on destroyed store "${name}"`
				);
			}

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
								// eslint-disable-next-line no-console
								console.groupCollapsed(
									`%caction %c${name}/${key} (async) %c@ ${time}`,
									'color: gray; font-weight: lighter;',
									'color: inherit; font-weight: bold;',
									'color: gray; font-weight: lighter;'
								);
								// eslint-disable-next-line no-console
								console.log(
									'%cprev state',
									'color: #9E9E9E; font-weight: bold;',
									prevState
								);
								// eslint-disable-next-line no-console
								console.log(
									'%caction',
									'color: #03A9F4; font-weight: bold;',
									{
										type: `${name}/${key}`,
										payload: args,
									}
								);
								// eslint-disable-next-line no-console
								console.log(
									'%cnext state',
									'color: #4CAF50; font-weight: bold;',
									currentState
								);
								// eslint-disable-next-line no-console
								console.groupEnd();
							}

							for (const callback of internals.subscribers)
								callback();
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
				// eslint-disable-next-line no-console
				console.groupCollapsed(
					`%caction %c${name}/${key} %c@ ${time}`,
					'color: gray; font-weight: lighter;',
					'color: inherit; font-weight: bold;',
					'color: gray; font-weight: lighter;'
				);
				// eslint-disable-next-line no-console
				console.log(
					'%cprev state',
					'color: #9E9E9E; font-weight: bold;',
					prevState
				);
				// eslint-disable-next-line no-console
				console.log('%caction', 'color: #03A9F4; font-weight: bold;', {
					type: `${name}/${key}`,
					payload: args,
				});
				// eslint-disable-next-line no-console
				console.log(
					'%cnext state',
					'color: #4CAF50; font-weight: bold;',
					currentState
				);
				// eslint-disable-next-line no-console
				console.groupEnd();
			}

			for (const callback of internals.subscribers) callback();

			return result;
		};
	}

	const storeState: Record<string, unknown> = {};
	for (const [key, sig] of internals.signalMap) storeState[key] = sig;
	for (const [key, action] of Object.entries(boundActions))
		storeState[key] = action;

	const getSnapshotTyped = (): StoreSnapshot<T> =>
		getSnapshot(internals.signalMap) as StoreSnapshot<T>;

	const getTyped = <K extends keyof StoreSnapshot<T>>(
		key: K
	): StoreSnapshot<T>[K] => {
		const sig = internals.signalMap.get(key as string);
		return (sig?.value ?? undefined) as StoreSnapshot<T>[K];
	};

	const setTyped = <K extends keyof StoreSnapshot<T>>(
		key: K,
		value: StoreSnapshot<T>[K]
	): void => {
		setValue(handlerDeps, { prop: key as string, value });
	};

	const patch = (partial: Partial<StoreSnapshot<T>>): void => {
		batchUpdates(handlerDeps, () => {
			for (const [key, value] of Object.entries(partial)) {
				setValue(handlerDeps, { prop: key, value });
			}
		});
	};

	const toggle = (key: keyof StoreSnapshot<T>): void => {
		const sig = internals.signalMap.get(key as string);
		if (sig && typeof sig.value === 'boolean') {
			setValue(handlerDeps, { prop: key as string, value: !sig.value });
		}
	};

	// eslint-disable-next-line @typescript-eslint/no-unnecessary-type-parameters
	const resetKey = <K extends keyof StoreSnapshot<T>>(key: K): void => {
		const initial = internals.initialState[key as string];
		if (initial !== undefined) {
			setValue(handlerDeps, { prop: key as string, value: initial });
		}
	};

	const watch = <R>(
		selector: (snapshot: StoreSnapshot<T>) => R,
		callback: (newValue: R, oldValue: R | undefined) => void,
		equalityFn: (a: R, b: R) => boolean = Object.is
	): (() => void) => {
		let lastValue: R | undefined;
		const update = () => {
			const snapshot = getSnapshotTyped();
			const newValue = selector(snapshot);
			if (lastValue === undefined || !equalityFn(newValue, lastValue)) {
				const oldValue = lastValue;
				lastValue = newValue;
				callback(newValue, oldValue);
			}
		};
		update();
		return addSubscriber(internals, { callback: update });
	};

	const selectOrCompute = <R>(
		selector: (snapshot: Record<string, unknown>) => R
	): Signal<R> => {
		const selectorKey = selector as (s: Record<string, unknown>) => unknown;
		const existing = internals.computedSelectors.get(selectorKey);
		if (existing) return existing as Signal<R>;

		const initial = selector(getSnapshot(internals.signalMap));
		const sig = signal<R>(initial);
		internals.computedSelectors.set(selectorKey, sig as Signal<unknown>);

		const update = () => {
			const snapshot = getSnapshot(internals.signalMap);
			const newValue = selector(snapshot);
			if (sig.value !== newValue) {
				sig.value = newValue;
			}
		};
		const unsub = addSubscriber(internals, { callback: update });

		let cleanups = internals.computedSelectorCleanups.get(selectorKey);
		if (!cleanups) {
			cleanups = [];
			internals.computedSelectorCleanups.set(selectorKey, cleanups);
		}
		cleanups.push(unsub);

		return sig;
	};

	const destroy = (): void => {
		if (internals.destroyed) return;
		internals.destroyed = true;
		internals.cancellationScope.dispose();
		internals.subscribers.clear();
		internals.keySubscribers.clear();
		internals.pendingActions.clear();
		for (const cleanups of internals.computedSelectorCleanups.values()) {
			for (const cleanup of cleanups) cleanup();
		}
		internals.computedSelectors.clear();
		internals.computedSelectorCleanups.clear();
		removeStore(name);
	};

	const store: Store<T> = {
		name,
		state: storeState as StoreState<T>,

		subscribe: (callback) => addSubscriber(internals, { callback }),

		subscribeToKey: (key, callback) => {
			const keyStr = String(key);
			const typedCallback = callback as (value: unknown) => void;
			return addKeySubscriber(internals, {
				key: keyStr,
				callback: typedCallback,
			});
		},

		subscribeToKeys: (keys, callback) => {
			const lastValues: Record<string, unknown> = {};
			const checkAndNotify = () => {
				const snapshot = getSnapshot(internals.signalMap);
				let changed = false;
				for (const key of keys) {
					const newValue = snapshot[key as string];
					if (newValue !== lastValues[key as string]) {
						lastValues[key as string] = newValue;
						changed = true;
					}
				}
				if (changed) {
					const picked: Record<string, unknown> = {};
					for (const key of keys) {
						picked[key as string] = snapshot[key as string];
					}
					callback(picked as Pick<StoreSnapshot<T>, typeof keys[number]>);
				}
			};
			return addSubscriber(internals, { callback: checkAndNotify });
		},

		getSnapshot: getSnapshotTyped,

		get: getTyped,

		set: setTyped,

		patch,

		toggle,

		resetKey,

		watch,

		computed: selectOrCompute,

		batch: <R>(updates: () => R): R => {
			return batchUpdates(handlerDeps, updates);
		},

		reset: () => {
			resetState(handlerDeps);
		},

		use: (middleware: Middleware<Record<string, unknown>>) =>
			middlewareManager.add(middleware),

		toJSON: getSnapshotTyped,

		update: (updater) => {
			updateState(handlerDeps, {
				updater: updater as (d: Record<string, unknown>) => void,
			});
		},

		select: selectOrCompute,

		destroy,
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
		set(target, prop: string | symbol, value: unknown): boolean {
			const propStr = String(prop);
			if (propStr in target) {
				return false;
			}
			return setValue(handlerDeps, { prop: propStr, value });
		},
	}) as Store<T> & StoreState<T>;

	registerStore(name, storeProxy);
	return storeProxy;
};
