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

import type { QueryKey } from '../client/types.js';

/**
 * Checks if key `b` partially matches key `a`.
 *
 * For arrays, every element of `b` must deeply equal the corresponding
 * element of `a`. This allows prefix matching so that `['todos']` matches
 * `['todos', { page: 1 }]`.
 *
 * For objects, every own property of `b` must deeply equal the corresponding
 * property of `a`.
 */
export function partialMatchKey(a: QueryKey, b: QueryKey): boolean;
export function partialMatchKey(a: any, b: any): boolean {
	if (a === b) {
		return true;
	}

	if (typeof a !== typeof b) {
		return false;
	}

	if (a === null || b === null) {
		return false;
	}

	if (typeof a === 'object' && typeof b === 'object') {
		const bKeys = Object.keys(b);
		return bKeys.every((key) =>
			partialMatchKey((a as any)[key], (b as any)[key])
		);
	}

	return false;
}
