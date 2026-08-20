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
import { loc } from './location.js';
import { NameNodeSchema } from './name.js';
import { TypeNodeSchema } from './types.js';
import { StringValueNodeSchema, ValueNodeSchema } from './values.js';

const description = Schema.optional(StringValueNodeSchema);

export const InputValueDefinitionNodeSchema: Schema.Schema<AST.InputValueDefinitionNode> =
	Schema.Struct({
		kind: Schema.Literal(Kind.INPUT_VALUE_DEFINITION),
		description,
		name: NameNodeSchema,
		type: TypeNodeSchema,
		defaultValue: Schema.optional(ValueNodeSchema),
		directives,
		loc,
	});

export const FieldDefinitionNodeSchema: Schema.Schema<AST.FieldDefinitionNode> =
	Schema.Struct({
		kind: Schema.Literal(Kind.FIELD_DEFINITION),
		description,
		name: NameNodeSchema,
		arguments: Schema.optional(Schema.Array(InputValueDefinitionNodeSchema)),
		type: TypeNodeSchema,
		defaultValue: Schema.optional(ValueNodeSchema),
		directives,
		loc,
	});

export const EnumValueDefinitionNodeSchema: Schema.Schema<AST.EnumValueDefinitionNode> =
	Schema.Struct({
		kind: Schema.Literal(Kind.ENUM_VALUE_DEFINITION),
		description,
		name: NameNodeSchema,
		directives,
		loc,
	});
