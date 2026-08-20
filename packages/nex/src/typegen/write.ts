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

/** Build the text of a TypeScript object type, one field per line. */
export const objectType = (
	fields: readonly string[],
	indent: number
): string => {
	if (fields.length === 0) return 'Record<string, never>';

	const pad = '\t'.repeat(indent);
	const inner = '\t'.repeat(indent + 1);

	return `{\n${fields.map((field) => `${inner}${field}`).join('\n')}\n${pad}}`;
};

/** Read a name the way TypeScript will accept it as a key. */
export const propertyName = (name: string): string =>
	/^[A-Za-z_$][A-Za-z0-9_$]*$/u.test(name) ? name : `'${name}'`;

/** Name types after the operation they belong to. */
export const typeNameFor = (
	operationName: string | undefined,
	suffix: 'Data' | 'Variables'
): string => `${operationName ?? 'Anonymous'}${suffix}`;
