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
import {
	ExecutableDefinitionNodeSchema,
	VariableDefinitionNodeSchema,
} from './definitions.js';
import { DirectiveDefinitionNodeSchema } from './directive-definitions.js';
import { TypeSystemExtensionNodeSchema } from './extensions.js';
import {
	EnumValueDefinitionNodeSchema,
	FieldDefinitionNodeSchema,
	InputValueDefinitionNodeSchema,
} from './field-definitions.js';
import {
	OperationTypeDefinitionNodeSchema,
	SchemaDefinitionNodeSchema,
} from './schema-definition.js';

import { TypeDefinitionNodeSchema } from './type-definitions.js';
import { DirectiveNodeSchema } from './directives.js';
import { ExpressionNodeSchema } from './expressions.js';
import { NameNodeSchema } from './name.js';
import { PipelineStageNodeSchema } from './pipeline.js';
import { SelectionNodeSchema, SelectionSetNodeSchema } from './selections.js';
import { TypeNodeSchema } from './types.js';
import { ObjectFieldNodeSchema, ValueNodeSchema } from './values.js';
import { loc } from './location.js';

export const TypeSystemDefinitionNodeSchema: Schema.Schema<AST.TypeSystemDefinitionNode> =
	Schema.Union(
		SchemaDefinitionNodeSchema,
		TypeDefinitionNodeSchema,
		DirectiveDefinitionNodeSchema
	);

export const DefinitionNodeSchema: Schema.Schema<AST.DefinitionNode> =
	Schema.Union(
		ExecutableDefinitionNodeSchema,
		TypeSystemDefinitionNodeSchema,
		TypeSystemExtensionNodeSchema
	);

export const DocumentNodeSchema: Schema.Schema<AST.DocumentNode> =
	Schema.Struct({
		kind: Schema.Literal(Kind.DOCUMENT),
		definitions: Schema.Array(DefinitionNodeSchema),
		loc,
	});

export const ASTNodeSchema: Schema.Schema<AST.ASTNode> = Schema.Union(
	NameNodeSchema,
	DocumentNodeSchema,
	DefinitionNodeSchema,
	VariableDefinitionNodeSchema,
	SelectionSetNodeSchema,
	SelectionNodeSchema,
	ArgumentNodeSchema,
	DirectiveNodeSchema,
	ValueNodeSchema,
	ObjectFieldNodeSchema,
	TypeNodeSchema,
	PipelineStageNodeSchema,
	ExpressionNodeSchema,
	TypeSystemDefinitionNodeSchema,
	TypeSystemExtensionNodeSchema,
	OperationTypeDefinitionNodeSchema,
	FieldDefinitionNodeSchema,
	InputValueDefinitionNodeSchema,
	EnumValueDefinitionNodeSchema
);
