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

import { Data } from 'effect';

export const EFFUSE_NODE = Symbol.for('effuse.node');

export const FRAGMENT = Symbol.for('effuse.fragment');

export const SIGNAL_REF = Symbol('effuse.signal.ref');

export const REACTIVE_MARKER = Symbol('effuse.reactive');

export const READONLY_MARKER = Symbol('effuse.readonly');

export const MATCH_MARKER = Symbol('effuse.match');

export const SUSPEND_TOKEN = Symbol.for('effuse/SuspendToken');
export const BOUNDARY_ID_PREFIX = 'suspense-boundary-';

export const HYDRATION_SCRIPT_ID = '__EFFUSE_DATA__';

type NodeTypeInternal = Data.TaggedEnum<{
	Element: object;
	Text: object;
	Blueprint: object;
	Fragment: object;
	List: object;
}>;

const { Element, Text, Blueprint, Fragment, List, $is } =
	Data.taggedEnum<NodeTypeInternal>();

export const NodeType = { Element, Text, Blueprint, Fragment, List };

export const isNodeElement = (n: NodeTypeInternal): boolean =>
	$is('Element')(n);
export const isNodeText = (n: NodeTypeInternal): boolean => $is('Text')(n);
export const isNodeBlueprint = (n: NodeTypeInternal): boolean =>
	$is('Blueprint')(n);
export const isNodeFragment = (n: NodeTypeInternal): boolean =>
	$is('Fragment')(n);
export const isNodeList = (n: NodeTypeInternal): boolean => $is('List')(n);

export const matchNodeType = <R>(
	nodeType: NodeTypeInternal,
	handlers: {
		onElement: () => R;
		onText: () => R;
		onBlueprint: () => R;
		onFragment: () => R;
		onList: () => R;
	}
): R => {
	switch (nodeType._tag) {
		case 'Element':
			return handlers.onElement();
		case 'Text':
			return handlers.onText();
		case 'Blueprint':
			return handlers.onBlueprint();
		case 'Fragment':
			return handlers.onFragment();
		case 'List':
			return handlers.onList();
	}
};
