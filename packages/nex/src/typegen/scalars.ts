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

/** How each built-in scalar reads in TypeScript. */
export const SCALAR_TYPES: Readonly<Record<string, string>> = {
	ID: 'string',
	String: 'string',
	Int: 'number',
	Float: 'number',
	Boolean: 'boolean',
	DateTime: 'string',
};

/**
 * A scalar the catalog declared but this package knows nothing about.
 *
 * `unknown` rather than `any`: a custom scalar is whatever its server says it
 * is, and a caller should have to say what they expect before using it.
 */
export const CUSTOM_SCALAR_TYPE = 'unknown';

/**
 * How to write the scalars a catalog names, in TypeScript.
 *
 * A scalar the language does not define is whatever its server says it is, so
 * only whoever wrote that server can say what it reads as here. Anything not
 * named stays `unknown`, which is a caller having to say what they expect
 * before using it rather than being handed `any` and finding out later.
 */
export type ScalarTypes = Readonly<Record<string, string>>;

/** What a scalar reads as: what the caller said, or what the language says. */
export const scalarTypeOf = (
	typeName: string,
	written: ScalarTypes
): string => {
	// The language's own scalars mean one thing everywhere, and a catalog
	// cannot redefine them - so neither can this.
	const builtIn = SCALAR_TYPES[typeName];
	if (builtIn !== undefined) return builtIn;

	return written[typeName] ?? CUSTOM_SCALAR_TYPE;
};
