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

import type { Kind } from '../kinds/index.js';
import type { Location } from './location.js';
import type { NameNode } from './name.js';
import type { ValueNode } from './values.js';

/** A dot-separated path to a field reachable from the piped list item. */
export interface FieldPathNode {
	readonly kind: typeof Kind.FIELD_PATH;
	readonly segments: readonly NameNode[];
	readonly loc?: Location | undefined;
}

export type ComparisonOperator = '==' | '!=' | '<' | '<=' | '>' | '>=';

export type BinaryOperator = ComparisonOperator | 'and' | 'or';

export interface BinaryExpressionNode {
	readonly kind: typeof Kind.BINARY_EXPRESSION;
	readonly operator: BinaryOperator;
	readonly left: ExpressionNode;
	readonly right: ExpressionNode;
	readonly loc?: Location | undefined;
}

export interface UnaryExpressionNode {
	readonly kind: typeof Kind.UNARY_EXPRESSION;
	readonly operator: 'not';
	readonly expression: ExpressionNode;
	readonly loc?: Location | undefined;
}

export type ExpressionNode =
	| BinaryExpressionNode
	| UnaryExpressionNode
	| FieldPathNode
	| ValueNode;
