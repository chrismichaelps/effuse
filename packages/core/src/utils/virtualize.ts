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

import { signal } from '../reactivity/index.js';
import { effect } from '../effects/index.js';
import type { Signal } from '../types/index.js';

export const createVirtualRange = (
	el: HTMLElement,
	itemSize: number,
	total: Signal<number>,
	overscan = 2
): Signal<{ start: number; end: number }> => {
	const rng = signal<{ start: number; end: number }>({ start: 0, end: 0 });

	const update = () => {
		const start = Math.floor(el.scrollTop / itemSize);
		const visible = Math.ceil(el.clientHeight / itemSize);
		const end = Math.min(total.value, start + visible + overscan);
		rng.value = { start, end };
	};

	effect(() => {
		void total.value;
		update();
	});

	el.addEventListener('scroll', update);

	const ro =
		typeof ResizeObserver !== 'undefined'
			? new ResizeObserver(() => {
					update();
				})
			: undefined;
	if (ro) ro.observe(el);
	return rng;
};

export const createAutoVirtualRange = (
	el: HTMLElement,
	total: Signal<number>,
	overscan = 2
): Signal<{ start: number; end: number }> => {
	const rng = signal<{ start: number; end: number }>({ start: 0, end: 0 });

	let size = 0;

	const measure = () => {
		const children = el.children;

		if (children.length === 0) return;

		let sum = 0;
		for (let i = 0; i < children.length; i++) {
			const rect = (children[i] as HTMLElement).getBoundingClientRect();
			sum += rect.height || 0;
		}
		size = sum > 0 ? Math.max(1, Math.round(sum / children.length)) : size;
	};

	const update = () => {
		if (size <= 0) measure();
		const s = Math.max(1, size);
		const start = Math.floor(el.scrollTop / s);
		const visible = Math.ceil(el.clientHeight / s);
		const end = Math.min(total.value, start + visible + overscan);
		rng.value = { start, end };
	};

	effect(() => {
		void total.value;
		update();
	});

	el.addEventListener('scroll', update);

	const ro =
		typeof ResizeObserver !== 'undefined'
			? new ResizeObserver(() => {
					measure();
					update();
				})
			: undefined;

	if (ro) ro.observe(el);

	const mo =
		typeof MutationObserver !== 'undefined'
			? new MutationObserver(() => {
					measure();
					update();
				})
			: undefined;
	if (mo) mo.observe(el, { childList: true, subtree: false });
	return rng;
};
