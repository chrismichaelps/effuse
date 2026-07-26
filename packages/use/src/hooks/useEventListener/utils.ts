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

import { Option } from 'effect';

export type SupportedEventTarget = globalThis.EventTarget | null;

export const resolveTarget = (
	target: SupportedEventTarget | (() => SupportedEventTarget)
): Option.Option<globalThis.EventTarget> => {
	const resolved = typeof target === 'function' ? target() : target;
	return resolved === null ? Option.none() : Option.some(resolved);
};

export const isEventTarget = (
	target: unknown
): target is globalThis.EventTarget =>
	target !== null &&
	target !== undefined &&
	typeof (target as { addEventListener?: unknown })
		.addEventListener === 'function';

export const getTargetName = (target: globalThis.EventTarget): string => {
	if (typeof window !== 'undefined' && target === window) return 'window';
	if (typeof document !== 'undefined' && target === document) return 'document';
	if ('tagName' in target && typeof target.tagName === 'string') {
		const id = 'id' in target && typeof target.id === 'string' && target.id
			? `#${target.id}`
			: '';
		return `${target.tagName.toLowerCase()}${id}`;
	}
	return target.constructor.name || 'EventTarget';
};
