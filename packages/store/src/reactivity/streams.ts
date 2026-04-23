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

import type { Store } from '../core/types.js';
import {
	createCancellationToken,
	type CancellationToken,
} from '../actions/cancellation.js';

export interface StoreStream<T> {
	subscribe: (handler: (value: T) => void) => () => void;
	map: <R>(fn: (value: T) => R) => StoreStream<R>;
	filter: (predicate: (value: T) => boolean) => StoreStream<T>;
	debounce: (ms: number) => StoreStream<T>;
	throttle: (ms: number) => StoreStream<T>;
	takeLatest: <R>(
		asyncHandler: (value: T, token: CancellationToken) => Promise<R>
	) => StoreStream<R>;
}

type Listener<T> = (value: T) => void;
type Unsubscribe = () => void;
type AddListener<T> = (handler: Listener<T>) => Unsubscribe;

const createBaseStream = <T>(addListener: AddListener<T>): StoreStream<T> => {
	return {
		subscribe: addListener,

		map: <R>(fn: (value: T) => R): StoreStream<R> => {
			const mappedListeners = new Set<Listener<R>>();
			let parentUnsub: Unsubscribe | null = null;

			const ensureParent = (): void => {
				if (!parentUnsub) {
					parentUnsub = addListener((value) => {
						const mapped = fn(value);
						for (const h of mappedListeners) h(mapped);
					});
				}
			};

			const removeParent = (): void => {
				if (mappedListeners.size === 0 && parentUnsub) {
					parentUnsub();
					parentUnsub = null;
				}
			};

			return createBaseStream((h) => {
				ensureParent();
				mappedListeners.add(h);
				return () => {
					mappedListeners.delete(h);
					removeParent();
				};
			});
		},

		filter: (predicate): StoreStream<T> => {
			const filteredListeners = new Set<Listener<T>>();
			let parentUnsub: Unsubscribe | null = null;

			const ensureParent = (): void => {
				if (!parentUnsub) {
					parentUnsub = addListener((value) => {
						if (predicate(value)) {
							for (const h of filteredListeners) h(value);
						}
					});
				}
			};

			const removeParent = (): void => {
				if (filteredListeners.size === 0 && parentUnsub) {
					parentUnsub();
					parentUnsub = null;
				}
			};

			return createBaseStream((h) => {
				ensureParent();
				filteredListeners.add(h);
				return () => {
					filteredListeners.delete(h);
					removeParent();
				};
			});
		},

		debounce: (ms): StoreStream<T> => {
			const debouncedListeners = new Set<Listener<T>>();
			let parentUnsub: Unsubscribe | null = null;
			let timeout: ReturnType<typeof setTimeout> | null = null;
			let latestValue: T | undefined;
			let currentToken = createCancellationToken();

			const ensureParent = (): void => {
				if (!parentUnsub) {
					parentUnsub = addListener((value) => {
						latestValue = value;
						if (timeout) {
							clearTimeout(timeout);
							currentToken.cancel();
						}
						currentToken = createCancellationToken();
						const myToken = currentToken;

						timeout = setTimeout(() => {
							if (!myToken.isCancelled && latestValue !== undefined) {
								for (const h of debouncedListeners) h(latestValue);
							}
						}, ms);
					});
				}
			};

			const removeParent = (): void => {
				if (debouncedListeners.size === 0 && parentUnsub) {
					parentUnsub();
					parentUnsub = null;
					if (timeout) {
						clearTimeout(timeout);
						currentToken.cancel();
					}
				}
			};

			return createBaseStream((h) => {
				ensureParent();
				debouncedListeners.add(h);
				return () => {
					debouncedListeners.delete(h);
					removeParent();
				};
			});
		},

		throttle: (ms): StoreStream<T> => {
			const throttledListeners = new Set<Listener<T>>();
			let parentUnsub: Unsubscribe | null = null;
			let lastEmitTime = 0;

			const ensureParent = (): void => {
				if (!parentUnsub) {
					parentUnsub = addListener((value) => {
						const now = Date.now();
						if (now - lastEmitTime >= ms) {
							lastEmitTime = now;
							for (const h of throttledListeners) h(value);
						}
					});
				}
			};

			const removeParent = (): void => {
				if (throttledListeners.size === 0 && parentUnsub) {
					parentUnsub();
					parentUnsub = null;
				}
			};

			return createBaseStream((h) => {
				ensureParent();
				throttledListeners.add(h);
				return () => {
					throttledListeners.delete(h);
					removeParent();
				};
			});
		},

		takeLatest: <R>(
			asyncHandler: (value: T, token: CancellationToken) => Promise<R>
		): StoreStream<R> => {
			const latestListeners = new Set<Listener<R>>();
			let parentUnsub: Unsubscribe | null = null;
			let currentToken = createCancellationToken();

			const ensureParent = (): void => {
				if (!parentUnsub) {
					parentUnsub = addListener((value) => {
						currentToken.cancel();
						currentToken = createCancellationToken();
						const myToken = currentToken;

						asyncHandler(value, myToken)
							.then((result) => {
								if (!myToken.isCancelled) {
									for (const h of latestListeners) h(result);
								}
							})
							.catch(() => {});
					});
				}
			};

			const removeParent = (): void => {
				if (latestListeners.size === 0 && parentUnsub) {
					parentUnsub();
					parentUnsub = null;
					currentToken.cancel();
				}
			};

			return createBaseStream((h) => {
				ensureParent();
				latestListeners.add(h);
				return () => {
					latestListeners.delete(h);
					removeParent();
				};
			});
		},
	};
};

export const createStoreStream = <T, K extends keyof T>(
	store: Store<T>,
	key: K
): StoreStream<T[K]> => {
	const listeners = new Set<Listener<T[K]>>();
	let lastValue: T[K] = (store.getSnapshot() as Record<string, unknown>)[
		key as string
	] as T[K];

	const unsub = store.subscribe(() => {
		const snapshot = store.getSnapshot() as Record<string, unknown>;
		const newValue = snapshot[key as string] as T[K];
		if (newValue !== lastValue) {
			lastValue = newValue;
			for (const listener of listeners) {
				listener(newValue);
			}
		}
	});

	return createBaseStream((handler) => {
		listeners.add(handler);
		return () => {
			listeners.delete(handler);
			if (listeners.size === 0) {
				unsub();
			}
		};
	});
};

export const streamAll = <T>(
	store: Store<T>
): StoreStream<ReturnType<Store<T>['getSnapshot']>> => {
	const listeners = new Set<Listener<ReturnType<Store<T>['getSnapshot']>>>();

	const unsub = store.subscribe(() => {
		const snapshot = store.getSnapshot();
		for (const listener of listeners) {
			listener(snapshot);
		}
	});

	return createBaseStream((handler) => {
		listeners.add(handler);
		return () => {
			listeners.delete(handler);
			if (listeners.size === 0) {
				unsub();
			}
		};
	});
};
