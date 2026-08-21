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

/**
 * Where a directive may be written.
 *
 * Request locations describe a document being sent; catalog locations
 * describe the definitions a catalog is made of.
 */
export const DirectiveLocation = {
	QUERY: 'QUERY',
	MUTATION: 'MUTATION',
	LIVE: 'LIVE',
	FIELD: 'FIELD',
	FRAGMENT_DEFINITION: 'FRAGMENT_DEFINITION',
	FRAGMENT_SPREAD: 'FRAGMENT_SPREAD',
	INLINE_FRAGMENT: 'INLINE_FRAGMENT',
	VARIABLE_DEFINITION: 'VARIABLE_DEFINITION',
	PIPELINE_STAGE: 'PIPELINE_STAGE',
	SCHEMA: 'SCHEMA',
	SCALAR: 'SCALAR',
	OBJECT: 'OBJECT',
	FIELD_DEFINITION: 'FIELD_DEFINITION',
	ARGUMENT_DEFINITION: 'ARGUMENT_DEFINITION',
	INTERFACE: 'INTERFACE',
	UNION: 'UNION',
	ENUM: 'ENUM',
	ENUM_VALUE: 'ENUM_VALUE',
	INPUT_OBJECT: 'INPUT_OBJECT',
	INPUT_FIELD_DEFINITION: 'INPUT_FIELD_DEFINITION',
} as const;

export type DirectiveLocation =
	(typeof DirectiveLocation)[keyof typeof DirectiveLocation];

/** How each location reads in an error message. */
export const DIRECTIVE_LOCATION_LABELS: Readonly<Record<string, string>> = {
	QUERY: 'a query operation',
	MUTATION: 'a mutation operation',
	LIVE: 'a live operation',
	FIELD: 'a field',
	FRAGMENT_DEFINITION: 'a fragment definition',
	FRAGMENT_SPREAD: 'a fragment spread',
	INLINE_FRAGMENT: 'an inline fragment',
	VARIABLE_DEFINITION: 'a variable definition',
	PIPELINE_STAGE: 'a pipeline stage',
	SCHEMA: 'a schema block',
	SCALAR: 'a scalar',
	OBJECT: 'an object type',
	FIELD_DEFINITION: 'a field definition',
	ARGUMENT_DEFINITION: 'an argument',
	INTERFACE: 'an interface',
	UNION: 'a union',
	ENUM: 'an enum',
	ENUM_VALUE: 'an enum value',
	INPUT_OBJECT: 'an input type',
	INPUT_FIELD_DEFINITION: 'a field of an input type',
};
