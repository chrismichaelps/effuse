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
import { NodeTypes } from '../constants/index.js';

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

	const nodeType = node.type;

	if (
		nodeType === NodeTypes.MEMBER_EXPRESSION ||
		nodeType === NodeTypes.OPTIONAL_MEMBER_EXPRESSION
	) {
		const memberNode = node as t.MemberExpression | t.OptionalMemberExpression;
		return (
			containsSignalAccess(memberNode.object, accessorSet, visited) ||
			containsSignalAccess(memberNode.property, accessorSet, visited)
		);
	}

	if (
		nodeType === NodeTypes.BINARY_EXPRESSION ||
		nodeType === NodeTypes.LOGICAL_EXPRESSION
	) {
		const binaryNode = node as t.BinaryExpression | t.LogicalExpression;
		return (
			containsSignalAccess(binaryNode.left, accessorSet, visited) ||
			containsSignalAccess(binaryNode.right, accessorSet, visited)
		);
	}

	if (nodeType === NodeTypes.CONDITIONAL_EXPRESSION) {
		const condNode = node as t.ConditionalExpression;
		return (
			containsSignalAccess(condNode.test, accessorSet, visited) ||
			containsSignalAccess(condNode.consequent, accessorSet, visited) ||
			containsSignalAccess(condNode.alternate, accessorSet, visited)
		);
	}

	if (nodeType === NodeTypes.UNARY_EXPRESSION) {
		const unaryNode = node as t.UnaryExpression;
		return containsSignalAccess(unaryNode.argument, accessorSet, visited);
	}

	if (
		nodeType === NodeTypes.CALL_EXPRESSION ||
		nodeType === NodeTypes.OPTIONAL_CALL_EXPRESSION
	) {
		const callNode = node as t.CallExpression | t.OptionalCallExpression;
		if (containsSignalAccess(callNode.callee, accessorSet, visited)) {
			return true;
		}
		for (let i = 0; i < callNode.arguments.length; i++) {
			const arg = callNode.arguments[i];
			if (
				arg.type !== NodeTypes.SPREAD_ELEMENT &&
				containsSignalAccess(arg, accessorSet, visited)
			) {
				return true;
			}
		}
		return false;
	}

	if (nodeType === NodeTypes.TEMPLATE_LITERAL) {
		const templateNode = node as t.TemplateLiteral;
		for (let i = 0; i < templateNode.expressions.length; i++) {
			if (
				containsSignalAccess(templateNode.expressions[i], accessorSet, visited)
			) {
				return true;
			}
		}
		return false;
	}

	if (nodeType === NodeTypes.ARRAY_EXPRESSION) {
		const arrayNode = node as t.ArrayExpression;
		for (let i = 0; i < arrayNode.elements.length; i++) {
			const elem = arrayNode.elements[i];
			if (elem !== null && containsSignalAccess(elem, accessorSet, visited)) {
				return true;
			}
		}
		return false;
	}

	if (nodeType === NodeTypes.OBJECT_EXPRESSION) {
		const objNode = node as t.ObjectExpression;
		for (let i = 0; i < objNode.properties.length; i++) {
			const prop = objNode.properties[i];
			if (prop.type === NodeTypes.OBJECT_PROPERTY) {
				const objProp = prop as t.ObjectProperty;
				if (
					containsSignalAccess(objProp.key, accessorSet, visited) ||
					containsSignalAccess(objProp.value, accessorSet, visited)
				) {
					return true;
				}
			}
		}
		return false;
	}

	return false;
};

export const isEventHandler = (
	name: string,
	prefixSet: Set<string>
): boolean => {
	const lowerName = name.toLowerCase();
	for (const prefix of prefixSet) {
		if (lowerName.startsWith(prefix)) {
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
