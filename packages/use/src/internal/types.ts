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

import type { Signal, ReadonlySignal } from '@effuse/core';

export type Cleanup = () => void;

export type MaybeGetter<T> = T | (() => T);

export type MaybeSignal<T> = Signal<T> | ReadonlySignal<T> | T;

export type ElementOf<T> = T extends readonly (infer E)[] ? E : never;

export type Nullable<T> = { [K in keyof T]?: T[K] | null };

export type VoidCallback = () => void;

export type ValueCallback<T> = (value: T) => void;

export interface WindowSize {
	readonly width: number;
	readonly height: number;
}

export interface ElementRect {
	readonly width: number;
	readonly height: number;
	readonly top: number;
	readonly left: number;
	readonly bottom: number;
	readonly right: number;
}

export interface IntersectionState {
	readonly isIntersecting: boolean;
	readonly intersectionRatio: number;
}
