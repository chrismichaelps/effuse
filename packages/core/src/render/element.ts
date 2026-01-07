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

import { Option, pipe } from 'effect';
import {
	type EffuseNode,
	type EffuseChild,
	type ElementProps,
	type ElementNode,
	type BlueprintNode,
	type BlueprintDef,
	type Portals,
	type PortalFn,
	createTextNode,
	createFragmentNode,
} from './node.js';
import { EFFUSE_NODE, NodeType } from '../constants.js';

export function el(
	tag: string,
	props?: ElementProps | null,
	...children: EffuseChild[]
): ElementNode;

export function el<P>(
	blueprint: BlueprintDef<P>,
	props?: P | null,

	// eslint-disable-next-line @typescript-eslint/no-redundant-type-constituents
	portals?: Portals | PortalFn | null
): BlueprintNode<P>;

export function el(
	tagOrBlueprint: string | BlueprintDef,
	propsOrNull?: ElementProps | Record<string, never> | null,
	// eslint-disable-next-line @typescript-eslint/no-redundant-type-constituents
	...rest: (EffuseChild | Portals | PortalFn | null)[]
): EffuseNode {
	if (typeof tagOrBlueprint === 'string') {
		const props = propsOrNull as ElementProps | null;
		const children = normalizeChildren(rest as EffuseChild[]);

		return {
			[EFFUSE_NODE]: true,
			type: NodeType.ELEMENT,
			tag: tagOrBlueprint,
			props: props ?? null,
			children,
			key: pipe(
				Option.fromNullable(props),
				Option.flatMap((p) => Option.fromNullable(p.key)),
				Option.getOrUndefined
			),
		};
	}

	const blueprint = tagOrBlueprint;
	const props = propsOrNull ?? {};
	const portalsArg = rest[0];

	let portals: Portals | null = null;
	if (typeof portalsArg === 'function') {
		portals = { default: portalsArg as PortalFn };
	} else if (
		portalsArg &&
		typeof portalsArg === 'object' &&
		!Array.isArray(portalsArg)
	) {
		portals = portalsArg as Portals;
	}

	return {
		[EFFUSE_NODE]: true,
		type: NodeType.BLUEPRINT,
		blueprint,
		props,
		portals,
		key: (props as { key?: string | number }).key,
	};
}

// Build fragment node
export const fragment = (...children: EffuseChild[]): EffuseNode => {
	return createFragmentNode(normalizeChildren(children));
};

const normalizeChildren = (children: EffuseChild[]): EffuseChild[] => {
	const result: EffuseChild[] = [];

	for (const child of children) {
		if (child === null || child === undefined || typeof child === 'boolean') {
			continue;
		}

		if (Array.isArray(child)) {
			result.push(...normalizeChildren(child));
		} else {
			result.push(child);
		}
	}

	return result;
};

// Convert child to reactive node
export const toNode = (child: EffuseChild): EffuseNode | null => {
	if (child === null || child === undefined || typeof child === 'boolean') {
		return null;
	}

	if (typeof child === 'string') {
		return createTextNode(child);
	}

	if (typeof child === 'number') {
		return createTextNode(String(child));
	}

	if (typeof child === 'object' && EFFUSE_NODE in child) {
		return child;
	}

	return null;
};
