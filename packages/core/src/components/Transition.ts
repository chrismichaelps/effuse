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
import { signal } from '../reactivity/index.js';
import { Data, Option, Predicate } from 'effect';
import {
	TransitionDefaults,
	TransitionClassPrefixes,
	TransitionClassSuffixes,
} from './constants.js';

export class TransitionError extends Data.TaggedError('TransitionError')<{
	readonly phase: 'enter' | 'exit';
	readonly element: Element | null;
	readonly cause: unknown;
}> {}

export type TransitionStateEnum = Data.TaggedEnum<{
	Idle: object;
	Entering: { element: Element };
	Entered: { element: Element };
	Exiting: { element: Element };
	Exited: object;
}>;

const { Idle, Entering, Entered, Exiting, Exited } =
	Data.taggedEnum<TransitionStateEnum>();

export const TransitionStateEnum = { Idle, Entering, Entered, Exiting, Exited };

export type TransitionMode = 'default' | 'out-in' | 'in-out';

export type TransitionState =
	| 'idle'
	| 'entering'
	| 'entered'
	| 'exiting'
	| 'exited';

export const isTransitionIdle = (s: TransitionState): s is 'idle' =>
	s === 'idle';
export const isTransitionEntering = (s: TransitionState): s is 'entering' =>
	s === 'entering';
export const isTransitionEntered = (s: TransitionState): s is 'entered' =>
	s === 'entered';
export const isTransitionExiting = (s: TransitionState): s is 'exiting' =>
	s === 'exiting';
export const isTransitionExited = (s: TransitionState): s is 'exited' =>
	s === 'exited';

export const matchTransitionState = <R>(
	state: TransitionState,
	handlers: {
		onIdle: () => R;
		onEntering: () => R;
		onEntered: () => R;
		onExiting: () => R;
		onExited: () => R;
	}
): R => {
	switch (state) {
		case 'idle':
			return handlers.onIdle();
		case 'entering':
			return handlers.onEntering();
		case 'entered':
			return handlers.onEntered();
		case 'exiting':
			return handlers.onExiting();
		case 'exited':
			return handlers.onExited();
	}
};

export interface TransitionClasses {
	enter?: string;
	enterActive?: string;
	enterTo?: string;
	exit?: string;
	exitActive?: string;
	exitTo?: string;
}

export interface TransitionDurations {
	enter?: number;
	exit?: number;
}

export interface TransitionCallbacks {
	onBeforeEnter?: (el: Element) => void;
	onEnter?: (el: Element, done: () => void) => void;
	onAfterEnter?: (el: Element) => void;
	onEnterCancelled?: (el: Element) => void;
	onBeforeExit?: (el: Element) => void;
	onExit?: (el: Element, done: () => void) => void;
	onAfterExit?: (el: Element) => void;
	onExitCancelled?: (el: Element) => void;
}

export interface TransitionProps extends TransitionCallbacks {
	name?: string;
	mode?: TransitionMode;
	appear?: boolean;
	css?: boolean;
	type?: 'transition' | 'animation';
	duration?: number | TransitionDurations;
	enterClass?: string;
	enterActiveClass?: string;
	enterToClass?: string;
	exitClass?: string;
	exitActiveClass?: string;
	exitToClass?: string;
	children: EffuseChild | Signal<EffuseChild | null>;
}

type TransitionCache = {
	state: Signal<TransitionState>;
	currentChild: Option.Option<EffuseChild>;
	pendingChild: Option.Option<EffuseChild>;
	classes: TransitionClasses;
	durations: { enter: number; exit: number };
};

const resolveClasses = (props: TransitionProps): TransitionClasses => {
	const name = props.name ?? TransitionClassPrefixes.TRANSITION;
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
	};
};

const resolveDurations = (
	props: TransitionProps
): { enter: number; exit: number } => {
	if (!Predicate.isNotNullable(props.duration)) {
		return {
			enter: TransitionDefaults.ENTER_MS,
			exit: TransitionDefaults.EXIT_MS,
		};
	}

	if (typeof props.duration === 'number') {
		return { enter: props.duration, exit: props.duration };
	}

	return {
		enter: props.duration.enter ?? TransitionDefaults.ENTER_MS,
		exit: props.duration.exit ?? TransitionDefaults.EXIT_MS,
	};
};

const addClass = (el: Element, className: string | undefined): void => {
	if (Predicate.isNotNullable(className) && className.length > 0) {
		el.classList.add(...className.split(' ').filter(Boolean));
	}
};

const removeClass = (el: Element, className: string | undefined): void => {
	if (Predicate.isNotNullable(className) && className.length > 0) {
		el.classList.remove(...className.split(' ').filter(Boolean));
	}
};

