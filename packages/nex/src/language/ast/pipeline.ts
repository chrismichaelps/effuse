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
import type { ExpressionNode, FieldPathNode } from './expressions.js';
import type { Location } from './location.js';
import type { NameNode } from './name.js';
import type { ValueNode } from './values.js';

export interface FilterStageNode {
	readonly kind: typeof Kind.FILTER_STAGE;
	readonly condition: ExpressionNode;
	readonly loc?: Location | undefined;
}

/** Sort order; `asc` when the document leaves the direction implicit. */
export type SortDirection = 'asc' | 'desc';

export interface SortStageNode {
	readonly kind: typeof Kind.SORT_STAGE;
	readonly field: FieldPathNode;
	readonly direction: SortDirection;
	readonly loc?: Location | undefined;
}

export interface TakeStageNode {
	readonly kind: typeof Kind.TAKE_STAGE;
	readonly count: ValueNode;
	readonly loc?: Location | undefined;
}

export interface SkipStageNode {
	readonly kind: typeof Kind.SKIP_STAGE;
	readonly count: ValueNode;
	readonly loc?: Location | undefined;
}

export interface PageStageNode {
	readonly kind: typeof Kind.PAGE_STAGE;
	readonly arguments: readonly ArgumentNode[];
	readonly loc?: Location | undefined;
}

export interface UniqueStageNode {
	readonly kind: typeof Kind.UNIQUE_STAGE;
	readonly loc?: Location | undefined;
}

/** A pipeline operator the language does not define, kept for extensions. */
export interface CustomStageNode {
	readonly kind: typeof Kind.CUSTOM_STAGE;
	readonly name: NameNode;
	readonly arguments: readonly ArgumentNode[];
	readonly loc?: Location | undefined;
}

export type PipelineStageNode =
	| FilterStageNode
	| SortStageNode
	| TakeStageNode
	| SkipStageNode
	| PageStageNode
	| UniqueStageNode
	| CustomStageNode;
