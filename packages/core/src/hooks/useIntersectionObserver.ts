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

export interface IntersectionObserverResult {
	readonly isIntersecting: boolean;
	readonly intersectionRatio: number;
	readonly entry: IntersectionObserverEntry | null;
}

/**
 * Observe the intersection of an element with its ancestor or viewport.
 *
 * Returns a reactive signal that updates whenever the element crosses the
 * configured threshold. Automatically disconnects on unmount.
 *
 * @example
 * ```ts
 * let ref: HTMLDivElement;
 * const visible = useIntersectionObserver(() => ref, { threshold: 0.5 });
 * // visible.value.isIntersecting
 * ```
 */
export const useIntersectionObserver = (
	elementRef: () => Element | null | undefined,
	options?: IntersectionObserverInit
): ReadonlySignal<IntersectionObserverResult> => {
	const result = signal<IntersectionObserverResult>({
		isIntersecting: false,
		intersectionRatio: 0,
		entry: null,
	});

	if (typeof IntersectionObserver === 'undefined') {
		return readonly(result);
	}

	const observer = new IntersectionObserver((entries) => {
		for (const entry of entries) {
			result.value = {
				isIntersecting: entry.isIntersecting,
				intersectionRatio: entry.intersectionRatio,
				entry,
			};
		}
	}, options);

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

	return readonly(result);
};
