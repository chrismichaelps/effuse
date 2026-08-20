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
import { loc } from './location.js';

export const VariableNodeSchema: Schema.Schema<AST.VariableNode> =
	Schema.Struct({
		kind: Schema.Literal(Kind.VARIABLE),
		name: NameNodeSchema,
		loc,
	});

export const IntValueNodeSchema: Schema.Schema<AST.IntValueNode> =
	Schema.Struct({
		kind: Schema.Literal(Kind.INT),
		value: Schema.String,
		loc,
	});

export const FloatValueNodeSchema: Schema.Schema<AST.FloatValueNode> =
	Schema.Struct({
		kind: Schema.Literal(Kind.FLOAT),
		value: Schema.String,
		loc,
	});

export const StringValueNodeSchema: Schema.Schema<AST.StringValueNode> =
	Schema.Struct({
		kind: Schema.Literal(Kind.STRING),
		value: Schema.String,
		block: Schema.optional(Schema.Boolean),
		loc,
	});

export const BooleanValueNodeSchema: Schema.Schema<AST.BooleanValueNode> =
	Schema.Struct({
		kind: Schema.Literal(Kind.BOOLEAN),
		value: Schema.Boolean,
		loc,
	});

export const NullValueNodeSchema: Schema.Schema<AST.NullValueNode> =
	Schema.Struct({
		kind: Schema.Literal(Kind.NULL),
		loc,
	});

export const EnumValueNodeSchema: Schema.Schema<AST.EnumValueNode> =
	Schema.Struct({
		kind: Schema.Literal(Kind.ENUM),
		value: Schema.String,
		loc,
	});

export const ListValueNodeSchema: Schema.Schema<AST.ListValueNode> =
	Schema.Struct({
		kind: Schema.Literal(Kind.LIST),
		values: Schema.Array(
			Schema.suspend((): Schema.Schema<AST.ValueNode> => ValueNodeSchema)
		),
		loc,
	});

export const ObjectFieldNodeSchema: Schema.Schema<AST.ObjectFieldNode> =
	Schema.Struct({
		kind: Schema.Literal(Kind.OBJECT_FIELD),
		name: NameNodeSchema,
		value: Schema.suspend((): Schema.Schema<AST.ValueNode> => ValueNodeSchema),
		loc,
	});

export const ObjectValueNodeSchema: Schema.Schema<AST.ObjectValueNode> =
	Schema.Struct({
		kind: Schema.Literal(Kind.OBJECT),
		fields: Schema.Array(ObjectFieldNodeSchema),
		loc,
	});

export const ValueNodeSchema: Schema.Schema<AST.ValueNode> = Schema.Union(
	VariableNodeSchema,
	IntValueNodeSchema,
	FloatValueNodeSchema,
	StringValueNodeSchema,
	BooleanValueNodeSchema,
	NullValueNodeSchema,
	EnumValueNodeSchema,
	ListValueNodeSchema,
	ObjectValueNodeSchema
);
