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

import type { EffuseNode, EffuseChild, ListNode } from '../render/node.js';
import { createListNode } from '../render/node.js';
import type { Signal } from '../types/index.js';
import { computed, untrack, signal } from '../reactivity/index.js';
import { DuplicateKeysError } from '../errors.js';
import { pipe, Match, Predicate } from 'effect';

export interface ForProps<T> {
	each: Signal<T[]> | (() => T[]);
	keyExtractor?: (item: T, index: number) => unknown;
	children: (item: Signal<T>, index: Signal<number>) => EffuseNode;
	fallback?: EffuseChild | (() => EffuseChild);
	range?: Signal<{ start: number; end: number }>;
	transitions?: {
		enter?: (node: EffuseNode, index: number) => void;
		exit?: (node: EffuseNode, index: number) => void;
		move?: (node: EffuseNode, fromIndex: number, toIndex: number) => void;
	};
}

type ItemMeta<T> = {
	key: unknown;
	itemSignal: Signal<T>;
	indexSignal: Signal<number>;
};

type ForCache<T> = {
	cachedChildren: EffuseNode[];
	meta: WeakMap<EffuseNode, ItemMeta<T>>;
};

const createForCache = <T>(): ForCache<T> => ({
	cachedChildren: [],
	meta: new WeakMap(),
});

const resolveList = <T>(listSignal: Signal<T[]> | (() => T[])): T[] =>
	pipe(
		listSignal,
		Match.value,
		Match.when(Predicate.isFunction, (fn) => fn()),
		Match.orElse((sig) => sig.value)
	);

const isValidRange = (r: { start: number; end: number }): boolean =>
	r.end > r.start && r.start >= 0;

const computeRange = <T>(
	items: T[],
	range: Signal<{ start: number; end: number }> | undefined
): { start: number; end: number; sliced: T[] } => {
	if (!Predicate.isNotNullable(range)) {
		return { start: 0, end: items.length, sliced: items };
	}

	const r = range.value;
	if (!isValidRange(r)) {
		return { start: 0, end: items.length, sliced: items };
	}

	const start = Math.min(r.start, items.length);
	const end = Math.min(r.end, items.length);
	return { start, end, sliced: items.slice(start, end) };
};

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

const invokeEnterTransition = <T>(
	props: ForProps<T>,
	node: EffuseNode,
	index: number
): void => {
	if (!Predicate.isNotNullable(props.transitions)) return;
	if (!Predicate.isNotNullable(props.transitions.enter)) return;
	props.transitions.enter(node, index);
};

const invokeMoveTransition = <T>(
	props: ForProps<T>,
	node: EffuseNode,
	fromIndex: number,
	toIndex: number
): void => {
	if (!Predicate.isNotNullable(props.transitions)) return;
	if (!Predicate.isNotNullable(props.transitions.move)) return;
	props.transitions.move(node, fromIndex, toIndex);
};

const invokeExitTransitions = <T>(
	props: ForProps<T>,
	prevChildren: EffuseNode[],
	cache: ForCache<T>,
	seenKeys: Set<unknown>
): void => {
	if (!Predicate.isNotNullable(props.transitions)) return;
	if (!Predicate.isNotNullable(props.transitions.exit)) return;

	const exit = props.transitions.exit;
	for (const child of prevChildren) {
		const meta = cache.meta.get(child);
		if (!Predicate.isNotNullable(meta)) continue;
		if (seenKeys.has(meta.key)) continue;
		exit(child, meta.indexSignal.value);
	}
};

const createFor = <T>(props: ForProps<T>): EffuseNode => {
	const {
		each: listSignal,
		children: renderChild,
		keyExtractor: getKey,
	} = props;
	const keyFn = Predicate.isNotNullable(getKey)
		? getKey
		: (_item: T, i: number) => i;

	const cache = createForCache<T>();
	const listNode = createListNode([]) as ListNode & { _cache: ForCache<T> };
	listNode._cache = cache;

	Object.defineProperty(listNode, 'children', {
		enumerable: true,
		configurable: true,
		get() {
			const fullItems = resolveList(listSignal);
			if (!Array.isArray(fullItems)) return [];

			const { start, sliced: newItems } = computeRange(fullItems, props.range);

			if (newItems.length === 0) {
				cache.cachedChildren = [];
				return resolveFallback(props.fallback);
			}

			const prevChildren = cache.cachedChildren;
			const newChildren: EffuseNode[] = Array.from({ length: newItems.length });
			const keyToOldNode = new Map<unknown, EffuseNode>();
			const seenKeys = new Set<unknown>();

			for (const child of prevChildren) {
				const meta = cache.meta.get(child);
				if (Predicate.isNotNullable(meta)) {
					keyToOldNode.set(meta.key, child);
				}
			}

			for (let i = 0; i < newItems.length; i++) {
				const item = newItems[i];
				if (!Predicate.isNotNullable(item)) continue;

				const actualIndex = start + i;
				const key = keyFn(item, actualIndex);

				if (process.env.NODE_ENV !== 'production') {
					if (seenKeys.has(key)) {
						throw new DuplicateKeysError({ component: 'For' });
					}
					seenKeys.add(key);
				}

				const existingNode = keyToOldNode.get(key);

				if (Predicate.isNotNullable(existingNode)) {
					const meta = cache.meta.get(existingNode);
					if (!Predicate.isNotNullable(meta)) continue;

					const prevIndex = meta.indexSignal.value;
					if (meta.itemSignal.value !== item) {
						meta.itemSignal.value = item;
					}
					if (meta.indexSignal.value !== actualIndex) {
						meta.indexSignal.value = actualIndex;
						invokeMoveTransition(props, existingNode, prevIndex, actualIndex);
					}
					newChildren[i] = existingNode;
				} else {
					const itemSignal = signal<T>(item);
					const indexSignal = signal<number>(actualIndex);
					const node = untrack(() => renderChild(itemSignal, indexSignal));
					cache.meta.set(node, { key, itemSignal, indexSignal });
					invokeEnterTransition(props, node, actualIndex);
					newChildren[i] = node;
				}
			}

			invokeExitTransitions(props, prevChildren, cache, seenKeys);
			cache.cachedChildren = newChildren;
			return newChildren;
		},
	});

	return listNode;
};

const createDynamic = <T>(
	sig: Signal<T[]>,
	render: (item: T, index: Signal<number>) => EffuseNode
): EffuseNode => {
	const node = createListNode([]);

	Object.defineProperty(node, 'children', {
		get() {
			const items = sig.value;
			return items.map((item, i) =>
				render(
					item,
					computed(() => i)
				)
			);
		},
	});

	return node;
};

export const For = Object.assign(createFor, {
	Dynamic: createDynamic,
});
