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
import type { Location, NameNode } from '../ast/index.js';

/**
 * A coordinate names one thing in a catalog.
 *
 * `Post`, `Post.title`, `Query.posts(first:)`, `@tag`, `@tag(name:)` - the
 * shapes a lint rule, a deprecation note, or a review comment needs to point
 * at something precisely.
 */
export interface TypeCoordinateNode {
	readonly kind: typeof Kind.TYPE_COORDINATE;
	readonly name: NameNode;
	readonly loc?: Location | undefined;
}

export interface MemberCoordinateNode {
	readonly kind: typeof Kind.MEMBER_COORDINATE;
	readonly name: NameNode;
	readonly member: NameNode;
	readonly loc?: Location | undefined;
}

export interface ArgumentCoordinateNode {
	readonly kind: typeof Kind.ARGUMENT_COORDINATE;
	readonly name: NameNode;
	readonly member: NameNode;
	readonly argument: NameNode;
	readonly loc?: Location | undefined;
}

export interface DirectiveCoordinateNode {
	readonly kind: typeof Kind.DIRECTIVE_COORDINATE;
	readonly name: NameNode;
	readonly loc?: Location | undefined;
}

export interface DirectiveArgumentCoordinateNode {
	readonly kind: typeof Kind.DIRECTIVE_ARGUMENT_COORDINATE;
	readonly name: NameNode;
	readonly argument: NameNode;
	readonly loc?: Location | undefined;
}

export type CoordinateNode =
	| TypeCoordinateNode
	| MemberCoordinateNode
	| ArgumentCoordinateNode
	| DirectiveCoordinateNode
	| DirectiveArgumentCoordinateNode;
