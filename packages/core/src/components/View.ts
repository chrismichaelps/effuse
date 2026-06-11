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
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 */

import {
	EFFUSE_NODE,
	CreateBlueprintNode,
	type BlueprintDef,
	type BlueprintNode,
	type Component,
	type EffuseChild,
} from '../render/node.js';

export interface ViewProps<T extends EffuseChild = EffuseChild> {
	readonly [key: string]: unknown;
	readonly of: () => T;
}

type ViewComponent = Component<Record<string, unknown>> & {
	<T extends EffuseChild = EffuseChild>(
		props: ViewProps<T>
	): BlueprintNode<ViewProps<T>>;
};

const ViewImpl = (<T extends EffuseChild = EffuseChild>(
	props: ViewProps<T>
): BlueprintNode<ViewProps<T>> =>
	CreateBlueprintNode({
		[EFFUSE_NODE]: true,
		blueprint: ViewImpl as unknown as BlueprintDef,
		props: props as unknown as Record<string, unknown>,
		portals: null,
	}) as BlueprintNode<ViewProps<T>>) as ViewComponent;

export const View = Object.assign(ViewImpl, {
	_tag: 'Blueprint' as const,
	view: ({ props }: { readonly props: Record<string, unknown> }) =>
		(props as unknown as ViewProps).of,
});
