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
import { ArgumentNodeSchema } from './arguments.js';
import { ExpressionNodeSchema, FieldPathNodeSchema } from './expressions.js';
import { NameNodeSchema } from './name.js';
import { ValueNodeSchema } from './values.js';
import { loc } from './location.js';

export const FilterStageNodeSchema: Schema.Schema<AST.FilterStageNode> =
	Schema.Struct({
		kind: Schema.Literal(Kind.FILTER_STAGE),
		condition: ExpressionNodeSchema,
		loc,
	});

export const SortDirectionSchema: Schema.Schema<AST.SortDirection> =
	Schema.Literal('asc', 'desc');

export const SortStageNodeSchema: Schema.Schema<AST.SortStageNode> =
	Schema.Struct({
		kind: Schema.Literal(Kind.SORT_STAGE),
		field: FieldPathNodeSchema,
		direction: SortDirectionSchema,
		loc,
	});

export const TakeStageNodeSchema: Schema.Schema<AST.TakeStageNode> =
	Schema.Struct({
		kind: Schema.Literal(Kind.TAKE_STAGE),
		count: ValueNodeSchema,
		loc,
	});

export const SkipStageNodeSchema: Schema.Schema<AST.SkipStageNode> =
	Schema.Struct({
		kind: Schema.Literal(Kind.SKIP_STAGE),
		count: ValueNodeSchema,
		loc,
	});

export const PageStageNodeSchema: Schema.Schema<AST.PageStageNode> =
	Schema.Struct({
		kind: Schema.Literal(Kind.PAGE_STAGE),
		arguments: Schema.Array(ArgumentNodeSchema),
		loc,
	});

export const UniqueStageNodeSchema: Schema.Schema<AST.UniqueStageNode> =
	Schema.Struct({
		kind: Schema.Literal(Kind.UNIQUE_STAGE),
		loc,
	});

export const CustomStageNodeSchema: Schema.Schema<AST.CustomStageNode> =
	Schema.Struct({
		kind: Schema.Literal(Kind.CUSTOM_STAGE),
		name: NameNodeSchema,
		arguments: Schema.Array(ArgumentNodeSchema),
		loc,
	});

export const PipelineStageNodeSchema: Schema.Schema<AST.PipelineStageNode> =
	Schema.Union(
		FilterStageNodeSchema,
		SortStageNodeSchema,
		TakeStageNodeSchema,
		SkipStageNodeSchema,
		PageStageNodeSchema,
		UniqueStageNodeSchema,
		CustomStageNodeSchema
	);
