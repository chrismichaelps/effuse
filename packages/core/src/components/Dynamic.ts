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

import type {
	EffuseNode,
	EffuseChild,
	BlueprintNode,
	Portals,
} from '../render/node.js';
import { createListNode } from '../render/node.js';
import type { Signal } from '../types/index.js';
import { instantiateBlueprint, isBlueprint } from '../blueprint/blueprint.js';
import { Option, pipe, Predicate } from 'effect';

export interface DynamicProps<P extends Record<string, unknown>> {
	component: Signal<BlueprintNode<P> | null> | (() => BlueprintNode<P> | null);
	props?: P;
	fallback?: EffuseChild | (() => EffuseChild);
	portals?: Portals;
}

type DynamicCache<P extends Record<string, unknown>> = {
	lastComponent: Option.Option<BlueprintNode<P>>;
	cachedChild: Option.Option<EffuseChild>;
};

const createDynamicCache = <
	P extends Record<string, unknown>,
>(): DynamicCache<P> => ({
	lastComponent: Option.none(),
	cachedChild: Option.none(),
});

const resolveComponent = <P extends Record<string, unknown>>(
	componentSignal:
		| Signal<BlueprintNode<P> | null>
		| (() => BlueprintNode<P> | null)
): Option.Option<BlueprintNode<P>> => {
	const component = Predicate.isFunction(componentSignal)
		? componentSignal()
		: componentSignal.value;

	return Option.fromNullable(component);
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

const instantiateComponent = <P extends Record<string, unknown>>(
	component: BlueprintNode<P>,
	props: P,
	portals: Portals
): EffuseChild => {
	if (isBlueprint(component)) {
		const ctx = instantiateBlueprint(component.blueprint, props, portals);
		return { ...component, ...ctx } as unknown as EffuseChild;
	}
	return component as unknown as EffuseChild;
};

const componentEquals = <P extends Record<string, unknown>>(
	a: Option.Option<BlueprintNode<P>>,
	b: Option.Option<BlueprintNode<P>>
): boolean => {
	if (Option.isNone(a) && Option.isNone(b)) return true;
	if (Option.isNone(a) || Option.isNone(b)) return false;
	return a.value === b.value;
};

export const Dynamic = <P extends Record<string, unknown>>(
	dynamicProps: DynamicProps<P>
): EffuseNode => {
	const { component: componentSignal, props, fallback } = dynamicProps;
	const portals = Predicate.isNotNullable(dynamicProps.portals)
		? dynamicProps.portals
		: {};

	const listNode = createListNode([]) as ReturnType<typeof createListNode> & {
		_cache: DynamicCache<P>;
	};

	listNode._cache = createDynamicCache<P>();

	Object.defineProperty(listNode, 'children', {
		enumerable: true,
		configurable: true,
		get() {
			const cache = listNode._cache;
			const componentOpt = resolveComponent(componentSignal);

			if (Option.isNone(componentOpt)) {
				cache.lastComponent = Option.none();
				cache.cachedChild = Option.none();
				return resolveFallback(fallback);
			}

			const component = componentOpt.value;

			if (!componentEquals(cache.lastComponent, componentOpt)) {
				cache.lastComponent = componentOpt;
				const resolvedProps = Predicate.isNotNullable(props)
					? props
					: ({} as P);
				cache.cachedChild = Option.some(
					instantiateComponent(component, resolvedProps, portals)
				);
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
