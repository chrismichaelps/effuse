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

import type * as t from '@babel/types';
import { VISITOR_KEYS } from '@babel/types';
import { NodeTypes } from '../constants/index.js';

const isNode = (value: unknown): value is t.Node =>
	typeof value === 'object' && value !== null && 'type' in value;

export interface NodeAnalysis {
	readonly containsSignal: boolean;
	readonly isEventHandler: boolean;
	readonly isAlreadyWrapped: boolean;
	readonly isAssignment: boolean;
	readonly shouldWrap: boolean;
}

export const isSignalMemberAccess = (
	node: t.Node,
	accessorSet: Set<string>
): boolean => {
	const nodeType = node.type;

	if (
		nodeType !== NodeTypes.MEMBER_EXPRESSION &&
		nodeType !== NodeTypes.OPTIONAL_MEMBER_EXPRESSION
	) {
		return false;
	}

	const memberNode = node as t.MemberExpression | t.OptionalMemberExpression;

	if (memberNode.property.type === NodeTypes.IDENTIFIER) {
		const propName = (memberNode.property as t.Identifier).name;
		return accessorSet.has(propName);
	}

	return false;
};

export const containsSignalAccess = (
	node: t.Node,
	accessorSet: Set<string>,
	visited: WeakSet<t.Node> = new WeakSet()
): boolean => {
	if (visited.has(node)) return false;
	visited.add(node);

	if (isSignalMemberAccess(node, accessorSet)) {
		return true;
	}

	// A nested element owns its own reactivity. Descending into it would report
	// a signal for the enclosing expression as well and bind the same source
	// twice.
	if (node.type.startsWith('JSX')) {
		return false;
	}

	// Walk whatever children this node has, rather than matching against a list
	// of node types. The list was the defect: a type nobody enumerated returned
	// `false`, and a `false` here means the binding is never wrapped, so it
	// silently stopped updating. Block bodies, object spreads, and object
	// methods were all missing that way. Failing open is the wrong direction for
	// a question whose answer decides whether a binding is reactive at all.
	const childKeys = VISITOR_KEYS[node.type] ?? [];

	for (const key of childKeys) {
		const child = (node as unknown as Record<string, unknown>)[key];
		if (child === null || child === undefined) continue;

		if (Array.isArray(child)) {
			for (const item of child) {
				if (
					isNode(item) &&
					containsSignalAccess(item, accessorSet, visited)
				) {
					return true;
				}
			}
			continue;
		}

		if (isNode(child) && containsSignalAccess(child, accessorSet, visited)) {
			return true;
		}
	}

	return false;
};

/**
 * Mirrors the runtime's rule in `@effuse/core`'s prop binder: a prefix alone is
 * not enough, the next character must start a new word.
 *
 * Matching on the prefix alone made `once`, `online`, and `handler` look like
 * event handlers here while the runtime treated them as ordinary props, so the
 * compiler skipped wrapping them and they silently never updated. The two have
 * to agree, since one decides whether a binding is reactive and the other
 * decides how it is applied.
 */
export const isEventHandler = (
	name: string,
	prefixSet: Set<string>
): boolean => {
	for (const prefix of prefixSet) {
		if (!name.startsWith(prefix)) continue;
		const boundary = name.charAt(prefix.length);
		if (boundary !== '' && boundary === boundary.toUpperCase() && boundary !== boundary.toLowerCase()) {
			return true;
		}
	}
	return false;
};

export const isAlreadyWrapped = (node: t.Node): boolean => {
	return (
		node.type === NodeTypes.ARROW_FUNCTION_EXPRESSION ||
		node.type === NodeTypes.FUNCTION_EXPRESSION
	);
};

export const isAssignment = (node: t.Node): boolean => {
	return (
		node.type === NodeTypes.ASSIGNMENT_EXPRESSION ||
		node.type === NodeTypes.UPDATE_EXPRESSION
	);
};

export const analyzeNode = (
	node: t.Node,
	accessorSet: Set<string>,
	prefixSet: Set<string>,
	attrName?: string
): NodeAnalysis => {
	const hasSignal = containsSignalAccess(node, accessorSet);
	const isEvent = attrName ? isEventHandler(attrName, prefixSet) : false;
	const isWrapped = isAlreadyWrapped(node);
	const isAssign = isAssignment(node);

	return {
		containsSignal: hasSignal,
		isEventHandler: isEvent,
		isAlreadyWrapped: isWrapped,
		isAssignment: isAssign,
		shouldWrap: hasSignal && !isEvent && !isWrapped && !isAssign,
	};
};
