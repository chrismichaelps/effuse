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
import { signal, untrack } from '../reactivity/index.js';
import { Data, Predicate } from 'effect';
import {
	TransitionDefaults,
	TransitionClassPrefixes,
	TransitionClassSuffixes,
} from './constants.js';

export class TransitionGroupError extends Data.TaggedError(
	'TransitionGroupError'
)<{
	readonly key: unknown;
	readonly phase: 'enter' | 'exit' | 'move';
	readonly cause: unknown;
}> {}

export type TransitionGroupState = Data.TaggedEnum<{
	Idle: object;
	Animating: { readonly activeCount: number };
}>;

const groupStateEnum = Data.taggedEnum<TransitionGroupState>();
export const TransitionGroupState = {
	Idle: groupStateEnum.Idle,
	Animating: groupStateEnum.Animating,
	$match: groupStateEnum.$match,
	$is: groupStateEnum.$is,
};

export const isGroupIdle = groupStateEnum.$is('Idle');
export const isGroupAnimating = groupStateEnum.$is('Animating');

export const matchGroupState = groupStateEnum.$match;

export type ItemState = Data.TaggedEnum<{
	Entering: { readonly element: Element };
	Entered: { readonly element: Element };
	Exiting: { readonly element: Element };
	Moving: {
		readonly element: Element;
		readonly fromIndex: number;
		readonly toIndex: number;
	};
}>;

const itemStateEnum = Data.taggedEnum<ItemState>();
export const ItemState = {
	Entering: itemStateEnum.Entering,
	Entered: itemStateEnum.Entered,
	Exiting: itemStateEnum.Exiting,
	Moving: itemStateEnum.Moving,
	$match: itemStateEnum.$match,
	$is: itemStateEnum.$is,
};

export const isItemEntering = itemStateEnum.$is('Entering');
export const isItemEntered = itemStateEnum.$is('Entered');
export const isItemExiting = itemStateEnum.$is('Exiting');
export const isItemMoving = itemStateEnum.$is('Moving');

export interface TransitionGroupClasses {
	enter?: string;
	enterActive?: string;
	enterTo?: string;
	exit?: string;
	exitActive?: string;
	exitTo?: string;
	move?: string;
}

export interface TransitionGroupCallbacks {
	onBeforeEnter?: (el: Element, index: number) => void;
	onEnter?: (el: Element, index: number, done: () => void) => void;
	onAfterEnter?: (el: Element, index: number) => void;
	onBeforeExit?: (el: Element, index: number) => void;
	onExit?: (el: Element, index: number, done: () => void) => void;
	onAfterExit?: (el: Element, index: number) => void;
	onBeforeMove?: (el: Element, fromIndex: number, toIndex: number) => void;
	onMove?: (
		el: Element,
		fromIndex: number,
		toIndex: number,
		done: () => void
	) => void;
	onAfterMove?: (el: Element, fromIndex: number, toIndex: number) => void;
}

export interface TransitionGroupProps<T> extends TransitionGroupCallbacks {
	name?: string;
	tag?: keyof HTMLElementTagNameMap;
	css?: boolean;
	duration?: number | { enter?: number; exit?: number; move?: number };
	enterClass?: string;
	enterActiveClass?: string;
	enterToClass?: string;
	exitClass?: string;
	exitActiveClass?: string;
	exitToClass?: string;
	moveClass?: string;
	each: Signal<T[]> | (() => T[]);
	keyExtractor?: (item: T, index: number) => unknown;
	children: (item: Signal<T>, index: Signal<number>) => EffuseNode;
	fallback?: EffuseChild | (() => EffuseChild);
}

type ItemMeta<T> = {
	key: unknown;
	itemSignal: Signal<T>;
	indexSignal: Signal<number>;
	state: ItemState | null;
	rect?: DOMRect;
};

type TransitionGroupCache<T> = {
	state: Signal<TransitionGroupState>;
	cachedChildren: EffuseNode[];
	meta: WeakMap<EffuseNode, ItemMeta<T>>;
	elementMap: WeakMap<EffuseNode, Element>;
	classes: TransitionGroupClasses;
	durations: { enter: number; exit: number; move: number };
};

const resolveClasses = <T>(
	props: TransitionGroupProps<T>
): TransitionGroupClasses => {
	const name = props.name ?? TransitionClassPrefixes.LIST;
	return {
		enter: props.enterClass ?? `${name}${TransitionClassSuffixes.ENTER}`,
		enterActive:
			props.enterActiveClass ??
			`${name}${TransitionClassSuffixes.ENTER_ACTIVE}`,
		enterTo: props.enterToClass ?? `${name}${TransitionClassSuffixes.ENTER_TO}`,
		exit: props.exitClass ?? `${name}${TransitionClassSuffixes.EXIT}`,
		exitActive:
			props.exitActiveClass ?? `${name}${TransitionClassSuffixes.EXIT_ACTIVE}`,
		exitTo: props.exitToClass ?? `${name}${TransitionClassSuffixes.EXIT_TO}`,
		move: props.moveClass ?? `${name}${TransitionClassSuffixes.MOVE}`,
	};
};

