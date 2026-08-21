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

import { Kind } from './kinds/index.js';

/**
 * Which kinds of literal each scalar the language defines will take.
 *
 * One table, read wherever a literal meets a type: by validation when it was
 * written into a request, and when a catalog is built and a default is
 * written into the catalog itself. Two copies of this would agree until one
 * of them was changed.
 */
/**
 * Whether a number is a whole one that still means what it says.
 *
 * Past a certain size two different numbers are the same number here, so one
 * written beyond it is not the number it looks like - it is whichever
 * neighbour happened to survive. Taking it would answer with a different
 * number than the one that was asked about, and say nothing about having done
 * so, which is worse than refusing it.
 */
export const isWholeNumber = (value: unknown): value is number =>
	typeof value === 'number' && Number.isSafeInteger(value);

/** What to say about a number that cannot be trusted to mean itself. */
export const NOT_A_WHOLE_NUMBER =
	'must be a whole number small enough to mean itself';

export const SCALAR_LITERAL_KINDS: Readonly<Record<string, readonly string[]>> =
	{
		Int: [Kind.INT],
		Float: [Kind.INT, Kind.FLOAT],
		String: [Kind.STRING],
		Boolean: [Kind.BOOLEAN],
		ID: [Kind.STRING, Kind.INT],
		DateTime: [Kind.STRING],
	};
