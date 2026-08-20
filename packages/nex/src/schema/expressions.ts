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

import { Schema } from 'effect';
import type * as AST from '../language/ast/index.js';
import { Kind } from '../language/kinds/index.js';
import { NameNodeSchema } from './name.js';
import { ValueNodeSchema } from './values.js';
import { loc } from './location.js';

export const FieldPathNodeSchema: Schema.Schema<AST.FieldPathNode> =
	Schema.Struct({
		kind: Schema.Literal(Kind.FIELD_PATH),
		segments: Schema.Array(NameNodeSchema),
		loc,
	});

export const ComparisonOperatorSchema: Schema.Schema<AST.ComparisonOperator> =
	Schema.Literal('==', '!=', '<', '<=', '>', '>=');

export const BinaryOperatorSchema: Schema.Schema<AST.BinaryOperator> =
	Schema.Literal('==', '!=', '<', '<=', '>', '>=', 'and', 'or');

export const BinaryExpressionNodeSchema: Schema.Schema<AST.BinaryExpressionNode> =
	Schema.Struct({
		kind: Schema.Literal(Kind.BINARY_EXPRESSION),
		operator: BinaryOperatorSchema,
		left: Schema.suspend(
			(): Schema.Schema<AST.ExpressionNode> => ExpressionNodeSchema
		),
		right: Schema.suspend(
			(): Schema.Schema<AST.ExpressionNode> => ExpressionNodeSchema
		),
		loc,
	});

export const UnaryExpressionNodeSchema: Schema.Schema<AST.UnaryExpressionNode> =
	Schema.Struct({
		kind: Schema.Literal(Kind.UNARY_EXPRESSION),
		operator: Schema.Literal('not'),
		expression: Schema.suspend(
			(): Schema.Schema<AST.ExpressionNode> => ExpressionNodeSchema
		),
		loc,
	});

export const ExpressionNodeSchema: Schema.Schema<AST.ExpressionNode> =
	Schema.Union(
		BinaryExpressionNodeSchema,
		UnaryExpressionNodeSchema,
		FieldPathNodeSchema,
		ValueNodeSchema
	);
