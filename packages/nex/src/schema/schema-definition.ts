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
import { directives } from './directives.js';
import { loc } from './location.js';
import { NamedTypeNodeSchema } from './types.js';
import { StringValueNodeSchema } from './values.js';

export const OperationTypeDefinitionNodeSchema: Schema.Schema<AST.OperationTypeDefinitionNode> =
	Schema.Struct({
		kind: Schema.Literal(Kind.OPERATION_TYPE_DEFINITION),
		operation: Schema.Enums(OperationType),
		type: NamedTypeNodeSchema,
		loc,
	});

export const SchemaDefinitionNodeSchema: Schema.Schema<AST.SchemaDefinitionNode> =
	Schema.Struct({
		kind: Schema.Literal(Kind.SCHEMA_DEFINITION),
		description: Schema.optional(StringValueNodeSchema),
		directives,
		operationTypes: Schema.Array(OperationTypeDefinitionNodeSchema),
		loc,
	});
