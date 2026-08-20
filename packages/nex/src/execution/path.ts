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
 * Where a field sits in the response, kept as a link back to its parent.
 *
 * A run resolves one field per row per selection, and building an array for
 * each one costs an allocation per field for something almost nothing reads: a
 * path matters when a field fails, or when a resolver asks for it. Linking to
 * the parent instead makes the common case free, and {@link pathToArray} pays
 * for the rare one.
 */
export interface ResponsePath {
	readonly key: string | number;
	readonly parent: ResponsePath | undefined;
}

/** Extend a path by one step. */
export const addPath = (
	parent: ResponsePath | undefined,
	key: string | number
): ResponsePath => ({ key, parent });

/** Write a path out, root first, the way a response reads. */
export const pathToArray = (
	path: ResponsePath | undefined
): readonly (string | number)[] => {
	const keys: (string | number)[] = [];

	for (let step = path; step !== undefined; step = step.parent) {
		keys.push(step.key);
	}

	return keys.reverse();
};
