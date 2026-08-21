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
import type { DirectiveNode } from './directives.js';
import type { Location } from './location.js';
import type { NameNode } from './name.js';
import type { PipelineStageNode } from './pipeline.js';
import type { NamedTypeNode } from './types.js';

export interface FieldNode {
	readonly kind: typeof Kind.FIELD;
	readonly alias?: NameNode | undefined;
	readonly name: NameNode;
	readonly arguments?: readonly ArgumentNode[] | undefined;
	readonly directives?: readonly DirectiveNode[] | undefined;
	/** Pipeline stages applied to this field's list result, in written order. */
	readonly pipeline?: readonly PipelineStageNode[] | undefined;
	readonly selectionSet?: SelectionSetNode | undefined;
	readonly loc?: Location | undefined;
}

export interface FragmentSpreadNode {
	readonly kind: typeof Kind.FRAGMENT_SPREAD;
	readonly name: NameNode;
	/** What this spread gives the fragment, when the fragment takes anything. */
	readonly arguments?: readonly ArgumentNode[] | undefined;
	readonly directives?: readonly DirectiveNode[] | undefined;
	readonly loc?: Location | undefined;
}

export interface InlineFragmentNode {
	readonly kind: typeof Kind.INLINE_FRAGMENT;
	readonly typeCondition?: NamedTypeNode | undefined;
	readonly directives?: readonly DirectiveNode[] | undefined;
	readonly selectionSet: SelectionSetNode;
	readonly loc?: Location | undefined;
}

export type SelectionNode = FieldNode | FragmentSpreadNode | InlineFragmentNode;

export interface SelectionSetNode {
	readonly kind: typeof Kind.SELECTION_SET;
	readonly selections: readonly SelectionNode[];
	readonly loc?: Location | undefined;
}
