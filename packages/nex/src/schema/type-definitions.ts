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
import { directives } from './directives.js';
import {
	EnumValueDefinitionNodeSchema,
	FieldDefinitionNodeSchema,
	InputValueDefinitionNodeSchema,
} from './field-definitions.js';
import { loc } from './location.js';
import { NameNodeSchema } from './name.js';
import { NamedTypeNodeSchema } from './types.js';
import { StringValueNodeSchema } from './values.js';

const description = Schema.optional(StringValueNodeSchema);
const interfaces = Schema.optional(Schema.Array(NamedTypeNodeSchema));

export const ScalarTypeDefinitionNodeSchema: Schema.Schema<AST.ScalarTypeDefinitionNode> =
	Schema.Struct({
		kind: Schema.Literal(Kind.SCALAR_TYPE_DEFINITION),
		description,
		name: NameNodeSchema,
		directives,
		loc,
	});

export const ObjectTypeDefinitionNodeSchema: Schema.Schema<AST.ObjectTypeDefinitionNode> =
	Schema.Struct({
		kind: Schema.Literal(Kind.OBJECT_TYPE_DEFINITION),
		description,
		name: NameNodeSchema,
		interfaces,
		directives,
		fields: Schema.optional(Schema.Array(FieldDefinitionNodeSchema)),
		loc,
	});

export const InterfaceTypeDefinitionNodeSchema: Schema.Schema<AST.InterfaceTypeDefinitionNode> =
	Schema.Struct({
		kind: Schema.Literal(Kind.INTERFACE_TYPE_DEFINITION),
		description,
		name: NameNodeSchema,
		interfaces,
		directives,
		fields: Schema.optional(Schema.Array(FieldDefinitionNodeSchema)),
		loc,
	});

export const UnionTypeDefinitionNodeSchema: Schema.Schema<AST.UnionTypeDefinitionNode> =
	Schema.Struct({
		kind: Schema.Literal(Kind.UNION_TYPE_DEFINITION),
		description,
		name: NameNodeSchema,
		directives,
		types: Schema.optional(Schema.Array(NamedTypeNodeSchema)),
		loc,
	});

export const EnumTypeDefinitionNodeSchema: Schema.Schema<AST.EnumTypeDefinitionNode> =
	Schema.Struct({
		kind: Schema.Literal(Kind.ENUM_TYPE_DEFINITION),
		description,
		name: NameNodeSchema,
		directives,
		values: Schema.optional(Schema.Array(EnumValueDefinitionNodeSchema)),
		loc,
	});

export const InputObjectTypeDefinitionNodeSchema: Schema.Schema<AST.InputObjectTypeDefinitionNode> =
	Schema.Struct({
		kind: Schema.Literal(Kind.INPUT_OBJECT_TYPE_DEFINITION),
		description,
		name: NameNodeSchema,
		directives,
		fields: Schema.optional(Schema.Array(InputValueDefinitionNodeSchema)),
		loc,
	});

export const TypeDefinitionNodeSchema: Schema.Schema<AST.TypeDefinitionNode> =
	Schema.Union(
		ScalarTypeDefinitionNodeSchema,
		ObjectTypeDefinitionNodeSchema,
		InterfaceTypeDefinitionNodeSchema,
		UnionTypeDefinitionNodeSchema,
		EnumTypeDefinitionNodeSchema,
		InputObjectTypeDefinitionNodeSchema
	);
