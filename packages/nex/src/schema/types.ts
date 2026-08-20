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

export const NamedTypeNodeSchema: Schema.Schema<AST.NamedTypeNode> =
	Schema.Struct({
		kind: Schema.Literal(Kind.NAMED_TYPE),
		name: NameNodeSchema,
		loc,
	});

export const ListTypeNodeSchema: Schema.Schema<AST.ListTypeNode> =
	Schema.Struct({
		kind: Schema.Literal(Kind.LIST_TYPE),
		type: Schema.suspend((): Schema.Schema<AST.TypeNode> => TypeNodeSchema),
		loc,
	});

export const NonNullTypeNodeSchema: Schema.Schema<AST.NonNullTypeNode> =
	Schema.Struct({
		kind: Schema.Literal(Kind.NON_NULL_TYPE),
		type: Schema.suspend((): Schema.Schema<AST.TypeNode> => TypeNodeSchema),
		loc,
	});

export const OptionalTypeNodeSchema: Schema.Schema<AST.OptionalTypeNode> =
	Schema.Struct({
		kind: Schema.Literal(Kind.OPTIONAL_TYPE),
		type: Schema.suspend((): Schema.Schema<AST.TypeNode> => TypeNodeSchema),
		loc,
	});

export const TypeNodeSchema: Schema.Schema<AST.TypeNode> = Schema.Union(
	NamedTypeNodeSchema,
	ListTypeNodeSchema,
	NonNullTypeNodeSchema,
	OptionalTypeNodeSchema
);
