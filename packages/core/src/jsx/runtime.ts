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
import type { Signal } from '../reactivity/signal.js';
import type { ReadonlySignal } from '../types/index.js';
import { UnknownJSXTypeError } from '../errors.js';
import { pipe, Predicate } from 'effect';

interface FragmentProps {
	children?: EffuseChild;
}

const FragmentTag = Symbol.for('effuse.fragment');

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
	Predicate.isFunction(value) && '_tag' in value && value._tag === FragmentTag;

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

	if (typeof type === 'string') {
		const childArray = normalizeJSXChildren(children);
		return el(type, propsWithKey as ElementProps, ...childArray);
	}

	if (isBlueprint(type)) {
		const portals =
			typeof children === 'object' &&
			children !== null &&
			!Array.isArray(children)
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
	if (children === undefined || children === null) {
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

	export interface IntrinsicElements {
		[key: string]: HTMLAttributes & Record<string, unknown>;
	}

	export interface HTMLAttributes {
		key?: string | number | undefined;
		ref?: ((el: unknown) => void) | undefined;
		class?:
			| string
			| Record<string, boolean>
			| (string | Record<string, boolean>)[]
			| (() => string | undefined | null);
		className?: string | (() => string | undefined | null);
		style?:
			| string
			| Partial<CSSStyleDeclaration>
			| (() => string | Partial<CSSStyleDeclaration>);
		id?: string | (() => string);
		title?: string | (() => string);
		tabIndex?: number;
		hidden?: boolean | (() => boolean);
		children?: EffuseChild;

		onClick?: (e: MouseEvent) => void;
		onDblClick?: (e: MouseEvent) => void;
		onMouseDown?: (e: MouseEvent) => void;
		onMouseUp?: (e: MouseEvent) => void;
		onMouseEnter?: (e: MouseEvent) => void;
		onMouseLeave?: (e: MouseEvent) => void;
		onMouseMove?: (e: MouseEvent) => void;
		onKeyDown?: (e: KeyboardEvent) => void;
		onKeyUp?: (e: KeyboardEvent) => void;
		onKeyPress?: (e: KeyboardEvent) => void;
		onFocus?: (e: FocusEvent) => void;
		onBlur?: (e: FocusEvent) => void;
		onInput?: (e: Event) => void;
		onChange?: (e: Event) => void;
		onSubmit?: (e: Event) => void;
		onScroll?: (e: Event) => void;

		[key: string]: unknown;
	}

	export interface AnchorAttributes extends HTMLAttributes {
		href?: string;
		target?: string;
		rel?: string;
		download?: string | boolean;
	}

	export interface ButtonAttributes extends HTMLAttributes {
		type?: 'button' | 'submit' | 'reset';
		disabled?:
			| boolean
			| Signal<boolean>
			| ReadonlySignal<boolean>
			| (() => boolean);
	}

	export interface InputAttributes extends HTMLAttributes {
		type?: string;
		value?: string | number | Signal<string> | Signal<number>;
		checked?: boolean | Signal<boolean>;
		disabled?: boolean;
		placeholder?: string;
		name?: string;
		required?: boolean;
		readonly?: boolean;
		min?: string | number;
		max?: string | number;
		step?: string | number;
		pattern?: string;
		autoComplete?: string;
		autoFocus?: boolean;
	}

	export interface FormAttributes extends HTMLAttributes {
		action?: string;
		method?: string;
		encType?: string;
		noValidate?: boolean;
	}

	export interface LabelAttributes extends HTMLAttributes {
		for?: string;
	}

	export interface ImgAttributes extends HTMLAttributes {
		src?: string;
		alt?: string;
		width?: number | string;
		height?: number | string;
		loading?: 'eager' | 'lazy';
	}

	export interface TextareaAttributes extends HTMLAttributes {
		value?: string | Signal<string>;
		placeholder?: string;
		rows?: number;
		cols?: number;
		disabled?: boolean;
		readonly?: boolean;
		required?: boolean;
	}

	export interface SelectAttributes extends HTMLAttributes {
		value?: string | Signal<string>;
		disabled?: boolean;
		multiple?: boolean;
		required?: boolean;
	}

	export interface OptionAttributes extends HTMLAttributes {
		value?: string;
		selected?: boolean;
		disabled?: boolean;
	}

	export interface CanvasAttributes extends HTMLAttributes {
		width?: number | string;
		height?: number | string;
	}

	export interface VideoAttributes extends HTMLAttributes {
		src?: string;
		autoPlay?: boolean;
		controls?: boolean;
		loop?: boolean;
		muted?: boolean;
		poster?: string;
		width?: number | string;
		height?: number | string;
	}

	export interface AudioAttributes extends HTMLAttributes {
		src?: string;
		autoPlay?: boolean;
		controls?: boolean;
		loop?: boolean;
		muted?: boolean;
	}

	export interface IframeAttributes extends HTMLAttributes {
		src?: string;
		width?: number | string;
		height?: number | string;
		allow?: string;
		sandbox?: string;
	}

	export interface SVGAttributes extends HTMLAttributes {
		viewBox?: string;
		xmlns?: string;
		fill?: string;
		stroke?: string;
		strokeWidth?: number | string;
	}

	export interface SVGPathAttributes extends HTMLAttributes {
		d?: string;
		fill?: string;
		stroke?: string;
		strokeWidth?: number | string;
	}

	export interface IntrinsicElements {
		div: HTMLAttributes;
		span: HTMLAttributes;
		p: HTMLAttributes;
		a: AnchorAttributes;
		button: ButtonAttributes;
		input: InputAttributes;
		form: FormAttributes;
		label: LabelAttributes;
		img: ImgAttributes;
		ul: HTMLAttributes;
		ol: HTMLAttributes;
		li: HTMLAttributes;
		h1: HTMLAttributes;
		h2: HTMLAttributes;
		h3: HTMLAttributes;
		h4: HTMLAttributes;
		h5: HTMLAttributes;
		h6: HTMLAttributes;
		header: HTMLAttributes;
		footer: HTMLAttributes;
		main: HTMLAttributes;
		section: HTMLAttributes;
		article: HTMLAttributes;
		nav: HTMLAttributes;
		aside: HTMLAttributes;
		table: HTMLAttributes;
		thead: HTMLAttributes;
		tbody: HTMLAttributes;
		tr: HTMLAttributes;
		th: HTMLAttributes;
		td: HTMLAttributes;
		textarea: TextareaAttributes;
		select: SelectAttributes;
		option: OptionAttributes;
		br: HTMLAttributes;
		hr: HTMLAttributes;
		strong: HTMLAttributes;
		em: HTMLAttributes;
		code: HTMLAttributes;
		pre: HTMLAttributes;
		blockquote: HTMLAttributes;
		canvas: CanvasAttributes;
		video: VideoAttributes;
		audio: AudioAttributes;
		iframe: IframeAttributes;
		svg: SVGAttributes;
		path: SVGPathAttributes;
	}

	export interface ElementChildrenAttribute {
		children: unknown;
	}
}
