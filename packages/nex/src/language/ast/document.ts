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

import type { Kind } from '../kinds/index.js';
import type { ArgumentNode } from './arguments.js';
import type {
	ExecutableDefinitionNode,
	VariableDefinitionNode,
} from './definitions.js';
import type { DirectiveDefinitionNode } from './directive-definitions.js';
import type { TypeSystemExtensionNode } from './extensions.js';
import type {
	EnumValueDefinitionNode,
	FieldDefinitionNode,
	InputValueDefinitionNode,
} from './field-definitions.js';
import type {
	OperationTypeDefinitionNode,
	SchemaDefinitionNode,
} from './schema-definition.js';
import type { TypeDefinitionNode } from './type-definitions.js';
import type { DirectiveNode } from './directives.js';
import type { ExpressionNode } from './expressions.js';
import type { Location } from './location.js';
import type { NameNode } from './name.js';
import type { PipelineStageNode } from './pipeline.js';
import type { SelectionNode, SelectionSetNode } from './selections.js';
import type { TypeNode } from './types.js';
import type { ObjectFieldNode, ValueNode } from './values.js';

/** A definition that describes the catalog rather than a request. */
export type TypeSystemDefinitionNode =
	| SchemaDefinitionNode
	| TypeDefinitionNode
	| DirectiveDefinitionNode;

/** Any top-level definition a Nex document may contain. */
export type DefinitionNode =
	| ExecutableDefinitionNode
	| TypeSystemDefinitionNode
	| TypeSystemExtensionNode;

export interface DocumentNode {
	readonly kind: typeof Kind.DOCUMENT;
	readonly definitions: readonly DefinitionNode[];
	readonly loc?: Location | undefined;
}

export type ASTNode =
	| NameNode
	| DocumentNode
	| DefinitionNode
	| VariableDefinitionNode
	| SelectionSetNode
	| SelectionNode
	| ArgumentNode
	| DirectiveNode
	| ValueNode
	| ObjectFieldNode
	| TypeNode
	| PipelineStageNode
	| ExpressionNode
	| TypeSystemDefinitionNode
	| TypeSystemExtensionNode
	| OperationTypeDefinitionNode
	| FieldDefinitionNode
	| InputValueDefinitionNode
	| EnumValueDefinitionNode;
