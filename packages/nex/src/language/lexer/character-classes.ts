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

export const CHAR = {
	TAB: 9,
	LF: 10,
	CR: 13,
	SPACE: 32,
	BANG: 33,
	QUOTE: 34,
	HASH: 35,
	DOLLAR: 36,
	AMP: 38,
	PAREN_L: 40,
	PAREN_R: 41,
	COMMA: 44,
	DASH: 45,
	DOT: 46,
	ZERO: 48,
	NINE: 57,
	COLON: 58,
	LT: 60,
	EQUALS: 61,
	GT: 62,
	QUESTION: 63,
	AT: 64,
	UPPER_A: 65,
	UPPER_Z: 90,
	BRACKET_L: 91,
	BACKSLASH: 92,
	BRACKET_R: 93,
	UNDERSCORE: 95,
	LOWER_A: 97,
	LOWER_Z: 122,
	BRACE_L: 123,
	PIPE: 124,
	BRACE_R: 125,
	BOM: 0xfeff,
} as const;

export const isDigit = (code: number): boolean =>
	code >= CHAR.ZERO && code <= CHAR.NINE;

export const isNameStart = (code: number): boolean =>
	(code >= CHAR.UPPER_A && code <= CHAR.UPPER_Z) ||
	(code >= CHAR.LOWER_A && code <= CHAR.LOWER_Z) ||
	code === CHAR.UNDERSCORE;

export const isNameContinue = (code: number): boolean =>
	isNameStart(code) || isDigit(code);
