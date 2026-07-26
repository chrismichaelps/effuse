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

import { signal } from '../reactivity/index.js';
import type { Signal } from '../reactivity/signal.js';
import { devWarn } from '../utils/dev-warnings.js';

export interface ReactiveProps<P extends object> {
	/** Readonly reactive proxy — each read tracks the underlying signal. */
	readonly proxy: Readonly<P>;
	/** Underlying signals for each prop key. */
	readonly signals: Map<string | symbol, Signal<unknown>>;
	/** Update signal values from new props (for in-place reconciliation). */
	update(newProps: P): void;
}

export interface ReactivePropsOptions {
	readonly warnOnMissing?: boolean;
}

/**
 * Create a readonly reactive proxy backed by signals.
 *
 * Reading a property (e.g. `props.title`) returns the signal's current value
 * and is automatically tracked by any enclosing `computed` or `watch`.
 *
 * Writing a property logs a dev-mode warning (props are readonly by design).
 */
export const createReactiveProps = <P extends object>(
	initialProps: P,
	options: ReactivePropsOptions = {}
): ReactiveProps<P> => {
	const signals = new Map<string | symbol, Signal<unknown>>();
	const enumerableKeys = (value: object): Array<string | symbol> =>
		Reflect.ownKeys(value).filter((key) =>
			Object.prototype.propertyIsEnumerable.call(value, key)
		);
	const readValue = (value: object, key: PropertyKey): unknown =>
		(value as Record<PropertyKey, unknown>)[key];
	const formatKey = (key: string | symbol): string =>
		typeof key === 'symbol' ? String(key) : `"${key}"`;

	for (const key of enumerableKeys(initialProps)) {
		signals.set(key, signal(readValue(initialProps, key)));
	}

	const proxy = new Proxy({} as P, {
		get(_, key: string | symbol) {
			const sig = signals.get(key);
			if (sig === undefined && options.warnOnMissing === true) {
				devWarn(
					`Accessed missing prop ${formatKey(key)}. ` +
						`Did you forget to pass it, or is this a typo?`
				);
			}
			return sig !== undefined ? sig.value : undefined;
		},
		set(_, key: string | symbol) {
			devWarn(
				`Attempted to mutate prop ${formatKey(key)}. Props are readonly. ` +
					`Use local state (signal/computed) or emit events to the parent instead.`
			);
			return true;
		},
		has(_, key: string | symbol) {
			return signals.has(key);
		},
		ownKeys() {
			return Array.from(signals.keys());
		},
		getOwnPropertyDescriptor(_, key: string | symbol) {
			if (signals.has(key)) {
				return {
					enumerable: true,
					configurable: true,
				};
			}
			return undefined;
		},
	});

	const update = (newProps: P): void => {
		const newKeys = new Set(enumerableKeys(newProps));
		for (const key of signals.keys()) {
			if (!newKeys.has(key)) {
				signals.delete(key);
			}
		}
		for (const key of newKeys) {
			const value = readValue(newProps, key);
			const existing = signals.get(key);
			if (existing) {
				(existing as Signal<unknown>).value = value;
			} else {
				signals.set(key, signal(value));
			}
		}
	};

	return { proxy, signals, update };
};
