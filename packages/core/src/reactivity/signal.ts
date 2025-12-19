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

import { Effect, SubscriptionRef } from 'effect';
import type { Signal, ReadonlySignal } from '../types/index.js';
import { Dep } from './dep.js';

export type { Signal };

interface SignalInternal<T> extends Signal<T> {
	readonly _ref: SubscriptionRef.SubscriptionRef<T>;
	readonly _dep: Dep;
	readonly _version: { value: number };
}

// Initialize reactive signal
export function signal<T>(initialValue: T): Signal<T> {
	const refEffect = SubscriptionRef.make(initialValue);
	const ref = Effect.runSync(refEffect);
	const dep = new Dep();
	const version = { value: 0 };
	let cached = initialValue;

	const signalObj: SignalInternal<T> = {
		get _ref() {
			return ref;
		},
		get _dep() {
			return dep;
		},
		get _version() {
			return version;
		},
		get value(): T {
			dep.track();
			return cached;
		},
		set value(newValue: T) {
			if (!Object.is(cached, newValue)) {
				cached = newValue;
				version.value++;
				Effect.runSync(SubscriptionRef.set(ref, newValue));
				dep.trigger();
			}
		},
	};

	return signalObj;
}

// Build readonly signal view
export function readonlySignal<T>(source: Signal<T>): ReadonlySignal<T> {
	return {
		get value() {
			return source.value;
		},
	};
}

// Detect reactive signal
export function isSignal<T>(value: unknown): value is Signal<T> {
	if (typeof value !== 'object' || value === null) {
		return false;
	}
	const obj = value as Record<string, unknown>;
	if (!('value' in obj)) {
		return false;
	}
	if ('_ref' in obj || '_dep' in obj) {
		return true;
	}
	return false;
}

// Resolve signal value
export function unref<T>(maybeSignal: T | Signal<T>): T {
	return isSignal<T>(maybeSignal) ? maybeSignal.value : maybeSignal;
}

// Access internal subscription ref
export function getSignalRef<T>(
	sig: Signal<T>
): SubscriptionRef.SubscriptionRef<T> | null {
	const internal = sig as SignalInternal<T>;
	return '_ref' in internal ? internal._ref : null;
}

// Access internal dependency tracker
export function getSignalDep<T>(sig: Signal<T>): Dep | null {
	const internal = sig as SignalInternal<T>;
	return '_dep' in internal ? internal._dep : null;
}
