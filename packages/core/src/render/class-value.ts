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

import { Predicate } from 'effect';

/**
 * Flattens a `class` prop into the string form the DOM expects.
 *
 * The server serializer and the client prop binder both call this, for the
 * same reason they share `normalizeDOMAttributeName`: the two sides have to
 * agree on the result, and agreement maintained by hand in two files is
 * agreement that eventually stops holding.
 *
 * Strings pass through, arrays flatten recursively, and object keys are kept
 * when their value is truthy. Anything else contributes nothing.
 */
export const normalizeClassValue = (value: unknown): string => {
	if (Predicate.isString(value)) {
		return value;
	}
	if (Array.isArray(value)) {
		return value
			.map(normalizeClassValue)
			.filter((part) => part !== '')
			.join(' ');
	}
	if (Predicate.isObject(value)) {
		return Object.entries(value as Record<string, unknown>)
			.filter(([, enabled]) => Boolean(enabled))
			.map(([name]) => name)
			.join(' ');
	}
	return '';
};
