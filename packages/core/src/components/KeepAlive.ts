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
import { CacheDefaults } from './constants.js';

export class KeepAliveError extends Data.TaggedError('KeepAliveError')<{
	readonly key: string;
	readonly action: 'cache' | 'prune' | 'restore';
	readonly cause: unknown;
}> {}

export interface KeepAliveProps {
	include?: string[] | RegExp;
	exclude?: string[] | RegExp;
	max?: number;
	children: EffuseChild | Signal<EffuseChild | null>;
}

type CachedComponent = {
	key: string;
	child: EffuseChild;
	timestamp: number;
	state: unknown;
};

type KeepAliveCache = {
	components: Map<string, CachedComponent>;
	currentKey: Option.Option<string>;
};

const createCache = (): KeepAliveCache => ({
	components: new Map(),
	currentKey: Option.none(),
});

const matchesPattern = (
	name: string,
	pattern: string[] | RegExp | undefined
): boolean => {
	if (!Predicate.isNotNullable(pattern)) {
		return false;
	}

	if (Array.isArray(pattern)) {
		return pattern.includes(name);
	}

	return pattern.test(name);
};

const shouldCache = (
	name: string,
	include: string[] | RegExp | undefined,
	exclude: string[] | RegExp | undefined
): boolean => {
	if (matchesPattern(name, exclude)) {
		return false;
	}

	if (!Predicate.isNotNullable(include)) {
		return true;
	}

	return matchesPattern(name, include);
};

const getComponentKey = (child: EffuseChild): string => {
	if (!Predicate.isNotNullable(child)) {
		return '';
	}

	if (typeof child === 'object' && 'type' in child) {
		const nodeType = child as { type?: string | { name?: string } };
		if (typeof nodeType.type === 'string') {
			return nodeType.type;
		}
		if (
			typeof nodeType.type === 'object' &&
			Predicate.isNotNullable(nodeType.type.name)
		) {
			return nodeType.type.name;
		}
	}

	return String(Date.now());
};

const pruneCache = (cache: KeepAliveCache, max: number): void => {
	while (cache.components.size > max) {
		const firstKey = cache.components.keys().next().value;
		if (Predicate.isNotNullable(firstKey)) {
			cache.components.delete(firstKey);
		}
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

export const KeepAlive = (props: KeepAliveProps): EffuseNode => {
	const { include, exclude, max = CacheDefaults.MAX_SIZE } = props;

	const cache = createCache();
	const activeKey = signal<string | null>(null);

	const listNode = createListNode([]) as ReturnType<typeof createListNode> & {
		_cache: KeepAliveCache;
		_activeKey: Signal<string | null>;
	};

	listNode._cache = cache;
	listNode._activeKey = activeKey;

	Object.defineProperty(listNode, 'children', {
		enumerable: true,
		configurable: true,
		get() {
			const child = resolveChild(props.children);

			if (!Predicate.isNotNullable(child)) {
				activeKey.value = null;
				return [];
			}

			const key = getComponentKey(child);

			if (!shouldCache(key, include, exclude)) {
				activeKey.value = null;
				return [child];
			}

			const existingCached = cache.components.get(key);
			if (Predicate.isNotNullable(existingCached)) {
				existingCached.timestamp = Date.now();

				cache.components.delete(key);
				cache.components.set(key, existingCached);

				activeKey.value = key;
				cache.currentKey = Option.some(key);

				return [existingCached.child];
			}

			const cachedComponent: CachedComponent = {
				key,
				child,
				timestamp: Date.now(),
				state: null,
			};

			cache.components.set(key, cachedComponent);

			pruneCache(cache, max);

			activeKey.value = key;
			cache.currentKey = Option.some(key);

			return [child];
		},
	});

	return listNode;
};

export const useKeepAliveContext = (
	node: EffuseNode
): { activeKey: Signal<string | null>; cacheSize: () => number } => {
	const cacheNode = node as unknown as {
		_cache?: KeepAliveCache;
		_activeKey?: Signal<string | null>;
	};

	if (
		Predicate.isNotNullable(cacheNode._cache) &&
		Predicate.isNotNullable(cacheNode._activeKey)
	) {
		const nodeCache = cacheNode._cache;
		return {
			activeKey: cacheNode._activeKey,
			cacheSize: () => nodeCache.components.size,
		};
	}

	return {
		activeKey: signal<string | null>(null),
		cacheSize: () => 0,
	};
};
