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

export class DeferredError extends Data.TaggedError('DeferredError')<{
	readonly timeout: number;
	readonly cause: unknown;
}> {}

export interface DeferredProps {
	timeout?: number;
	fallback?: EffuseChild | (() => EffuseChild);
	children: EffuseChild;
}

type DeferredCache = {
	ready: Signal<boolean>;
	child: Option.Option<EffuseChild>;
	timerId: number | null;
};

const createCache = (): DeferredCache => ({
	ready: signal<boolean>(false),
	child: Option.none(),
	timerId: null,
});

const resolveFallback = (
	fallback: EffuseChild | (() => EffuseChild) | undefined
): EffuseChild | null => {
	if (!Predicate.isNotNullable(fallback)) {
		return null;
	}

	if (Predicate.isFunction(fallback)) {
		return fallback();
	}

	return fallback;
};

const DEFAULT_TIMEOUT_MS = 0;

export const Deferred = (props: DeferredProps): EffuseNode => {
	const { timeout = DEFAULT_TIMEOUT_MS, fallback } = props;

	const cache = createCache();

	const listNode = createListNode([]) as ReturnType<typeof createListNode> & {
		_cache: DeferredCache;
		_mounted: boolean;
	};

	listNode._cache = cache;
	listNode._mounted = false;

	Object.defineProperty(listNode, 'children', {
		enumerable: true,
		configurable: true,
		get() {
			if (!listNode._mounted) {
				listNode._mounted = true;
				cache.child = Option.some(props.children);

				if (timeout <= DEFAULT_TIMEOUT_MS) {
					queueMicrotask(() => {
						cache.ready.value = true;
					});
				} else {
					cache.timerId = window.setTimeout(() => {
						cache.ready.value = true;
						cache.timerId = null;
					}, timeout);
				}
			}

			if (!cache.ready.value) {
				const fallbackChild = resolveFallback(fallback);
				return Predicate.isNotNullable(fallbackChild) ? [fallbackChild] : [];
			}

			return Option.match(cache.child, {
				onNone: () => [] as EffuseChild[],
				onSome: (child) => [child] as EffuseChild[],
			});
		},
	});

	return listNode;
};

export const useDeferredState = (
	node: EffuseNode
): { ready: Signal<boolean>; cancel: () => void } => {
	const cacheNode = node as unknown as { _cache?: DeferredCache };

	if (Predicate.isNotNullable(cacheNode._cache)) {
		const nodeCache = cacheNode._cache;
		return {
			ready: nodeCache.ready,
			cancel: () => {
				if (Predicate.isNotNullable(nodeCache.timerId)) {
					window.clearTimeout(nodeCache.timerId);
					nodeCache.timerId = null;
				}
			},
		};
	}

	return {
		ready: signal<boolean>(true),
		cancel: () => {},
	};
};
