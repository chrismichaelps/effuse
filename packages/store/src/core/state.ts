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
import { createAtomicRef } from '../actions/cancellation.js';

// Atomic state management with synchronous accessors
export interface AtomicState<T extends Record<string, unknown>> {
	get: () => T;
	set: (value: T) => void;
	update: (fn: (state: T) => T) => void;
}

// Build atomic state container
export const createAtomicState = <T extends Record<string, unknown>>(
	initial: T
): AtomicState<T> => {
	const ref = Effect.runSync(SubscriptionRef.make(initial));
	return {
		get: () => Effect.runSync(SubscriptionRef.get(ref)),
		set: (value: T) => {
			Effect.runSync(SubscriptionRef.set(ref, value));
		},
		update: (fn: (state: T) => T) => {
			Effect.runSync(SubscriptionRef.update(ref, fn));
		},
	};
};

// Atomic state management with Effect operations
export interface AtomicStateEffect<T extends Record<string, unknown>> {
	get: Effect.Effect<T>;
	set: (value: T) => Effect.Effect<void>;
	update: (fn: (state: T) => T) => Effect.Effect<T>;
	getAndSet: (value: T) => Effect.Effect<T>;
}

// Build Effect native atomic state
export const createAtomicStateWithEffect = <T extends Record<string, unknown>>(
	initial: T
): Effect.Effect<AtomicStateEffect<T>> => {
	return createAtomicRef(initial) as Effect.Effect<AtomicStateEffect<T>>;
};
