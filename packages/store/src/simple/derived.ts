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
import type { Store } from './types.js';
import { getStoreNames, getStore } from '../registry/index.js';

export const deriveFrom = <S extends Store<unknown>[], R>(
	stores: [...S],
	selector: (
		...snapshots: { [K in keyof S]: ReturnType<S[K]['getSnapshot']> }
	) => R
): Signal<R> => {
	const getSnapshots = () =>
		stores.map((s) => s.getSnapshot()) as {
			[K in keyof S]: ReturnType<S[K]['getSnapshot']>;
		};

	const initialValue = selector(...getSnapshots());
	const derivedSignal = signal<R>(initialValue);

	const update = () => {
		const newValue = selector(...getSnapshots());
		const currentValue: unknown = derivedSignal.value;
		if (currentValue !== newValue) {
			derivedSignal.value = newValue;
		}
	};

	for (const store of stores) {
		store.subscribe(update);
	}

	const signalWithCleanup = derivedSignal as Signal<R> & {
		cleanup?: () => void;
	};
	signalWithCleanup.cleanup = () => {
		for (const store of stores) {
			const unsub = store.subscribe(update);
			unsub();
		}
	};

	return signalWithCleanup;
};

export const serializeStores = (): string => {
	const storeNames = getStoreNames();
	const allSnapshots: Record<string, unknown> = {};
	for (const name of storeNames) {
		const store = getStore(name);
		if (store) {
			allSnapshots[name] = (store as Store<unknown>).getSnapshot();
		}
	}
	return JSON.stringify(allSnapshots);
};

export const hydrateStores = (serialized: string): void => {
	try {
		const allSnapshots = JSON.parse(serialized) as Record<
			string,
			Record<string, unknown>
		>;
		for (const [name, snapshot] of Object.entries(allSnapshots)) {
			const store = getStore(name);
			if (store) {
				(store as Store<unknown>).update((draft) => {
					Object.assign(draft, snapshot);
				});
			}
		}
	} catch {
		console.error('[store] Failed to hydrate stores');
	}
};
