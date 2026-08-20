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

import { tokenize } from './lexer/index.js';
import { printBlockString, printString } from '../utils/index.js';
import { TokenKind, type Token } from './token/index.js';

/** Tokens that would run into one another without a space between them. */
const RUNS_TOGETHER: ReadonlySet<TokenKind> = new Set([
	TokenKind.NAME,
	TokenKind.INT,
	TokenKind.FLOAT,
]);

const written = (token: Token): string => {
	switch (token.kind) {
		case TokenKind.STRING:
			return printString(token.value);
		case TokenKind.BLOCK_STRING:
			return printBlockString(token.value);
		default:
			return token.value === '' ? token.kind : token.value;
	}
};

/**
 * Write a request with nothing in it but what it means.
 *
 * Comments and layout are for whoever reads the source; a request travelling
 * over a wire, or into a URL, carries neither. Two names still need a space
 * between them, and a string keeps every character it was written with.
 */
export const minifyRequest = (source: string): string => {
	const tokens = tokenize(source);
	let out = '';
	let previous: Token | undefined;

	for (const token of tokens) {
		if (token.kind === TokenKind.EOF) break;

		if (
			previous !== undefined &&
			RUNS_TOGETHER.has(previous.kind) &&
			RUNS_TOGETHER.has(token.kind)
		) {
			out += ' ';
		}

		out += written(token);
		previous = token;
	}

	return out;
};
