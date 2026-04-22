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

import { signal, type ReadonlySignal, readonly } from '../reactivity/index.js';
import { getActiveLifecycle } from '../blueprint/lifecycle.js';

export interface ResizeObserverResult {
	readonly width: number;
	readonly height: number;
}

/**
 * Observe the size of an element using `ResizeObserver`.
 *
 * Returns a reactive signal that updates whenever the element's content rect
 * changes. Automatically unsubscribes on unmount.
 *
 * @example
 * ```ts
 * let ref: HTMLDivElement;
 * const size = useResizeObserver(() => ref);
 * // size.value.width / size.value.height
 * ```
 */
export const useResizeObserver = (
	elementRef: () => Element | null | undefined
): ReadonlySignal<ResizeObserverResult> => {
	const size = signal<ResizeObserverResult>({ width: 0, height: 0 });

	if (typeof ResizeObserver === 'undefined') {
		return readonly(size);
	}

	const observer = new ResizeObserver((entries) => {
		for (const entry of entries) {
			const rect = entry.contentRect;
			size.value = { width: rect.width, height: rect.height };
		}
	});

	const el = elementRef();
	if (el) {
		observer.observe(el);
	}

	const lifecycle = getActiveLifecycle();
	if (lifecycle) {
		lifecycle.onUnmount(() => {
			observer.disconnect();
		});
	}

	return readonly(size);
};
