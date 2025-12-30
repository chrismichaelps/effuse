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

export const For = <T>(props: ForProps<T>): EffuseNode => {
	const {
		each: listSignal,
		children: renderChild,
		keyExtractor: getKey,
	} = props;

	const keyFn = getKey ?? ((_item: T, i: number) => i);

	const listNode = createListNode([]) as ListNode & {
		_cachedChildren?: EffuseNode[];
		_meta?: WeakMap<
			EffuseNode,
			{ key: unknown; itemSignal: Signal<T>; indexSignal: Signal<number> }
		>;
	};

	const childrenDescriptor: PropertyDescriptor = {
		enumerable: true,
		configurable: true,
		get: function () {
			const fullItems =
				typeof listSignal === 'function' ? listSignal() : listSignal.value;
			if (!Array.isArray(fullItems)) {
				return [];
			}
			const r = props.range?.value;
			const hasValidRange = !!r && r.end > r.start && r.start >= 0;
			const start = hasValidRange ? Math.min(r.start, fullItems.length) : 0;
			const end = hasValidRange
				? Math.min(r.end, fullItems.length)
				: fullItems.length;
			const newItems = fullItems.slice(start, end);

			if (newItems.length === 0) {
				const fb = props.fallback;
				if (fb) {
					const node = typeof fb === 'function' ? fb() : fb;
					listNode._cachedChildren = [];
					return [node] as EffuseChild[];
				}
				listNode._cachedChildren = [];
				return [] as EffuseChild[];
			}

			const prevChildren = listNode._cachedChildren ?? [];

			// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
			const newChildren: EffuseNode[] = new Array(newItems.length);

			const metaMap = listNode._meta ?? (listNode._meta = new WeakMap());

			const keyToOldNode = new Map<unknown, EffuseNode>();
			const seenKeys = new Set<unknown>();

			for (const child of prevChildren) {
				const meta = metaMap.get(child);
				if (meta) {
					keyToOldNode.set(meta.key, child);
				}
			}

			for (let i = 0; i < newItems.length; i++) {
				const item = newItems[i];
				if (item === undefined) continue;
				const actualIndex = start + i;
				const key = keyFn(item, actualIndex);

				if (process.env.NODE_ENV !== 'production') {
					if (seenKeys.has(key)) {
						throw new DuplicateKeysError({ component: 'For' });
					}
					seenKeys.add(key);
				}

				let childNode: EffuseNode;

				if (keyToOldNode.has(key)) {
					const existingNode = keyToOldNode.get(key);
					if (!existingNode) continue;
					childNode = existingNode;

					const meta = metaMap.get(childNode);
					if (!meta) continue;
					const prevIndex = meta.indexSignal.value;
					if (meta.itemSignal.value !== item) {
						meta.itemSignal.value = item;
					}
					if (meta.indexSignal.value !== actualIndex) {
						meta.indexSignal.value = actualIndex;
						props.transitions?.move?.(childNode, prevIndex, actualIndex);
					}
				} else {
					const itemSignal = signal<T>(item as T);
					const indexSignal = signal<number>(actualIndex);

					childNode = untrack(() => renderChild(itemSignal, indexSignal));

					metaMap.set(childNode, { key, itemSignal, indexSignal });

					props.transitions?.enter?.(childNode, actualIndex);
				}

				newChildren[i] = childNode;
			}

			if (props.transitions?.exit) {
				const exit = props.transitions.exit;
				const newKeySet = seenKeys;
				for (const child of prevChildren) {
					const meta = metaMap.get(child);
					if (meta && !newKeySet.has(meta.key)) {
						exit(child, meta.indexSignal.value);
					}
				}
			}

			listNode._cachedChildren = newChildren;

			return newChildren;
		},
	};
	Object.defineProperty(listNode, 'children', childrenDescriptor);

	return listNode;
};

export const createDynamicListNode = <T>(
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