const resolveDurations = <T>(
	props: TransitionGroupProps<T>
): { enter: number; exit: number; move: number } => {
	if (!Predicate.isNotNullable(props.duration)) {
		return {
			enter: TransitionDefaults.ENTER_MS,
			exit: TransitionDefaults.EXIT_MS,
			move: TransitionDefaults.MOVE_MS,
		};
	}

	if (typeof props.duration === 'number') {
		return {
			enter: props.duration,
			exit: props.duration,
			move: props.duration,
		};
	}

	return {
		enter: props.duration.enter ?? TransitionDefaults.ENTER_MS,
		exit: props.duration.exit ?? TransitionDefaults.EXIT_MS,
		move: props.duration.move ?? TransitionDefaults.MOVE_MS,
	};
};

const resolveList = <T>(listSignal: Signal<T[]> | (() => T[])): T[] => {
	if (Predicate.isFunction(listSignal) && !('value' in listSignal)) {
		return listSignal();
	}
	return (listSignal as Signal<T[]>).value;
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

const createCache = <T>(
	props: TransitionGroupProps<T>
): TransitionGroupCache<T> => ({
	state: signal<TransitionGroupState>(TransitionGroupState.Idle()),
	cachedChildren: [],
	meta: new WeakMap(),
	elementMap: new WeakMap(),
	classes: resolveClasses(props),
	durations: resolveDurations(props),
});

export const TransitionGroup = <T>(
	props: TransitionGroupProps<T>
): EffuseNode => {
	const {
		each: listSignal,
		children: renderChild,
		keyExtractor: getKey,
	} = props;

	const keyFn = Predicate.isNotNullable(getKey)
		? getKey
		: (_item: T, i: number) => i;

	const cache = createCache(props);

	const listNode = createListNode([]) as ListNode & {
		_cache: TransitionGroupCache<T>;
	};

	listNode._cache = cache;

	Object.defineProperty(listNode, 'children', {
		enumerable: true,
		configurable: true,
		get() {
			const newItems = resolveList(listSignal);
			if (!Array.isArray(newItems)) return [];

			if (newItems.length === 0) {
				cache.cachedChildren = [];
				return resolveFallback(props.fallback);
			}

			const prevChildren = cache.cachedChildren;
			const newChildren: EffuseNode[] = Array.from({ length: newItems.length });
			const keyToOldNode = new Map<unknown, EffuseNode>();
			const seenKeys = new Set<unknown>();
			let animatingCount = 0;

			for (const child of prevChildren) {
				const meta = cache.meta.get(child);
				if (Predicate.isNotNullable(meta)) {
					keyToOldNode.set(meta.key, child);
				}
			}

			for (let i = 0; i < newItems.length; i++) {
				const item = newItems[i];
				if (!Predicate.isNotNullable(item)) continue;

				const key = keyFn(item, i);
				seenKeys.add(key);

				const existingNode = keyToOldNode.get(key);

				if (Predicate.isNotNullable(existingNode)) {
					const meta = cache.meta.get(existingNode);
					if (!Predicate.isNotNullable(meta)) continue;

					if (meta.itemSignal.value !== item) {
						meta.itemSignal.value = item;
					}
					if (meta.indexSignal.value !== i) {
						const el = cache.elementMap.get(existingNode);
						if (Predicate.isNotNullable(el)) {
							meta.state = ItemState.Moving({
								element: el,
								fromIndex: meta.indexSignal.value,
								toIndex: i,
							});
						}
						meta.indexSignal.value = i;
						animatingCount++;
					}
					newChildren[i] = existingNode;
				} else {
					const itemSignal = signal<T>(item);
					const indexSignal = signal<number>(i);
					const node = untrack(() => renderChild(itemSignal, indexSignal));
					const meta: ItemMeta<T> = {
						key,
						itemSignal,
						indexSignal,
						state: null,
					};
					cache.meta.set(node, meta);
					animatingCount++;
					newChildren[i] = node;
				}
			}

			for (const child of prevChildren) {
				const meta = cache.meta.get(child);
				if (!Predicate.isNotNullable(meta)) continue;
				if (!seenKeys.has(meta.key)) {
					const el = cache.elementMap.get(child);
					if (Predicate.isNotNullable(el)) {
						meta.state = ItemState.Exiting({ element: el });
					}
					animatingCount++;
				}
			}

			cache.state.value =
				animatingCount > 0
					? TransitionGroupState.Animating({ activeCount: animatingCount })
					: TransitionGroupState.Idle();
			cache.cachedChildren = newChildren;
			return newChildren;
		},
	});

	return listNode;
};

export const useTransitionGroupState = (
	node: EffuseNode
): {
	state: Signal<TransitionGroupState>;
	isIdle: () => boolean;
	isAnimating: () => boolean;
} => {
	const cacheNode = node as unknown as {
		_cache?: TransitionGroupCache<unknown>;
	};
	if (Predicate.isNotNullable(cacheNode._cache)) {
		const cache = cacheNode._cache;
		return {
			state: cache.state,
			isIdle: () => isGroupIdle(cache.state.value),
			isAnimating: () => isGroupAnimating(cache.state.value),
		};
	}
	const defaultState = signal<TransitionGroupState>(
		TransitionGroupState.Idle()
	);
	return {
		state: defaultState,
		isIdle: () => true,
		isAnimating: () => false,
	};
};
