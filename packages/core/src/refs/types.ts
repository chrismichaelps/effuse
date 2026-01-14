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

export type RefCallback<T extends Element = Element> = (el: T | null) => void;

export interface RefObject<T extends Element = Element> {
	readonly current: T | null;
	readonly subscribe: (callback: RefCallback<T>) => () => void;
}

export interface RefObjectInternal<
	T extends Element = Element,
> extends RefObject<T> {
	readonly _setCurrent: (el: T | null) => void;
}

export type Ref<T extends Element = Element> = RefCallback<T> | RefObject<T>;

export type Directive<T extends Element = Element, P = unknown> = (
	element: T,
	accessor: () => P
) => undefined | (() => void);

export interface RefOptions {
	readonly name?: string;
}
