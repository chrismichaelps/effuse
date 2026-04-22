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

import { getActiveLifecycle } from '../blueprint/lifecycle.js';

export interface ClickOutsideOptions {
	/** Exclude elements matched by this selector from triggering the callback. */
	exclude?: string;
}

/**
 * Call `callback` when a click occurs outside of `element`.
 *
 * Automatically cleaned up on component unmount.
 *
 * @example
 * ```ts
 * let ref: HTMLDivElement;
 * useOnClickOutside(() => ref, () => setOpen(false));
 * ```
 */
export const useOnClickOutside = (
	elementRef: () => Element | null | undefined,
	callback: (event: MouseEvent) => void,
	options: ClickOutsideOptions = {}
): void => {
	if (typeof document === 'undefined') return;

	const handler = (event: MouseEvent) => {
		const el = elementRef();
		if (!el) return;

		if (options.exclude) {
			const excluded = document.querySelector(options.exclude);
			if (excluded && event.target && excluded.contains(event.target as Node)) {
				return;
			}
		}

		if (event.target && !el.contains(event.target as Node)) {
			callback(event);
		}
	};

	document.addEventListener('mousedown', handler);

	const lifecycle = getActiveLifecycle();
	if (lifecycle) {
		lifecycle.onUnmount(() => {
			document.removeEventListener('mousedown', handler);
		});
	}
};
