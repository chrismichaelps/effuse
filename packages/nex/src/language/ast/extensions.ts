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
import type { DirectiveNode } from './directives.js';
import type {
	EnumValueDefinitionNode,
	FieldDefinitionNode,
	InputValueDefinitionNode,
} from './field-definitions.js';
import type { Location } from './location.js';
import type { NameNode } from './name.js';
import type { OperationTypeDefinitionNode } from './schema-definition.js';
import type { NamedTypeNode } from './types.js';

/**
 * Extensions add to what a catalog already declares.
 *
 * They carry no description: the definition being extended owns that.
 */
export interface SchemaExtensionNode {
	readonly kind: typeof Kind.SCHEMA_EXTENSION;
	readonly directives?: readonly DirectiveNode[] | undefined;
	readonly operationTypes?: readonly OperationTypeDefinitionNode[] | undefined;
	readonly loc?: Location | undefined;
}

export interface ScalarTypeExtensionNode {
	readonly kind: typeof Kind.SCALAR_TYPE_EXTENSION;
	readonly name: NameNode;
	readonly directives: readonly DirectiveNode[];
	readonly loc?: Location | undefined;
}

export interface ObjectTypeExtensionNode {
	readonly kind: typeof Kind.OBJECT_TYPE_EXTENSION;
	readonly name: NameNode;
	readonly interfaces?: readonly NamedTypeNode[] | undefined;
	readonly directives?: readonly DirectiveNode[] | undefined;
	readonly fields?: readonly FieldDefinitionNode[] | undefined;
	readonly loc?: Location | undefined;
}

export interface InterfaceTypeExtensionNode {
	readonly kind: typeof Kind.INTERFACE_TYPE_EXTENSION;
	readonly name: NameNode;
	readonly interfaces?: readonly NamedTypeNode[] | undefined;
	readonly directives?: readonly DirectiveNode[] | undefined;
	readonly fields?: readonly FieldDefinitionNode[] | undefined;
	readonly loc?: Location | undefined;
}

export interface UnionTypeExtensionNode {
	readonly kind: typeof Kind.UNION_TYPE_EXTENSION;
	readonly name: NameNode;
	readonly directives?: readonly DirectiveNode[] | undefined;
	readonly types?: readonly NamedTypeNode[] | undefined;
	readonly loc?: Location | undefined;
}

export interface EnumTypeExtensionNode {
	readonly kind: typeof Kind.ENUM_TYPE_EXTENSION;
	readonly name: NameNode;
	readonly directives?: readonly DirectiveNode[] | undefined;
	readonly values?: readonly EnumValueDefinitionNode[] | undefined;
	readonly loc?: Location | undefined;
}

export interface InputObjectTypeExtensionNode {
	readonly kind: typeof Kind.INPUT_OBJECT_TYPE_EXTENSION;
	readonly name: NameNode;
	readonly directives?: readonly DirectiveNode[] | undefined;
	readonly fields?: readonly InputValueDefinitionNode[] | undefined;
	readonly loc?: Location | undefined;
}

/** Any extension of a named type. */
export type TypeExtensionNode =
	| ScalarTypeExtensionNode
	| ObjectTypeExtensionNode
	| InterfaceTypeExtensionNode
	| UnionTypeExtensionNode
	| EnumTypeExtensionNode
	| InputObjectTypeExtensionNode;

/** Any extension a document may carry. */
export type TypeSystemExtensionNode = SchemaExtensionNode | TypeExtensionNode;
