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

import type { SourceLocation } from '../errors/syntax-error.js';

/** How many lines either side of the one being pointed at. */
const DEFAULT_CONTEXT = 1;

/**
 * Show the source around a location, with a caret under the column.
 *
 * Reading `(2:11)` and reading the line itself are different experiences, and
 * the second one is what makes an error obvious. Whitespace before the caret
 * is copied from the line, so a tab-indented document lines up too.
 */
export const printSourceExcerpt = (
	source: string,
	location: SourceLocation,
	options: { readonly context?: number } = {}
): string => {
	const lines = source.split(/\r\n|\r|\n/u);
	const index = location.line - 1;
	const context = Math.max(options.context ?? DEFAULT_CONTEXT, 0);
	const first = Math.max(index - context, 0);
	const last = Math.min(index + context, lines.length - 1);
	const gutter = String(last + 1).length;

	const numbered = (lineNumber: number, text: string): string =>
		`${String(lineNumber).padStart(gutter, ' ')} | ${text}`;

	const out: string[] = [];

	for (let cursor = first; cursor <= last; cursor += 1) {
		const text = lines[cursor] ?? '';
		out.push(numbered(cursor + 1, text));

		if (cursor !== index) continue;

		// Copy the line's own leading whitespace so a tab moves the caret as
		// far as the tab moved the character it points at.
		const before = text.slice(0, Math.max(location.column - 1, 0));
		const padding = [...before]
			.map((character) => (character === '\t' ? '\t' : ' '))
			.join('');
		out.push(`${' '.repeat(gutter)} | ${padding}^`);
	}

	return out.join('\n');
};
