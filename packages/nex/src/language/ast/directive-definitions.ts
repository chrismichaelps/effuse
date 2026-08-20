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
import type { InputValueDefinitionNode } from './field-definitions.js';
import type { Location } from './location.js';
import type { NameNode } from './name.js';
import type { StringValueNode } from './values.js';

/** A `directive @name(args) on LOCATION | LOCATION` declaration. */
export interface DirectiveDefinitionNode {
	readonly kind: typeof Kind.DIRECTIVE_DEFINITION;
	readonly description?: StringValueNode | undefined;
	readonly name: NameNode;
	readonly arguments?: readonly InputValueDefinitionNode[] | undefined;
	/** True when the directive may be applied more than once in one place. */
	readonly repeatable: boolean;
	readonly locations: readonly NameNode[];
	readonly loc?: Location | undefined;
}
