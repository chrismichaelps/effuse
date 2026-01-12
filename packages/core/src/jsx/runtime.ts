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

import {
	type EffuseNode,
	type EffuseChild,
	type BlueprintDef,
	type Component,
	type Portals,
} from '../render/node.js';
import type { ElementProps } from '../schema/index.js';
import { EFFUSE_NODE, NodeType } from '../constants.js';
import { el, fragment } from '../render/element.js';
import { isBlueprint } from '../blueprint/blueprint.js';
import { UnknownJSXTypeError } from '../errors.js';
import type { BaseIntrinsicElements } from './types/intrinsic.js';
import { pipe, Predicate } from 'effect';

interface FragmentProps {
	children?: EffuseChild;
}

const FragmentTag = Symbol.for('effuse.fragment');

export type * from './types/index.js';

export interface FragmentComponent {
	(props: FragmentProps): EffuseNode;
	readonly _tag: typeof FragmentTag;
}

export const Fragment: FragmentComponent = pipe(
	(props: FragmentProps): EffuseNode =>
		fragment(...normalizeJSXChildren(props.children)),
	(fn) => Object.assign(fn, { _tag: FragmentTag } as const)
);

const isFragment = (value: unknown): value is FragmentComponent =>
	Predicate.isFunction(value) &&
	Predicate.hasProperty(value, '_tag') &&
	value._tag === FragmentTag;

export type JSXElement = EffuseNode;

export const jsx = (
	type: string | BlueprintDef | typeof Fragment,
	props: Record<string, unknown> | null,
	key?: string | number
): EffuseNode => {
	if (type === Fragment) {
		const { children } = props ?? {};
		const childArray = normalizeJSXChildren(children);
		return fragment(...childArray);
	}

	const { children, ...restProps } = props ?? {};
	const propsWithKey = key !== undefined ? { ...restProps, key } : restProps;

	if (Predicate.isString(type)) {
		const childArray = normalizeJSXChildren(children);
		return el(type, propsWithKey as ElementProps, ...childArray);
	}

	if (isBlueprint(type)) {
		const portals =
			Predicate.isObject(children) && !Array.isArray(children)
				? (children as Portals)
				: children
					? { default: () => children as EffuseChild }
					: null;

		const blueprintProps =
			children !== undefined ? { ...propsWithKey, children } : propsWithKey;

		return {
			[EFFUSE_NODE]: true,
			type: NodeType.BLUEPRINT,
			blueprint: type,
			props: blueprintProps,
			portals,
			key: propsWithKey.key as string | number | undefined,
		};
	}

	if (Predicate.isFunction(type) && !isFragment(type)) {
		const componentProps =
			key !== undefined
				? { ...restProps, key, children }
				: { ...restProps, children };
		return (type as Component)(componentProps);
	}

	if (isFragment(type)) {
		return type({ children: children as EffuseChild });
	}

	throw new UnknownJSXTypeError({ type });
};

export const jsxs = jsx;

export const jsxDEV = (
	type: string | BlueprintDef | typeof Fragment,
	props: Record<string, unknown> | null,
	key?: string | number
): EffuseNode => {
	if (type === Fragment) {
		const { children } = props ?? {};
		const childArray = normalizeJSXChildren(children);
		return fragment(...childArray);
	}

	return jsx(type, props, key);
};

const normalizeJSXChildren = (children: unknown): EffuseChild[] => {
	if (Predicate.isNullable(children)) {
		return [];
	}

	if (Array.isArray(children)) {
		return children as EffuseChild[];
	}

	return [children as EffuseChild];
};

// eslint-disable-next-line @typescript-eslint/no-namespace
export namespace JSX {
	export type Element = EffuseNode;
	export type ElementClass = never;

	export interface IntrinsicAttributes {
		key?: string | number | undefined;
	}

	export type ElementType =
		| string
		| BlueprintDef
		| Component
		| FragmentComponent
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		| ((props: any) => EffuseNode);

	// eslint-disable-next-line @typescript-eslint/no-unused-vars
	export type LibraryManagedAttributes<_C, P> = P & IntrinsicAttributes;

	// eslint-disable-next-line @typescript-eslint/no-empty-object-type
	export interface IntrinsicElements extends BaseIntrinsicElements {}

	export interface ElementChildrenAttribute {
		children: unknown;
	}
}
