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
import { isServerRendering } from '../render/render-context.js';
import { attachNodeResourceDisposer } from '../render/node-resource.js';

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
	timerId: ReturnType<typeof setTimeout> | null;
	generation: number;
	disposed: boolean;
};

const createCache = (): DeferredCache => ({
	ready: signal<boolean>(false),
	child: Option.none(),
	timerId: null,
	generation: 0,
	disposed: false,
});

const cancelPending = (cache: DeferredCache): void => {
	cache.generation += 1;
	if (Predicate.isNotNullable(cache.timerId)) {
		clearTimeout(cache.timerId);
		cache.timerId = null;
	}
};

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
	attachNodeResourceDisposer(listNode, () => {
		cache.disposed = true;
		cancelPending(cache);
		cache.child = Option.none();
	});

	Object.defineProperty(listNode, 'children', {
		enumerable: true,
		configurable: true,
		get() {
			if (isServerRendering()) {
				return [props.children];
			}
			if (cache.disposed) return [];

			if (!listNode._mounted) {
				listNode._mounted = true;
				cache.child = Option.some(props.children);
				const generation = cache.generation;

				if (timeout <= DEFAULT_TIMEOUT_MS) {
					queueMicrotask(() => {
						if (cache.disposed || generation !== cache.generation) return;
						cache.ready.value = true;
					});
				} else {
					cache.timerId = setTimeout(() => {
						if (cache.disposed || generation !== cache.generation) return;
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
			cancel: () => cancelPending(nodeCache),
		};
	}

	return {
		ready: signal<boolean>(true),
		cancel: () => {},
	};
};
