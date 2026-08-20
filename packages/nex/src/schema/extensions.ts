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
import { DirectiveNodeSchema, directives } from './directives.js';
import {
	EnumValueDefinitionNodeSchema,
	FieldDefinitionNodeSchema,
	InputValueDefinitionNodeSchema,
} from './field-definitions.js';
import { loc } from './location.js';
import { NameNodeSchema } from './name.js';
import { OperationTypeDefinitionNodeSchema } from './schema-definition.js';
import { NamedTypeNodeSchema } from './types.js';

export const SchemaExtensionNodeSchema: Schema.Schema<AST.SchemaExtensionNode> =
	Schema.Struct({
		kind: Schema.Literal(Kind.SCHEMA_EXTENSION),
		directives,
		operationTypes: Schema.optional(
			Schema.Array(OperationTypeDefinitionNodeSchema)
		),
		loc,
	});

export const ScalarTypeExtensionNodeSchema: Schema.Schema<AST.ScalarTypeExtensionNode> =
	Schema.Struct({
		kind: Schema.Literal(Kind.SCALAR_TYPE_EXTENSION),
		name: NameNodeSchema,
		directives: Schema.Array(DirectiveNodeSchema),
		loc,
	});

export const ObjectTypeExtensionNodeSchema: Schema.Schema<AST.ObjectTypeExtensionNode> =
	Schema.Struct({
		kind: Schema.Literal(Kind.OBJECT_TYPE_EXTENSION),
		name: NameNodeSchema,
		interfaces: Schema.optional(Schema.Array(NamedTypeNodeSchema)),
		directives,
		fields: Schema.optional(Schema.Array(FieldDefinitionNodeSchema)),
		loc,
	});

export const InterfaceTypeExtensionNodeSchema: Schema.Schema<AST.InterfaceTypeExtensionNode> =
	Schema.Struct({
		kind: Schema.Literal(Kind.INTERFACE_TYPE_EXTENSION),
		name: NameNodeSchema,
		interfaces: Schema.optional(Schema.Array(NamedTypeNodeSchema)),
		directives,
		fields: Schema.optional(Schema.Array(FieldDefinitionNodeSchema)),
		loc,
	});

export const UnionTypeExtensionNodeSchema: Schema.Schema<AST.UnionTypeExtensionNode> =
	Schema.Struct({
		kind: Schema.Literal(Kind.UNION_TYPE_EXTENSION),
		name: NameNodeSchema,
		directives,
		types: Schema.optional(Schema.Array(NamedTypeNodeSchema)),
		loc,
	});

export const EnumTypeExtensionNodeSchema: Schema.Schema<AST.EnumTypeExtensionNode> =
	Schema.Struct({
		kind: Schema.Literal(Kind.ENUM_TYPE_EXTENSION),
		name: NameNodeSchema,
		directives,
		values: Schema.optional(Schema.Array(EnumValueDefinitionNodeSchema)),
		loc,
	});

export const InputObjectTypeExtensionNodeSchema: Schema.Schema<AST.InputObjectTypeExtensionNode> =
	Schema.Struct({
		kind: Schema.Literal(Kind.INPUT_OBJECT_TYPE_EXTENSION),
		name: NameNodeSchema,
		directives,
		fields: Schema.optional(Schema.Array(InputValueDefinitionNodeSchema)),
		loc,
	});

export const TypeExtensionNodeSchema: Schema.Schema<AST.TypeExtensionNode> =
	Schema.Union(
		ScalarTypeExtensionNodeSchema,
		ObjectTypeExtensionNodeSchema,
		InterfaceTypeExtensionNodeSchema,
		UnionTypeExtensionNodeSchema,
		EnumTypeExtensionNodeSchema,
		InputObjectTypeExtensionNodeSchema
	);

export const TypeSystemExtensionNodeSchema: Schema.Schema<AST.TypeSystemExtensionNode> =
	Schema.Union(SchemaExtensionNodeSchema, TypeExtensionNodeSchema);
