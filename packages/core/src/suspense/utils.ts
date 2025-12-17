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

import { Effect } from 'effect';

export const isEffect = <T>(
	value: Effect.Effect<T, Error> | Promise<T>
): value is Effect.Effect<T, Error> =>
	typeof value === 'object' && value !== null && '_op' in value;

export const promiseToEffect = <T>(
	promise: Promise<T>
): Effect.Effect<T, Error> => Effect.promise(() => promise);

export const toEffect = <T>(
	value: Effect.Effect<T, Error> | Promise<T>
): Effect.Effect<T, Error> => {
	if (isEffect(value)) {
		return value;
	}
	return promiseToEffect(value);
};

let resourceIdCounter = 0;
let boundaryIdCounter = 0;

export const generateResourceId = (prefix: string): string =>
	`${prefix}${String(++resourceIdCounter)}`;

export const generateBoundaryId = (prefix: string): string =>
	`${prefix}${String(++boundaryIdCounter)}`;

export const resetIdCounters = (): void => {
	resourceIdCounter = 0;
	boundaryIdCounter = 0;
};