const resolveChild = (
	children: EffuseChild | Signal<EffuseChild | null>
): EffuseChild | null => {
	if (Predicate.isFunction(children) && 'value' in children) {
		return (children as Signal<EffuseChild | null>).value;
	}
	return children as EffuseChild;
};

const createCache = (props: TransitionProps): TransitionCache => ({
	state: signal<TransitionState>('idle'),
	currentChild: Option.none(),
	pendingChild: Option.none(),
	classes: resolveClasses(props),
	durations: resolveDurations(props),
});

export const performEnter = (
	el: Element,
	classes: TransitionClasses,
	durations: { enter: number; exit: number },
	props: TransitionProps,
	onComplete: () => void
): void => {
	props.onBeforeEnter?.(el);

	addClass(el, classes.enter);
	addClass(el, classes.enterActive);

	requestAnimationFrame(() => {
		requestAnimationFrame(() => {
			removeClass(el, classes.enter);
			addClass(el, classes.enterTo);

			if (Predicate.isNotNullable(props.onEnter)) {
				props.onEnter(el, () => {
					removeClass(el, classes.enterActive);
					removeClass(el, classes.enterTo);
					props.onAfterEnter?.(el);
					onComplete();
				});
			} else {
				setTimeout(() => {
					removeClass(el, classes.enterActive);
					removeClass(el, classes.enterTo);
					props.onAfterEnter?.(el);
					onComplete();
				}, durations.enter);
			}
		});
	});
};

export const performExit = (
	el: Element,
	classes: TransitionClasses,
	durations: { enter: number; exit: number },
	props: TransitionProps,
	onComplete: () => void
): void => {
	props.onBeforeExit?.(el);

	addClass(el, classes.exit);
	addClass(el, classes.exitActive);

	requestAnimationFrame(() => {
		requestAnimationFrame(() => {
			removeClass(el, classes.exit);
			addClass(el, classes.exitTo);

			if (Predicate.isNotNullable(props.onExit)) {
				props.onExit(el, () => {
					removeClass(el, classes.exitActive);
					removeClass(el, classes.exitTo);
					props.onAfterExit?.(el);
					onComplete();
				});
			} else {
				setTimeout(() => {
					removeClass(el, classes.exitActive);
					removeClass(el, classes.exitTo);
					props.onAfterExit?.(el);
					onComplete();
				}, durations.exit);
			}
		});
	});
};

export const Transition = (props: TransitionProps): EffuseNode => {
	const { mode = 'default', appear = false } = props;

	const cache = createCache(props);

	const listNode = createListNode([]) as ReturnType<typeof createListNode> & {
		_cache: TransitionCache;
		_mounted: boolean;
	};

	listNode._cache = cache;
	listNode._mounted = false;

	Object.defineProperty(listNode, 'children', {
		enumerable: true,
		configurable: true,
		get() {
			const newChild = resolveChild(props.children);
			const hasNewChild = Predicate.isNotNullable(newChild);
			const hasCurrentChild = Option.isSome(cache.currentChild);
			const state = cache.state.value;

			if (!listNode._mounted) {
				listNode._mounted = true;

				if (hasNewChild && appear) {
					cache.state.value = 'entering';
					cache.currentChild = Option.some(newChild);
				} else if (hasNewChild) {
					cache.currentChild = Option.some(newChild);
					cache.state.value = 'entered';
				}

				return Option.match(cache.currentChild, {
					onNone: () => [] as EffuseChild[],
					onSome: (child) => [child] as EffuseChild[],
				});
			}

			if (hasNewChild && !hasCurrentChild) {
				cache.currentChild = Option.some(newChild);
				cache.state.value = 'entering';
			}

			if (!hasNewChild && hasCurrentChild && !isTransitionExiting(state)) {
				cache.state.value = 'exiting';
			}

			if (hasNewChild && hasCurrentChild) {
				const current = Option.getOrThrow(cache.currentChild);
				if (current !== newChild) {
					if (mode === 'out-in') {
						cache.pendingChild = Option.some(newChild);
						cache.state.value = 'exiting';
					} else if (mode === 'in-out') {
						cache.pendingChild = Option.some(newChild);
						cache.state.value = 'entering';
					} else {
						cache.currentChild = Option.some(newChild);
					}
				}
			}

			return Option.match(cache.currentChild, {
				onNone: () => {
					cache.state.value = 'idle';
					return [] as EffuseChild[];
				},
				onSome: (child) => [child] as EffuseChild[],
			});
		},
	});

	return listNode;
};

export const useTransitionState = (
	node: EffuseNode
): Signal<TransitionState> => {
	const cacheNode = node as unknown as { _cache?: TransitionCache };
	if (Predicate.isNotNullable(cacheNode._cache)) {
		return cacheNode._cache.state;
	}
	return signal<TransitionState>('idle');
};
