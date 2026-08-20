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
import type { Location } from './location.js';
import type { NameNode } from './name.js';

export interface VariableNode {
	readonly kind: typeof Kind.VARIABLE;
	readonly name: NameNode;
	readonly loc?: Location | undefined;
}

export interface IntValueNode {
	readonly kind: typeof Kind.INT;
	readonly value: string;
	readonly loc?: Location | undefined;
}

export interface FloatValueNode {
	readonly kind: typeof Kind.FLOAT;
	readonly value: string;
	readonly loc?: Location | undefined;
}

export interface StringValueNode {
	readonly kind: typeof Kind.STRING;
	readonly value: string;
	/** True when written as a block string, so printers can round-trip it. */
	readonly block?: boolean | undefined;
	readonly loc?: Location | undefined;
}

export interface BooleanValueNode {
	readonly kind: typeof Kind.BOOLEAN;
	readonly value: boolean;
	readonly loc?: Location | undefined;
}

export interface NullValueNode {
	readonly kind: typeof Kind.NULL;
	readonly loc?: Location | undefined;
}

export interface EnumValueNode {
	readonly kind: typeof Kind.ENUM;
	readonly value: string;
	readonly loc?: Location | undefined;
}

export interface ListValueNode {
	readonly kind: typeof Kind.LIST;
	readonly values: readonly ValueNode[];
	readonly loc?: Location | undefined;
}

export interface ObjectFieldNode {
	readonly kind: typeof Kind.OBJECT_FIELD;
	readonly name: NameNode;
	readonly value: ValueNode;
	readonly loc?: Location | undefined;
}

export interface ObjectValueNode {
	readonly kind: typeof Kind.OBJECT;
	readonly fields: readonly ObjectFieldNode[];
	readonly loc?: Location | undefined;
}

export type ValueNode =
	| VariableNode
	| IntValueNode
	| FloatValueNode
	| StringValueNode
	| BooleanValueNode
	| NullValueNode
	| EnumValueNode
	| ListValueNode
	| ObjectValueNode;
