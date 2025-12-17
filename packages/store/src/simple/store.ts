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
} from './types.js';
import { createAtomicState } from './state.js';
import { getConfig } from './config.js';
import { createMiddlewareManager } from './middleware.js';
import { registerStore } from '../registry/index.js';
import type { StorageAdapter } from './persistence.js';

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
}

const getSignalFromMap = (
	signalMap: Map<string, Signal<unknown>>,
	key: string
): Signal<unknown> | undefined => signalMap.get(key);

const setSignalValue = (
	signalMap: Map<string, Signal<unknown>>,
	key: string,
	value: unknown
): void => {
	const sig = signalMap.get(key);
	if (sig) sig.value = value;
};

const getSignalValue = (
	signalMap: Map<string, Signal<unknown>>,
	key: string
): unknown => {
	const sig = signalMap.get(key);
	return sig ? sig.value : undefined;
};

const getSnapshotFromSignals = (
	signalMap: Map<string, Signal<unknown>>
): Record<string, unknown> => {
	const snapshot: Record<string, unknown> = {};
	for (const key of signalMap.keys()) {
		snapshot[key] = getSignalValue(signalMap, key);
	}
	return snapshot;
};

export interface CreateStoreOptions extends StoreOptions {
	storage?: StorageAdapter;
}

export const createStore = <T extends object>(
	name: string,
	definition: StoreDefinition<T>,
	options?: CreateStoreOptions
): Store<T> & StoreState<T> => {
	const config = getConfig();
	const shouldPersist = options?.persist ?? config.persistByDefault;
	const storageKey = options?.storageKey ?? `${config.storagePrefix}${name}`;
	const enableDevtools = options?.devtools ?? config.debug;

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
		try {
			const saved = localStorage.getItem(storageKey);
			if (saved) {
				const parsed = JSON.parse(saved) as Record<string, unknown>;
				for (const [key, value] of Object.entries(parsed)) {
					setSignalValue(internals.signalMap, key, value);
				}
				atomicState.set({ ...atomicState.get(), ...parsed });
			}
		} catch {}
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
		const snapshot = getSnapshotFromSignals(internals.signalMap);
		try {
			localStorage.setItem(storageKey, JSON.stringify(snapshot));
		} catch {}
	};

	const updateComputed = (): void => {
		const snapshot = getSnapshotFromSignals(internals.signalMap);
		for (const [selector, sig] of internals.computedSelectors) {
			const newValue = selector(snapshot);
			if (sig.value !== newValue) sig.value = newValue;
		}
	};

	const stateProxy = new Proxy({} as Record<string, unknown>, {
		get(_, prop: string) {
			const sig = getSignalFromMap(internals.signalMap, prop);
			if (sig) return sig;
			const action = internals.actions[prop];
			if (action) return action.bind(stateProxy);
			return undefined;
		},
		set(_, prop: string, value: unknown) {
			if (!internals.signalMap.has(prop)) return false;

			const oldValue = getSignalValue(internals.signalMap, prop);
			const newState = middlewareManager.execute(
				{ ...atomicState.get(), [prop]: value },
				`set:${prop}`,
				[value]
			);

			setSignalValue(internals.signalMap, prop, newState[prop]);
			atomicState.update((s) => ({ ...s, [prop]: newState[prop] }));

			if (enableDevtools) {
				console.log(`[${name}] ${prop}:`, oldValue, '->', newState[prop]);
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
			if (enableDevtools) {
				console.log(`[${name}] ${key}(`, ...args, ')');
			}
			return action.apply(stateProxy, args);
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
			getSnapshotFromSignals(internals.signalMap) as ReturnType<
				Store<T>['getSnapshot']
			>,

		computed: <R>(
			selector: (snapshot: Record<string, unknown>) => R
		): Signal<R> => {
			const selectorKey = selector as (s: Record<string, unknown>) => unknown;
			const existing = internals.computedSelectors.get(selectorKey);
			if (existing) return existing as Signal<R>;

			const initial = selector(getSnapshotFromSignals(internals.signalMap));
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
				setSignalValue(internals.signalMap, key, value);
			}
			atomicState.set({ ...internals.initialState });
			notifySubscribers();
			persistState();
			updateComputed();
		},

		use: (middleware: Middleware<Record<string, unknown>>) =>
			middlewareManager.add(middleware),

		toJSON: () =>
			getSnapshotFromSignals(internals.signalMap) as ReturnType<
				Store<T>['getSnapshot']
			>,

		update: (updater) => {
			const draft = { ...getSnapshotFromSignals(internals.signalMap) } as {
				[K in keyof T]: T[K] extends (...args: unknown[]) => unknown
					? never
					: T[K];
			};

			updater(draft);

			internals.isBatching = true;
			for (const [key, val] of Object.entries(draft)) {
				const currentValue = getSignalValue(internals.signalMap, key);
				if (internals.signalMap.has(key) && currentValue !== val) {
					setSignalValue(internals.signalMap, key, val);
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

			const initial = selector(getSnapshotFromSignals(internals.signalMap));
			const sig = signal<R>(initial);
			internals.computedSelectors.set(selectorKey, sig as Signal<unknown>);

			internals.subscribers.add(() => {
				const newValue = selector(getSnapshotFromSignals(internals.signalMap));
				if (sig.value !== newValue) sig.value = newValue;
			});

			return sig;
		},
	};

	const storeProxy = new Proxy(store as unknown as Record<string, unknown>, {
		get(target, prop: string | symbol): unknown {
			const propStr = String(prop);
			if (propStr === 'toJSON')
				return () => getSnapshotFromSignals(internals.signalMap);
			if (propStr in target) return target[propStr];
			const sig = getSignalFromMap(internals.signalMap, propStr);
			if (sig) return sig;
			if (propStr in boundActions) return boundActions[propStr];
			return undefined;
		},
	}) as Store<T> & StoreState<T>;

	registerStore(name, storeProxy);
	return storeProxy;
};
