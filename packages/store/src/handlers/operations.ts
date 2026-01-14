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
	StoreHandlerDeps,
	SetValueInput,
	UpdateStateInput,
} from './types.js';
import { runAdapter } from '../persistence/index.js';

const getSnapshot = (
	signalMap: Map<string, Signal<unknown>>
): Record<string, unknown> => {
	const snapshot: Record<string, unknown> = {};
	for (const [key, sig] of signalMap) {
		snapshot[key] = sig.value;
	}
	return snapshot;
};

const notifyAll = (deps: StoreHandlerDeps): void => {
	if (deps.internals.isBatching) return;
	for (const callback of deps.internals.subscribers) callback();
};

const notifyKey = (
	deps: StoreHandlerDeps,
	key: string,
	value: unknown
): void => {
	if (deps.internals.isBatching) return;
	const subs = deps.internals.keySubscribers.get(key);
	if (subs) for (const cb of subs) cb(value);
};

const persist = (deps: StoreHandlerDeps): void => {
	if (!deps.config.shouldPersist) return;
	const snapshot = getSnapshot(deps.internals.signalMap);
	runAdapter.setItem(
		deps.config.adapter,
		deps.config.storageKey,
		JSON.stringify(snapshot)
	);
};

const updateComputed = (deps: StoreHandlerDeps): void => {
	const snapshot = getSnapshot(deps.internals.signalMap);
	for (const [selector, sig] of deps.internals.computedSelectors) {
		const newValue = selector(snapshot);
		if (sig.value !== newValue) sig.value = newValue;
	}
};

const logDevtools = (
	deps: StoreHandlerDeps,
	actionType: string,
	payload: unknown,
	prevState: Record<string, unknown>,
	nextState: Record<string, unknown>
): void => {
	if (!deps.config.enableDevtools) return;
	const time = new Date().toLocaleTimeString();
	// eslint-disable-next-line no-console
	console.groupCollapsed(
		`%caction %c${deps.config.name}/${actionType} %c@ ${time}`,
		'color: gray; font-weight: lighter;',
		'color: inherit; font-weight: bold;',
		'color: gray; font-weight: lighter;'
	);
	// eslint-disable-next-line no-console
	console.log('%cprev state', 'color: #9E9E9E; font-weight: bold;', prevState);
	// eslint-disable-next-line no-console
	console.log('%caction', 'color: #03A9F4; font-weight: bold;', {
		type: actionType,
		payload,
	});
	// eslint-disable-next-line no-console
	console.log('%cnext state', 'color: #4CAF50; font-weight: bold;', nextState);
	// eslint-disable-next-line no-console
	console.groupEnd();
};

export const setValue = (
	deps: StoreHandlerDeps,
	input: SetValueInput
): boolean => {
	const { prop, value } = input;
	const { internals, atomicState, middlewareManager, config } = deps;

	if (!internals.signalMap.has(prop)) {
		internals.signalMap.set(prop, signal(value));
	}

	const sig = internals.signalMap.get(prop);
	if (!sig) return false;

	const prevState = config.enableDevtools
		? getSnapshot(internals.signalMap)
		: {};

	const newState = middlewareManager.execute(
		{ ...atomicState.get(), [prop]: value },
		`set:${prop}`,
		[value]
	);

	sig.value = newState[prop];
	atomicState.update((s) => ({ ...s, [prop]: newState[prop] }));

	logDevtools(deps, `set:${prop}`, value, prevState, {
		...atomicState.get(),
		[prop]: newState[prop],
	});

	notifyAll(deps);
	notifyKey(deps, prop, newState[prop]);
	persist(deps);
	updateComputed(deps);

	return true;
};

export const resetState = (deps: StoreHandlerDeps): void => {
	const { internals, atomicState, config } = deps;
	const prevState = config.enableDevtools
		? getSnapshot(internals.signalMap)
		: {};

	for (const [key, value] of Object.entries(internals.initialState)) {
		const sig = internals.signalMap.get(key);
		if (sig) sig.value = value;
	}
	atomicState.set({ ...internals.initialState });

	logDevtools(deps, 'reset', null, prevState, { ...internals.initialState });

	notifyAll(deps);
	persist(deps);
	updateComputed(deps);
};

export const batchUpdates = (
	deps: StoreHandlerDeps,
	updates: () => void
): void => {
	deps.internals.isBatching = true;
	try {
		updates();
	} finally {
		deps.internals.isBatching = false;
	}
	notifyAll(deps);
	persist(deps);
	updateComputed(deps);
};

export const updateState = (
	deps: StoreHandlerDeps,
	input: UpdateStateInput
): void => {
	const { internals, atomicState, config } = deps;
	const prevState = config.enableDevtools
		? getSnapshot(internals.signalMap)
		: {};

	const draft = { ...getSnapshot(internals.signalMap) };
	input.updater(draft);

	internals.isBatching = true;
	for (const [key, val] of Object.entries(draft)) {
		const sig = internals.signalMap.get(key);
		if (sig && sig.value !== val) {
			sig.value = val;
			atomicState.update((s) => ({ ...s, [key]: val }));
		}
	}
	internals.isBatching = false;

	logDevtools(
		deps,
		'update',
		null,
		prevState,
		getSnapshot(internals.signalMap)
	);

	notifyAll(deps);
	persist(deps);
	updateComputed(deps);
};

export { getSnapshot };
