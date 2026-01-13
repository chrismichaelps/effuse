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
import { EFFUSE_NODE } from '../constants.js';
import { Option, pipe, Predicate } from 'effect';

const MATCH_MARKER = Symbol('effuse.match');

type MatchNode<T> = {
	[EFFUSE_NODE]: true;
	_tag: 'Fragment';
	_matchMarker: typeof MATCH_MARKER;
	when: Signal<T> | (() => T) | T;
	children: EffuseChild | ((item: NonNullable<T>) => EffuseChild);
};

type MatchResult = {
	index: number;
	value: NonNullable<unknown>;
	match: MatchNode<unknown>;
};

type SwitchCache = {
	lastMatchIndex: number;
	cachedChild: Option.Option<EffuseChild>;
};

type ConditionInput =
	| Signal<unknown>
	| (() => unknown)
	| boolean
	| string
	| number
	| object
	| null
	| undefined;

const createMatch = <T>(props: {
	when: Signal<T> | (() => T) | T;
	children: EffuseChild | ((item: NonNullable<T>) => EffuseChild);
}): MatchNode<T> => ({
	[EFFUSE_NODE]: true,
	_tag: 'Fragment',
	_matchMarker: MATCH_MARKER,
	when: props.when,
	children: props.children,
});

const isMatchNode = (node: unknown): node is MatchNode<unknown> => {
	if (!Predicate.isObject(node)) return false;
	if (!Predicate.hasProperty(node, '_matchMarker')) return false;
	return node._matchMarker === MATCH_MARKER;
};

const createSwitchCache = (): SwitchCache => ({
	lastMatchIndex: -1,
	cachedChild: Option.none(),
});

const isSignalLike = (val: unknown): val is Signal<unknown> =>
	Predicate.isObject(val) && Predicate.hasProperty(val, 'value');

const isConditionFunction = (val: unknown): val is () => unknown =>
	Predicate.isFunction(val);

const resolveConditionValue = (condition: ConditionInput): unknown => {
	if (isConditionFunction(condition)) {
		return condition();
	}

	if (isSignalLike(condition)) {
		return condition.value;
	}

	return condition;
};

const isTruthy = (value: unknown): value is NonNullable<unknown> =>
	Predicate.isNotNullable(value) && value !== false;

const findFirstMatch = (
	matches: MatchNode<unknown>[]
): Option.Option<MatchResult> => {
	for (let i = 0; i < matches.length; i++) {
		const match = matches[i];
		if (!Predicate.isNotNullable(match)) continue;
		if (!isMatchNode(match)) continue;

		const value = resolveConditionValue(match.when as ConditionInput);
		if (isTruthy(value)) {
			return Option.some({ index: i, value, match });
		}
	}
	return Option.none();
};

const renderMatchChild = (
	match: MatchNode<unknown>,
	value: NonNullable<unknown>
): EffuseChild => {
	if (Predicate.isFunction(match.children)) {
		return (match.children as (item: NonNullable<unknown>) => EffuseChild)(
			value
		);
	}
	return match.children;
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

export interface SwitchProps {
	fallback?: EffuseChild | (() => EffuseChild);
	children: MatchNode<unknown>[] | MatchNode<unknown>;
}

const createSwitch = (props: SwitchProps): EffuseNode => {
	const { fallback, children } = props;

	const listNode = createListNode([]) as ReturnType<typeof createListNode> & {
		_cache: SwitchCache;
	};

	listNode._cache = createSwitchCache();

	Object.defineProperty(listNode, 'children', {
		enumerable: true,
		configurable: true,
		get() {
			const cache = listNode._cache;
			const matchNodes = Array.isArray(children) ? children : [children];

			const matchResult = findFirstMatch(matchNodes);

			if (Option.isNone(matchResult)) {
				cache.lastMatchIndex = -1;
				cache.cachedChild = Option.none();
				return resolveFallback(fallback);
			}

			const { index, value, match } = matchResult.value;

			if (cache.lastMatchIndex !== index) {
				cache.lastMatchIndex = index;
				cache.cachedChild = Option.some(renderMatchChild(match, value));
			}

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

export const Switch = Object.assign(createSwitch, {
	Match: createMatch,
});
