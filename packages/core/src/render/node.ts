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

import type { Signal } from '../types/index.js';
import type {
	ElementNode,
	TextNode,
	FragmentNode,
	ListNode,
	Portals,
	PortalFn,
} from '../schema/index.js';
import { EFFUSE_NODE, NodeType } from '../constants.js';

export type {
	ElementNode,
	TextNode,
	FragmentNode,
	ListNode,
	Portals,
	PortalFn,
};
export type { ElementProps } from '../schema/index.js';

export { EFFUSE_NODE, NodeType };

export type EffuseChild =
	| EffuseNode
	| string
	| number
	| boolean
	| null
	| undefined
	| Signal<EffuseChild>
	| (() => EffuseChild)
	| EffuseChild[];

export interface BlueprintContext<P = Record<string, unknown>> {
	readonly props: P;
	readonly state: Record<string, unknown>;
	readonly portals: Portals;
}

export interface BlueprintDef<P = Record<string, unknown>> {
	readonly _tag: 'Blueprint';
	readonly name?: string | undefined;
	readonly props?: P | undefined;
	state?(props: P): Record<string, unknown>;
	view(context: BlueprintContext<P>): EffuseChild;
	error?(error: Error): EffuseChild;
	loading?(): EffuseChild;
}

export interface Component<
	P = Record<string, unknown>,
> extends BlueprintDef<P> {
	(props?: P): EffuseNode;
}

export interface BlueprintNode<P = Record<string, unknown>> {
	readonly [EFFUSE_NODE]: true;
	readonly type: typeof NodeType.BLUEPRINT;
	readonly key?: string | number | undefined;
	readonly blueprint: BlueprintDef<P>;
	readonly props: P;
	readonly portals: Portals | null;
}

export type EffuseNode =
	| ElementNode
	| TextNode
	| FragmentNode
	| ListNode
	| BlueprintNode;

export const isEffuseNode = (value: unknown): value is EffuseNode => {
	return (
		typeof value === 'object' &&
		value !== null &&
		EFFUSE_NODE in value &&
		(value as Record<symbol, unknown>)[EFFUSE_NODE] === true
	);
};

export const isSignalChild = (value: unknown): value is Signal<EffuseChild> => {
	return (
		typeof value === 'object' &&
		value !== null &&
		'value' in value &&
		typeof (value as Record<string, unknown>)._subscribers === 'object'
	);
};

export const createTextNode = (text: string): TextNode => ({
	[EFFUSE_NODE]: true,
	type: NodeType.TEXT,
	text,
});

export const createFragmentNode = (children: EffuseChild[]): FragmentNode => ({
	[EFFUSE_NODE]: true,
	type: NodeType.FRAGMENT,
	children,
});

export const createListNode = (children: EffuseChild[]): ListNode => ({
	[EFFUSE_NODE]: true,
	type: NodeType.LIST,
	children,
});
