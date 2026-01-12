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

import type { EffuseNode, EffuseChild } from '../render/node.js';
import { createListNode } from '../render/node.js';
import type { Signal } from '../types/index.js';
import { Option, pipe, Predicate, Array as Arr, Number as Num } from 'effect';

export interface RepeatProps {
	readonly times: number | Signal<number>;
	readonly children: (index: number) => EffuseChild;
	readonly fallback?: EffuseChild | (() => EffuseChild);
}

const isSignal = <T>(val: unknown): val is Signal<T> =>
	Predicate.isObject(val) && Predicate.hasProperty(val, 'value');

const resolveCount = (times: number | Signal<number>): number =>
	isSignal<number>(times) ? times.value : times;

const clampNonNegative = Num.clamp({
	minimum: 0,
	maximum: Number.MAX_SAFE_INTEGER,
});

const resolveChild = (
	child: EffuseChild | (() => EffuseChild) | undefined
): Option.Option<EffuseChild> =>
	pipe(
		child,
		Option.fromNullable,
		Option.map((c) => (Predicate.isFunction(c) ? c() : c))
	);

export const Repeat = (props: RepeatProps): EffuseNode => {
	const { times, children: renderChild, fallback } = props;

	const listNode = createListNode([]);

	Object.defineProperty(listNode, 'children', {
		enumerable: true,
		configurable: true,
		get() {
			const count = pipe(times, resolveCount, clampNonNegative, Math.floor);

			if (count === 0) {
				const optChild = resolveChild(fallback);
				return Option.isSome(optChild) ? [optChild.value] : [];
			}

			return Arr.makeBy(count, renderChild);
		},
	});

	return listNode;
};
