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

import type {
	ASTNode,
	ExecutableDefinitionNode,
	SelectionNode,
	TypeNode,
	TypeSystemDefinitionNode,
	TypeSystemExtensionNode,
	ValueNode,
} from './ast/index.js';
import { Kind } from './kinds/index.js';

const kindSet = (...kinds: readonly string[]): ReadonlySet<string> =>
	new Set(kinds);

const EXECUTABLE = kindSet(Kind.OPERATION_DEFINITION, Kind.FRAGMENT_DEFINITION);

const TYPE_SYSTEM = kindSet(
	Kind.SCHEMA_DEFINITION,
	Kind.SCALAR_TYPE_DEFINITION,
	Kind.OBJECT_TYPE_DEFINITION,
	Kind.INTERFACE_TYPE_DEFINITION,
	Kind.UNION_TYPE_DEFINITION,
	Kind.ENUM_TYPE_DEFINITION,
	Kind.INPUT_OBJECT_TYPE_DEFINITION,
	Kind.DIRECTIVE_DEFINITION
);

const TYPE_SYSTEM_EXTENSION = kindSet(
	Kind.SCHEMA_EXTENSION,
	Kind.SCALAR_TYPE_EXTENSION,
	Kind.OBJECT_TYPE_EXTENSION,
	Kind.INTERFACE_TYPE_EXTENSION,
	Kind.UNION_TYPE_EXTENSION,
	Kind.ENUM_TYPE_EXTENSION,
	Kind.INPUT_OBJECT_TYPE_EXTENSION
);

const SELECTION = kindSet(
	Kind.FIELD,
	Kind.FRAGMENT_SPREAD,
	Kind.INLINE_FRAGMENT
);

const VALUE = kindSet(
	Kind.VARIABLE,
	Kind.INT,
	Kind.FLOAT,
	Kind.STRING,
	Kind.BOOLEAN,
	Kind.NULL,
	Kind.ENUM,
	Kind.LIST,
	Kind.OBJECT
);

const TYPE = kindSet(
	Kind.NAMED_TYPE,
	Kind.LIST_TYPE,
	Kind.NON_NULL_TYPE,
	Kind.OPTIONAL_TYPE
);

const PIPELINE_STAGE = kindSet(
	Kind.FILTER_STAGE,
	Kind.SORT_STAGE,
	Kind.TAKE_STAGE,
	Kind.SKIP_STAGE,
	Kind.PAGE_STAGE,
	Kind.UNIQUE_STAGE,
	Kind.CUSTOM_STAGE
);

/** Whether a node is something a request runs: an operation or a fragment. */
export const isExecutableDefinitionNode = (
	node: ASTNode
): node is ExecutableDefinitionNode => EXECUTABLE.has(node.kind);

/** Whether a node describes the catalog. */
export const isTypeSystemDefinitionNode = (
	node: ASTNode
): node is TypeSystemDefinitionNode => TYPE_SYSTEM.has(node.kind);

/** Whether a node adds to something the catalog already declares. */
export const isTypeSystemExtensionNode = (
	node: ASTNode
): node is TypeSystemExtensionNode => TYPE_SYSTEM_EXTENSION.has(node.kind);

/** Whether a node can appear inside a selection set. */
export const isSelectionNode = (node: ASTNode): node is SelectionNode =>
	SELECTION.has(node.kind);

/** Whether a node is a literal a request wrote. */
export const isValueNode = (node: ASTNode): node is ValueNode =>
	VALUE.has(node.kind);

/** Whether a node is a type reference. */
export const isTypeNode = (node: ASTNode): node is TypeNode =>
	TYPE.has(node.kind);

/** Whether a node is a stage in a pipeline. */
export const isPipelineStageNode = (node: ASTNode): boolean =>
	PIPELINE_STAGE.has(node.kind);
