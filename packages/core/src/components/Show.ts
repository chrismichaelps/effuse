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
import { Option, pipe, Predicate } from 'effect';

export interface ShowProps<T> {
	when: Signal<T> | (() => T);
	fallback?: EffuseChild | (() => EffuseChild);
	children: EffuseChild | ((item: NonNullable<T>) => EffuseChild);
	keyed?: boolean;
}

type ShowCache<T> = {
	lastTruthy: boolean;
	cachedChild: Option.Option<EffuseChild>;
	value: Option.Option<NonNullable<T>>;
};

const createCache = <T>(): ShowCache<T> => ({
	lastTruthy: false,
	cachedChild: Option.none(),
	value: Option.none(),
});

const resolveCondition = <T>(condition: Signal<T> | (() => T)): T =>
	Predicate.isFunction(condition) ? condition() : condition.value;

const isTruthy = <T>(value: T): value is NonNullable<T> =>
	Predicate.isNotNullable(value) && value !== false;

const resolveFallback = (
	fallback: EffuseChild | (() => EffuseChild) | undefined
): EffuseChild[] => {
	if (!Predicate.isNotNullable(fallback)) {
		return [];
	}

	if (Predicate.isFunction(fallback)) {
		return [fallback()];
	}

	return [fallback];
};

const renderChildren = <T>(
	children: EffuseChild | ((item: NonNullable<T>) => EffuseChild),
	value: NonNullable<T>
): EffuseChild => (Predicate.isFunction(children) ? children(value) : children);

export const Show = <T>(props: ShowProps<T>): EffuseNode => {
	const { when: condition, fallback, children, keyed = false } = props;

	const listNode = createListNode([]) as ReturnType<typeof createListNode> & {
		_cache: ShowCache<T>;
	};

	listNode._cache = createCache<T>();

	Object.defineProperty(listNode, 'children', {
		enumerable: true,
		configurable: true,
		get() {
			const cache = listNode._cache;
			const rawValue = resolveCondition(condition);

			if (!isTruthy(rawValue)) {
				cache.lastTruthy = false;
				cache.cachedChild = Option.none();
				cache.value = Option.none();
				return resolveFallback(fallback);
			}

			const shouldRecreate = keyed || !cache.lastTruthy;

			if (shouldRecreate || Option.isNone(cache.cachedChild)) {
				cache.cachedChild = Option.some(renderChildren(children, rawValue));
				cache.value = Option.some(rawValue);
			}

			cache.lastTruthy = true;

			return pipe(
				cache.cachedChild,
				Option.match({
					onNone: () => [] as EffuseChild[],
					onSome: (child) => [child] as EffuseChild[],
				})
			);
		},
	});

	return listNode;
};
