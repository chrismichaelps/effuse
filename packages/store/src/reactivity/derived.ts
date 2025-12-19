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

import { Effect, Option } from 'effect';
import { signal, type Signal } from '@effuse/core';
import type { Store } from '../core/types.js';
import { getStoreNames, getStore } from '../registry/index.js';
import {
	createCancellationToken,
	type CancellationToken,
} from '../actions/cancellation.js';

export const deriveFrom = <S extends Store<unknown>[], R>(
	stores: [...S],
	selector: (
		...snapshots: { [K in keyof S]: ReturnType<S[K]['getSnapshot']> }
	) => R
): Signal<R> & { cleanup: () => void } => {
	const getSnapshots = () =>
		stores.map((s) => s.getSnapshot()) as {
			[K in keyof S]: ReturnType<S[K]['getSnapshot']>;
		};

	const initialValue = selector(...getSnapshots());
	const derivedSignal = signal<R>(initialValue);

	const update = () => {
		const newValue = selector(...getSnapshots());
		if (derivedSignal.value !== newValue) {
			derivedSignal.value = newValue;
		}
	};

	const unsubscribers = stores.map((store) => store.subscribe(update));

	const signalWithCleanup = derivedSignal as Signal<R> & {
		cleanup: () => void;
	};
	signalWithCleanup.cleanup = () => {
		for (const unsub of unsubscribers) {
			unsub();
		}
	};

	return signalWithCleanup;
};

export const deriveFromAsync = <S extends Store<unknown>[], R>(
	stores: [...S],
	asyncSelector: (
		snapshots: { [K in keyof S]: ReturnType<S[K]['getSnapshot']> },
		token: CancellationToken
	) => Promise<R>,
	initialValue: R
): Signal<R> & { cleanup: () => void; pending: Signal<boolean> } => {
	const getSnapshots = () =>
		stores.map((s) => s.getSnapshot()) as {
			[K in keyof S]: ReturnType<S[K]['getSnapshot']>;
		};

	const derivedSignal = signal<R>(initialValue);
	const pendingSignal = signal<boolean>(false);
	let currentToken = createCancellationToken();

	const update = () => {
		currentToken.cancel();
		currentToken = createCancellationToken();
		const myToken = currentToken;
		pendingSignal.value = true;

		asyncSelector(getSnapshots(), myToken)
			.then((newValue) => {
				if (!myToken.isCancelled && derivedSignal.value !== newValue) {
					derivedSignal.value = newValue;
				}
			})
			.catch(() => {})
			.finally(() => {
				if (!myToken.isCancelled) {
					pendingSignal.value = false;
				}
			});
	};

	const unsubscribers = stores.map((store) => store.subscribe(update));
	update();

	const signalWithCleanup = derivedSignal as Signal<R> & {
		cleanup: () => void;
		pending: Signal<boolean>;
	};
	signalWithCleanup.cleanup = () => {
		currentToken.cancel();
		for (const unsub of unsubscribers) {
			unsub();
		}
	};
	signalWithCleanup.pending = pendingSignal;

	return signalWithCleanup;
};

export const serializeStores = (): string => {
	const storeNames = getStoreNames();
	const allSnapshots: Record<string, unknown> = {};
	for (const name of storeNames) {
		const store = getStore(name);
		allSnapshots[name] = (store as Store<unknown>).getSnapshot();
	}
	return JSON.stringify(allSnapshots);
};

export const hydrateStores = (serialized: string): Effect.Effect<void> =>
	Effect.try({
		try: () => {
			const allSnapshots = JSON.parse(serialized) as Record<
				string,
				Record<string, unknown>
			>;
			for (const [name, snapshot] of Object.entries(allSnapshots)) {
				Effect.runSync(
					Effect.try(() => {
						const store = getStore(name);
						(store as Store<unknown>).update((draft) => {
							Object.assign(draft, snapshot);
						});
					}).pipe(Effect.catchAll(() => Effect.void))
				);
			}
		},
		catch: () => new Error('Failed to hydrate stores'),
	}).pipe(Effect.catchAll(() => Effect.void));

export const hydrateStoresSync = (serialized: string): void => {
	Effect.runSync(
		hydrateStores(serialized).pipe(
			Effect.match({
				onSuccess: () => Option.some(undefined),
				onFailure: () => Option.none(),
			})
		)
	);
};
