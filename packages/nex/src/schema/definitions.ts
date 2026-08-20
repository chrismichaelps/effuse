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
import { Kind, OperationType } from '../language/kinds/index.js';
import { NameNodeSchema } from './name.js';
import { SelectionSetNodeSchema } from './selections.js';
import { NamedTypeNodeSchema, TypeNodeSchema } from './types.js';
import { ValueNodeSchema, VariableNodeSchema } from './values.js';
import { loc } from './location.js';
import { directives } from './directives.js';

export const VariableDefinitionNodeSchema: Schema.Schema<AST.VariableDefinitionNode> =
	Schema.Struct({
		kind: Schema.Literal(Kind.VARIABLE_DEFINITION),
		variable: VariableNodeSchema,
		type: TypeNodeSchema,
		defaultValue: Schema.optional(ValueNodeSchema),
		directives,
		loc,
	});

export const OperationDefinitionNodeSchema: Schema.Schema<AST.OperationDefinitionNode> =
	Schema.Struct({
		kind: Schema.Literal(Kind.OPERATION_DEFINITION),
		operation: Schema.Enums(OperationType),
		name: Schema.optional(NameNodeSchema),
		variableDefinitions: Schema.optional(
			Schema.Array(VariableDefinitionNodeSchema)
		),
		directives,
		selectionSet: SelectionSetNodeSchema,
		loc,
	});

export const FragmentDefinitionNodeSchema: Schema.Schema<AST.FragmentDefinitionNode> =
	Schema.Struct({
		kind: Schema.Literal(Kind.FRAGMENT_DEFINITION),
		name: NameNodeSchema,
		typeCondition: NamedTypeNodeSchema,
		directives,
		selectionSet: SelectionSetNodeSchema,
		loc,
	});

export const ExecutableDefinitionNodeSchema: Schema.Schema<AST.ExecutableDefinitionNode> =
	Schema.Union(OperationDefinitionNodeSchema, FragmentDefinitionNodeSchema);
