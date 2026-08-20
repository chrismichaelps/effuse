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
	DirectiveNode,
	FieldDefinitionNode,
} from '../language/ast/index.js';
import { Kind } from '../language/kinds/index.js';

const AUTH_DIRECTIVE = 'auth';

/** What a server is asked before a guarded field runs. */
export interface AuthorizeRequest {
	/** What the catalog requires of the caller. */
	readonly requires: string | undefined;
	/** The field being guarded. */
	readonly fieldName: string;
	/** The type that declares it. */
	readonly parentTypeName: string;
	/** The field, named as a coordinate. */
	readonly coordinate: string;
	/** Response path to the field. */
	readonly path: readonly (string | number)[];
	/** Whatever the run was given as its context. */
	readonly context: unknown;
}

/** Decide whether a caller may have a guarded field. */
export type Authorize = (
	request: AuthorizeRequest
) => boolean | Promise<boolean>;

/**
 * What a field's `@auth` requires, or `undefined` when it is not guarded.
 *
 * A guarded field with no requirement written still counts as guarded: the
 * catalog said to ask.
 */
export const authRequirement = (
	definition: FieldDefinitionNode
): { readonly requires: string | undefined } | undefined => {
	const directive: DirectiveNode | undefined = definition.directives?.find(
		(candidate) => candidate.name.value === AUTH_DIRECTIVE
	);
	if (directive === undefined) return undefined;

	const requires = directive.arguments?.find(
		(argument) => argument.name.value === 'requires'
	)?.value;

	return {
		requires:
			requires?.kind === Kind.STRING || requires?.kind === Kind.ENUM
				? requires.value
				: undefined,
	};
};
