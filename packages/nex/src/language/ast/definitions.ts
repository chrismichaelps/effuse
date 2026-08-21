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

import type { Kind, OperationType } from '../kinds/index.js';
import type { DirectiveNode } from './directives.js';
import type { Location } from './location.js';
import type { NameNode } from './name.js';
import type { SelectionSetNode } from './selections.js';
import type { NamedTypeNode, TypeNode } from './types.js';
import type { ValueNode, VariableNode } from './values.js';

export interface VariableDefinitionNode {
	readonly kind: typeof Kind.VARIABLE_DEFINITION;
	readonly variable: VariableNode;
	readonly type: TypeNode;
	readonly defaultValue?: ValueNode | undefined;
	readonly directives?: readonly DirectiveNode[] | undefined;
	readonly loc?: Location | undefined;
}

export interface OperationDefinitionNode {
	readonly kind: typeof Kind.OPERATION_DEFINITION;
	readonly operation: OperationType;
	readonly name?: NameNode | undefined;
	readonly variableDefinitions?: readonly VariableDefinitionNode[] | undefined;
	readonly directives?: readonly DirectiveNode[] | undefined;
	readonly selectionSet: SelectionSetNode;
	readonly loc?: Location | undefined;
}

export interface FragmentDefinitionNode {
	readonly kind: typeof Kind.FRAGMENT_DEFINITION;
	readonly name: NameNode;
	/**
	 * What the fragment takes, so it need not reach for an operation's
	 * variables and can be spread more than once with different values.
	 */
	readonly variableDefinitions?: readonly VariableDefinitionNode[] | undefined;
	readonly typeCondition: NamedTypeNode;
	readonly directives?: readonly DirectiveNode[] | undefined;
	readonly selectionSet: SelectionSetNode;
	readonly loc?: Location | undefined;
}

/** A definition that can be executed: an operation or a fragment. */
export type ExecutableDefinitionNode =
	| OperationDefinitionNode
	| FragmentDefinitionNode;
