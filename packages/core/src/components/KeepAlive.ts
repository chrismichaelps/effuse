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
import {
	Cache,
	Data,
	Duration,
	Effect,
	Exit,
	Match,
	Option,
	Predicate,
	Scope,
} from 'effect';
import { CacheDefaults } from './constants.js';

export class KeepAliveError extends Data.TaggedError('KeepAliveError')<{
	readonly key: string;
	readonly action: 'cache' | 'prune' | 'restore';
	readonly cause: unknown;
}> {}

// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export class CacheMissError extends Data.TaggedError('CacheMissError')<{}> {}

export interface KeepAliveProps {
	include?: string[] | RegExp;
	exclude?: string[] | RegExp;
	max?: number;
	children: EffuseChild | Signal<EffuseChild | null>;
}

export type CachedComponent = Data.TaggedEnum<{
	Cached: {
		readonly key: string;
		readonly child: EffuseChild;
		readonly timestamp: number;
	};
	Fresh: { readonly key: string; readonly child: EffuseChild };
}>;

const { Cached, Fresh } = Data.taggedEnum<CachedComponent>();
export const CachedComponent = { Cached, Fresh };

export interface KeepAliveNode extends ReturnType<typeof createListNode> {
	readonly _cache: Cache.Cache<string, CachedComponent, CacheMissError>;
	readonly _activeKey: Signal<string | null>;
	readonly _cleanup: () => void;
	readonly children: EffuseChild[];
}

const isSignal = <T>(value: unknown): value is Signal<T> =>
	Predicate.isNotNullable(value) &&
	typeof value === 'object' &&
	Predicate.hasProperty(value, 'value');

const hasType = (value: unknown): value is { type: unknown } =>
	Predicate.isNotNullable(value) &&
	typeof value === 'object' &&
	Predicate.hasProperty(value, 'type');

const matchesPattern = (
	name: string,
	pattern: string[] | RegExp | undefined
): boolean =>
	Predicate.isNotNullable(pattern) &&
	(Array.isArray(pattern) ? pattern.includes(name) : pattern.test(name));

const shouldCache = (
	name: string,
	include: string[] | RegExp | undefined,
	exclude: string[] | RegExp | undefined
): boolean =>
	!matchesPattern(name, exclude) &&
	(!Predicate.isNotNullable(include) || matchesPattern(name, include));

const getComponentKey = (child: EffuseChild): string => {
	if (!hasType(child)) return String(Date.now());
	const { type } = child;
	if (typeof type === 'string') return type;
	if (
		typeof type === 'object' &&
		Predicate.isNotNullable(type) &&
		Predicate.hasProperty(type, 'name')
	) {
		const name = (type as { name: unknown }).name;
		if (typeof name === 'string') return name;
	}
	return String(Date.now());
};

const resolveChild = (
	children: EffuseChild | Signal<EffuseChild | null>
): Option.Option<EffuseChild> =>
	isSignal<EffuseChild | null>(children)
		? Option.fromNullable(children.value)
		: Option.fromNullable(children);

export const KeepAlive = (props: KeepAliveProps): EffuseNode => {
	const { include, exclude, max = CacheDefaults.MAX_SIZE } = props;

	const scope = Effect.runSync(Scope.make());
	const cache = Effect.runSync(
		Cache.make<string, CachedComponent, CacheMissError>({
			capacity: max,
			timeToLive: Duration.infinity,
			lookup: () => Effect.fail(new CacheMissError()),
		}).pipe(Scope.extend(scope))
	);

	const activeKey = signal<string | null>(null);
	const listNode = createListNode([]) as KeepAliveNode;

	Object.assign(listNode, {
		_cache: cache,
		_activeKey: activeKey,
		_cleanup: () => {
			Effect.runSync(Scope.close(scope, Exit.void));
		},
	});

	Object.defineProperty(listNode, 'children', {
		enumerable: true,
		configurable: true,
		get(): EffuseChild[] {
			return Option.match(resolveChild(props.children), {
				onNone: () => {
					activeKey.value = null;
					return [];
				},
				onSome: (child) => {
					const key = getComponentKey(child);

					if (!shouldCache(key, include, exclude)) {
						activeKey.value = null;
						return [child];
					}

					const exit = Effect.runSync(Effect.exit(cache.get(key)));
					if (Exit.isSuccess(exit)) {
						activeKey.value = key;
						return Match.value(exit.value).pipe(
							Match.tag('Cached', (c) => [c.child]),
							Match.tag('Fresh', (f) => [f.child]),
							Match.exhaustive
						);
					}

					Effect.runSync(cache.set(key, Fresh({ key, child })));
					activeKey.value = key;
					return [child];
				},
			});
		},
	});

	return listNode;
};

export const useKeepAliveContext = (
	node: EffuseNode
): { activeKey: Signal<string | null>; cacheSize: () => number } => {
	const cacheNode = node as unknown as Partial<KeepAliveNode>;

	if (
		Predicate.isNotNullable(cacheNode._cache) &&
		Predicate.isNotNullable(cacheNode._activeKey)
	) {
		const nodeCache = cacheNode._cache;
		return {
			activeKey: cacheNode._activeKey,
			cacheSize: () => Effect.runSync(nodeCache.size),
		};
	}

	return { activeKey: signal<string | null>(null), cacheSize: () => 0 };
};
