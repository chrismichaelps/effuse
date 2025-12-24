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

import { computed } from '../reactivity/computed.js';
import { isSignal } from '../reactivity/signal.js';
import type { ReadonlySignal } from '../types/index.js';

// Memoized callback with stable identity and automatic dependency tracking via closure
export function useCallback<T extends (...args: any[]) => any>(
	fn: T,
	deps?: unknown[]
): T {
	return computed(() => {
		deps?.forEach((d) => isSignal(d) && (d as ReadonlySignal<unknown>).value);
		return fn;
	}).value as T;
}

// Memoizes a value with automatic dependency tracking; explicit deps optional
export function useMemo<T>(fn: () => T, deps?: unknown[]): () => T {
	const memoized = computed(() => {
		deps?.forEach((d) => isSignal(d) && (d as ReadonlySignal<unknown>).value);
		return fn();
	});
	return () => memoized.value;
}
