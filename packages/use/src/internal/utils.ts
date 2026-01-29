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

import { Predicate, Either } from 'effect';
import type { MaybeGetter } from './types.js';

export const resolveValue = <T>(value: MaybeGetter<T>): T =>
	Predicate.isFunction(value) ? value() : value;

export const isClient = (): boolean =>
	typeof window !== 'undefined' && typeof document !== 'undefined';

export const isServer = (): boolean => !isClient();

export const noop = (): void => {};

export const createDebounce = <T extends (...args: readonly unknown[]) => void>(
	fn: T,
	delay: number
): { readonly call: T; readonly cancel: () => void } => {
	let timeoutId: ReturnType<typeof setTimeout> | null = null;

	const cancel = (): void => {
		if (timeoutId !== null) {
			clearTimeout(timeoutId);
			timeoutId = null;
		}
	};

	const call = ((...args: readonly unknown[]) => {
		cancel();
		timeoutId = setTimeout(() => {
			fn(...args);
		}, delay);
	}) as T;

	return { call, cancel };
};

export const createThrottle = <T extends (...args: readonly unknown[]) => void>(
	fn: T,
	delay: number
): { readonly call: T; readonly cancel: () => void } => {
	let lastCall = 0;
	let timeoutId: ReturnType<typeof setTimeout> | null = null;

	const cancel = (): void => {
		if (timeoutId !== null) {
			clearTimeout(timeoutId);
			timeoutId = null;
		}
	};

	const call = ((...args: readonly unknown[]) => {
		const now = Date.now();
		const remaining = delay - (now - lastCall);

		if (remaining <= 0) {
			cancel();
			lastCall = now;
			fn(...args);
		} else if (timeoutId === null) {
			timeoutId = setTimeout(() => {
				lastCall = Date.now();
				timeoutId = null;
				fn(...args);
			}, remaining);
		}
	}) as T;

	return { call, cancel };
};

export const safeJsonParse = <T>(value: string, fallback: T): T =>
	Either.match(
		Either.try(() => JSON.parse(value) as T),
		{
			onLeft: () => fallback,
			onRight: (parsed) => parsed,
		}
	);

export const safeJsonStringify = <T>(value: T): string | null =>
	Either.match(
		Either.try(() => JSON.stringify(value)),
		{
			onLeft: () => null,
			onRight: (json) => json,
		}
	);
