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
import type { Location } from './location.js';
import type { NameNode } from './name.js';
import type { TypeNode } from './types.js';
import type { StringValueNode, ValueNode } from './values.js';

/** A field on an object or interface type. */
export interface FieldDefinitionNode {
	readonly kind: typeof Kind.FIELD_DEFINITION;
	readonly description?: StringValueNode | undefined;
	readonly name: NameNode;
	readonly arguments?: readonly InputValueDefinitionNode[] | undefined;
	readonly type: TypeNode;
	/** Nex allows a default on an output field, as in `status: Status = DRAFT`. */
	readonly defaultValue?: ValueNode | undefined;
	readonly directives?: readonly DirectiveNode[] | undefined;
	readonly loc?: Location | undefined;
}

/** An argument definition, or a field of an input object type. */
export interface InputValueDefinitionNode {
	readonly kind: typeof Kind.INPUT_VALUE_DEFINITION;
	readonly description?: StringValueNode | undefined;
	readonly name: NameNode;
	readonly type: TypeNode;
	readonly defaultValue?: ValueNode | undefined;
	readonly directives?: readonly DirectiveNode[] | undefined;
	readonly loc?: Location | undefined;
}

/** One member of an enum type. */
export interface EnumValueDefinitionNode {
	readonly kind: typeof Kind.ENUM_VALUE_DEFINITION;
	readonly description?: StringValueNode | undefined;
	readonly name: NameNode;
	readonly directives?: readonly DirectiveNode[] | undefined;
	readonly loc?: Location | undefined;
}
