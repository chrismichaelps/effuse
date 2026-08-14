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

import { Effect, Predicate, SubscriptionRef } from 'effect';
import type { Signal, ReadonlySignal } from '../types/index.js';
import { Dep } from './dep.js';
import {
	isSignalTracingEnabled,
	nextSignalTraceId,
	traceSignalCreate,
	traceSignalUpdate,
} from '../layers/tracing/signals.js';

export type { Signal };

interface SignalInternal<T> extends Signal<T> {
	readonly _ref: SubscriptionRef.SubscriptionRef<T>;
	readonly _dep: Dep;
	readonly _version: { value: number };
	readonly _traceId: string;
}

/**
 * Signals are the most frequently allocated object in the framework, so the
 * accessors live on a prototype rather than on each instance. Defining
 * accessor properties per object forces a fresh hidden class per signal; a
 * shared prototype lets every instance carry plain fields of one shape.
 *
 * `_ref`, `_version`, and `_traceId` are internal surface that nothing in the
 * framework reads, so each is derived on first request instead of being built
 * for every signal that will never be asked for it.
 */
class SignalCell<T> {
	private cached: T;
	private readonly dep = new Dep();
	private readonly traceName: string | undefined;
	private versionCount = 0;
	private versionBox: { value: number } | undefined;
	private traceId: string | undefined;
	private ref: SubscriptionRef.SubscriptionRef<T> | undefined;

	constructor(initialValue: T, name: string | undefined) {
		this.cached = initialValue;
		this.traceName = name;

		if (isSignalTracingEnabled()) {
			traceSignalCreate(this._traceId, initialValue);
		}
	}

	get value(): T {
		this.dep.track();
		return this.cached;
	}

	set value(newValue: T) {
		if (Object.is(this.cached, newValue)) return;

		const prevValue = this.cached;
		this.cached = newValue;
		this.versionCount++;
		if (this.ref) {
			Effect.runSync(SubscriptionRef.set(this.ref, newValue));
		}
		this.dep.trigger();
		if (isSignalTracingEnabled()) {
			traceSignalUpdate(this._traceId, prevValue, newValue);
		}
	}

	get _dep(): Dep {
		return this.dep;
	}

	get _ref(): SubscriptionRef.SubscriptionRef<T> {
		this.ref ??= Effect.runSync(SubscriptionRef.make(this.cached));
		return this.ref;
	}

	/** Live view over the write counter, kept stable across reads. */
	get _version(): { value: number } {
		if (!this.versionBox) {
			const box = {} as { value: number };
			Object.defineProperty(box, 'value', {
				get: (): number => this.versionCount,
				set: (next: number): void => {
					this.versionCount = next;
				},
				enumerable: true,
				configurable: true,
			});
			this.versionBox = box;
		}
		return this.versionBox;
	}

	get _traceId(): string {
		this.traceId ??= nextSignalTraceId(this.traceName);
		return this.traceId;
	}
}

// Initialize reactive signal
export function signal<T>(initialValue: T, name?: string): Signal<T> {
	return new SignalCell(initialValue, name) as unknown as Signal<T>;
}

// Build readonly signal view
export function readonlySignal<T>(source: Signal<T>): ReadonlySignal<T> {
	const readonlyView = {
		get value() {
			return source.value;
		},
		get _dep() {
			return getSignalDep(source);
		},
	};
	return readonlyView;
}

// Detect reactive signal
export function isSignal<T>(value: unknown): value is Signal<T> {
	if (!Predicate.isObject(value)) {
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
