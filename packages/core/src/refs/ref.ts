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

import { Effect, SubscriptionRef, Predicate } from 'effect';
import type {
	RefObject,
	RefObjectInternal,
	RefCallback,
	RefOptions,
} from './types.js';

export function createRef<T extends Element = Element>(
	_options?: RefOptions
): RefObject<T> {
	const internalRef = Effect.runSync(SubscriptionRef.make<T | null>(null));
	const subscribers = new Set<RefCallback<T>>();

	const refObject: RefObjectInternal<T> = {
		get current(): T | null {
			return Effect.runSync(SubscriptionRef.get(internalRef));
		},

		subscribe(callback: RefCallback<T>): () => void {
			subscribers.add(callback);
			callback(this.current);
			return () => {
				subscribers.delete(callback);
			};
		},

		_setCurrent(el: T | null): void {
			Effect.runSync(SubscriptionRef.set(internalRef, el));
			for (const cb of subscribers) {
				cb(el);
			}
		},
	};

	return refObject as RefObject<T>;
}

export function isRefObject<T extends Element = Element>(
	value: unknown
): value is RefObject<T> {
	return (
		Predicate.isObject(value) &&
		Predicate.hasProperty(value, 'current') &&
		Predicate.hasProperty(value, 'subscribe') &&
		Predicate.isFunction((value as RefObject<T>).subscribe)
	);
}

export function isRefCallback<T extends Element = Element>(
	value: unknown
): value is RefCallback<T> {
	return Predicate.isFunction(value);
}

export function applyRef<T extends Element>(
	ref: RefCallback<T> | RefObject<T> | undefined | null,
	element: T | null
): void {
	if (Predicate.isNullable(ref)) {
		return;
	}

	if (isRefCallback(ref)) {
		ref(element);
	} else if (isRefObject(ref)) {
		const internal = ref as RefObjectInternal<T>;
		if (Predicate.isFunction(internal._setCurrent)) {
			internal._setCurrent(element);
		}
	}
}
