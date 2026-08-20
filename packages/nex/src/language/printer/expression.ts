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

import type { ExpressionNode } from '../ast/index.js';
import { Kind } from '../kinds/index.js';
import { printValue } from './value.js';

const isBinary = (expression: ExpressionNode): boolean =>
	expression.kind === Kind.BINARY_EXPRESSION;

/** Render a pipeline expression, parenthesising only where precedence needs it. */
export const printExpression = (expression: ExpressionNode): string => {
	switch (expression.kind) {
		case Kind.FIELD_PATH:
			return expression.segments.map((segment) => segment.value).join('.');
		case Kind.UNARY_EXPRESSION: {
			const inner = printExpression(expression.expression);
			return isBinary(expression.expression)
				? `not (${inner})`
				: `not ${inner}`;
		}
		case Kind.BINARY_EXPRESSION: {
			const isBoolean =
				expression.operator === 'and' || expression.operator === 'or';
			const wrap = (side: ExpressionNode): string => {
				const printed = printExpression(side);
				const needsParens =
					isBinary(side) &&
					(!isBoolean ||
						(expression.operator === 'and' &&
							(side as { readonly operator: string }).operator === 'or'));
				return needsParens ? `(${printed})` : printed;
			};
			return `${wrap(expression.left)} ${expression.operator} ${wrap(expression.right)}`;
		}
		default:
			return printValue(expression);
	}
};
