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

import type { ExpressionNode, ValueNode } from '../../language/ast/index.js';
import { Kind } from '../../language/kinds/index.js';
import { valueFromNode } from '../values.js';
import { readPath, type PathReader } from './paths.js';

const compare = (operator: string, left: unknown, right: unknown): boolean => {
	switch (operator) {
		case '==':
			return left === right;
		case '!=':
			return left !== right;
		default:
			break;
	}

	if (
		left === null ||
		left === undefined ||
		right === null ||
		right === undefined
	) {
		return false;
	}

	const ordered =
		typeof left === 'string' && typeof right === 'string'
			? left.localeCompare(right)
			: Number(left) - Number(right);

	switch (operator) {
		case '<':
			return ordered < 0;
		case '<=':
			return ordered <= 0;
		case '>':
			return ordered > 0;
		case '>=':
			return ordered >= 0;
		default:
			return false;
	}
};

const isValueNode = (node: ExpressionNode): node is ValueNode =>
	node.kind !== Kind.BINARY_EXPRESSION &&
	node.kind !== Kind.UNARY_EXPRESSION &&
	node.kind !== Kind.FIELD_PATH;

/** Work out what one side of a comparison holds for this row. */
const operandValue = async (
	reader: PathReader,
	row: unknown,
	typeName: string,
	node: ExpressionNode,
	variables: Readonly<Record<string, unknown>>
): Promise<unknown> => {
	if (node.kind === Kind.FIELD_PATH) {
		return readPath(reader, row, typeName, node);
	}
	if (isValueNode(node)) return valueFromNode(node, variables);
	return undefined;
};

/** Decide whether a row survives a `| filter` condition. */
export const evaluateCondition = async (
	reader: PathReader,
	row: unknown,
	typeName: string,
	condition: ExpressionNode,
	variables: Readonly<Record<string, unknown>>
): Promise<boolean> => {
	switch (condition.kind) {
		case Kind.UNARY_EXPRESSION:
			return !(await evaluateCondition(
				reader,
				row,
				typeName,
				condition.expression,
				variables
			));

		case Kind.BINARY_EXPRESSION: {
			if (condition.operator === 'and' || condition.operator === 'or') {
				const left = await evaluateCondition(
					reader,
					row,
					typeName,
					condition.left,
					variables
				);
				if (condition.operator === 'and' && !left) return false;
				if (condition.operator === 'or' && left) return true;
				return evaluateCondition(
					reader,
					row,
					typeName,
					condition.right,
					variables
				);
			}

			const [left, right] = await Promise.all([
				operandValue(reader, row, typeName, condition.left, variables),
				operandValue(reader, row, typeName, condition.right, variables),
			]);
			return compare(condition.operator, left, right);
		}

		case Kind.FIELD_PATH: {
			const value = await readPath(reader, row, typeName, condition);
			return value === true;
		}

		default:
			return valueFromNode(condition, variables) === true;
	}
};
