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

import { NexSyntaxError } from '../../errors/index.js';
import { printSourceExcerpt } from '../source-excerpt.js';
import { TokenKind, type Token } from '../token/index.js';
import { dedentBlockString } from './block-string.js';
import {
	CHAR,
	isDigit,
	isNameContinue,
	isNameStart,
} from './character-classes.js';
import { ESCAPES } from './escapes.js';
import { SINGLE_CHAR_TOKENS } from './punctuators.js';

/**
 * Scan `source` into the full token stream, terminated by a single EOF token.
 *
 * Throws {@link NexSyntaxError}; callers should prefer the `LexerService`,
 * which surfaces the failure in the Effect error channel.
 */
export const tokenize = (source: string): readonly Token[] => {
	const tokens: Token[] = [];
	let index = 0;
	let line = 1;
	let lineStart = 0;

	const columnAt = (offset: number): number => offset - lineStart + 1;

	const fail = (message: string, offset: number): never => {
		const location = { start: offset, line, column: columnAt(offset) };
		throw new NexSyntaxError({
			message,
			location,
			excerpt: printSourceExcerpt(source, location),
		});
	};

	const push = (
		kind: TokenKind,
		value: string,
		start: number,
		end: number,
		at: number
	): void => {
		tokens.push({ kind, value, start, end, line, column: columnAt(at) });
	};

	const readNumber = (start: number): void => {
		let cursor = start;
		let isFloat = false;

		if (source.charCodeAt(cursor) === CHAR.DASH) cursor += 1;
		if (!isDigit(source.charCodeAt(cursor))) {
			fail('Expected a digit in numeric literal', cursor);
		}
		while (isDigit(source.charCodeAt(cursor))) cursor += 1;

		if (
			source.charCodeAt(cursor) === CHAR.DOT &&
			isDigit(source.charCodeAt(cursor + 1))
		) {
			isFloat = true;
			cursor += 1;
			while (isDigit(source.charCodeAt(cursor))) cursor += 1;
		}

		const exponent = source.charCodeAt(cursor);
		if (exponent === 101 || exponent === 69) {
			isFloat = true;
			cursor += 1;
			const sign = source.charCodeAt(cursor);
			if (sign === CHAR.DASH || sign === 43) cursor += 1;
			if (!isDigit(source.charCodeAt(cursor))) {
				fail('Expected a digit in the exponent of a numeric literal', cursor);
			}
			while (isDigit(source.charCodeAt(cursor))) cursor += 1;
		}

		push(
			isFloat ? TokenKind.FLOAT : TokenKind.INT,
			source.slice(start, cursor),
			start,
			cursor,
			start
		);
		index = cursor;
	};

	const readString = (start: number): void => {
		let cursor = start + 1;
		let value = '';

		for (;;) {
			if (cursor >= source.length) fail('Unterminated string literal', start);

			const code = source.charCodeAt(cursor);
			if (code === CHAR.QUOTE) {
				cursor += 1;
				break;
			}
			if (code === CHAR.LF || code === CHAR.CR) {
				fail('Unterminated string literal', start);
			}
			if (code !== CHAR.BACKSLASH) {
				value += source[cursor];
				cursor += 1;
				continue;
			}

			const escape = source.charCodeAt(cursor + 1);
			if (escape === 117) {
				const digits = source.slice(cursor + 2, cursor + 6);
				if (!/^[0-9a-fA-F]{4}$/u.test(digits)) {
					fail(`Invalid unicode escape sequence: \\u${digits}`, cursor);
				}
				value += String.fromCharCode(Number.parseInt(digits, 16));
				cursor += 6;
				continue;
			}

			const replacement = ESCAPES.get(escape);
			if (replacement === undefined) {
				fail(`Invalid escape sequence: \\${source[cursor + 1] ?? ''}`, cursor);
			}
			value += replacement;
			cursor += 2;
		}

		push(TokenKind.STRING, value, start, cursor, start);
		index = cursor;
	};

	const readBlockString = (start: number): void => {
		const startLine = line;
		const startColumn = columnAt(start);
		let cursor = start + 3;
		let raw = '';

		for (;;) {
			if (cursor >= source.length)
				fail('Unterminated block string literal', start);

			if (
				source.startsWith('"""', cursor) &&
				source.charCodeAt(cursor - 1) !== CHAR.BACKSLASH
			) {
				cursor += 3;
				break;
			}
			if (source.startsWith('\\"""', cursor)) {
				raw += '"""';
				cursor += 4;
				continue;
			}
			if (source.charCodeAt(cursor) === CHAR.LF) {
				line += 1;
				lineStart = cursor + 1;
			}
			raw += source[cursor];
			cursor += 1;
		}

		tokens.push({
			kind: TokenKind.BLOCK_STRING,
			value: dedentBlockString(raw),
			start,
			end: cursor,
			line: startLine,
			column: startColumn,
		});
		index = cursor;
	};

	while (index < source.length) {
		const code = source.charCodeAt(index);

		if (code === CHAR.LF) {
			index += 1;
			line += 1;
			lineStart = index;
			continue;
		}
		if (
			code === CHAR.CR ||
			code === CHAR.TAB ||
			code === CHAR.SPACE ||
			code === CHAR.BOM
		) {
			index += 1;
			continue;
		}
		if (code === CHAR.HASH) {
			while (index < source.length && source.charCodeAt(index) !== CHAR.LF)
				index += 1;
			continue;
		}

		if (isNameStart(code)) {
			const start = index;
			index += 1;
			while (index < source.length && isNameContinue(source.charCodeAt(index)))
				index += 1;
			push(TokenKind.NAME, source.slice(start, index), start, index, start);
			continue;
		}

		if (
			isDigit(code) ||
			(code === CHAR.DASH && isDigit(source.charCodeAt(index + 1)))
		) {
			readNumber(index);
			continue;
		}

		if (code === CHAR.QUOTE) {
			if (source.startsWith('"""', index)) readBlockString(index);
			else readString(index);
			continue;
		}

		if (code === CHAR.DOT) {
			if (source.startsWith('...', index)) {
				push(TokenKind.SPREAD, '...', index, index + 3, index);
				index += 3;
			} else {
				push(TokenKind.DOT, '.', index, index + 1, index);
				index += 1;
			}
			continue;
		}

		if (
			code === CHAR.EQUALS ||
			code === CHAR.BANG ||
			code === CHAR.LT ||
			code === CHAR.GT
		) {
			const twoChar = source.charCodeAt(index + 1) === CHAR.EQUALS;
			const kind =
				code === CHAR.EQUALS
					? twoChar
						? TokenKind.EQUALS_EQUALS
						: TokenKind.EQUALS
					: code === CHAR.BANG
						? twoChar
							? TokenKind.BANG_EQUALS
							: TokenKind.BANG
						: code === CHAR.LT
							? twoChar
								? TokenKind.LT_EQUALS
								: TokenKind.LT
							: twoChar
								? TokenKind.GT_EQUALS
								: TokenKind.GT;
			const width = twoChar ? 2 : 1;
			push(
				kind,
				source.slice(index, index + width),
				index,
				index + width,
				index
			);
			index += width;
			continue;
		}

		const single = SINGLE_CHAR_TOKENS.get(code);
		if (single !== undefined) {
			push(single, source[index] ?? '', index, index + 1, index);
			index += 1;
			continue;
		}

		fail(`Unexpected character: ${JSON.stringify(source[index])}`, index);
	}

	push(TokenKind.EOF, '', index, index, index);
	return tokens;
};
