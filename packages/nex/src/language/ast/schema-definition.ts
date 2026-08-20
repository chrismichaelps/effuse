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
import type { NamedTypeNode } from './types.js';
import type { StringValueNode } from './values.js';

/** The `schema { ... }` block naming the root operation types. */
export interface SchemaDefinitionNode {
	readonly kind: typeof Kind.SCHEMA_DEFINITION;
	readonly description?: StringValueNode | undefined;
	readonly directives?: readonly DirectiveNode[] | undefined;
	readonly operationTypes: readonly OperationTypeDefinitionNode[];
	readonly loc?: Location | undefined;
}

/** One `query: Query` entry inside a schema block. */
export interface OperationTypeDefinitionNode {
	readonly kind: typeof Kind.OPERATION_TYPE_DEFINITION;
	readonly operation: OperationType;
	readonly type: NamedTypeNode;
	readonly loc?: Location | undefined;
}
