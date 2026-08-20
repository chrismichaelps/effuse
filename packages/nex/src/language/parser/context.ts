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
import type { Location } from '../ast/index.js';
import { tokenize } from '../lexer/index.js';
import { printSourceExcerpt } from '../source-excerpt.js';
import { TokenKind, type Token } from '../token/index.js';

/** The token cursor every parse function reads from. */
export interface ParserCursor {
	/** The token `offset` positions ahead, clamped at EOF. */
	readonly peek: (offset?: number) => Token;
	/** Whether the token at `offset` has `kind`. */
	readonly at: (kind: TokenKind, offset?: number) => boolean;
	/** Whether the token at `offset` is the name `keyword`. */
	readonly atKeyword: (keyword: string, offset?: number) => boolean;
	/** Consume and return the current token. */
	readonly advance: () => Token;
	/** Consume the current token, failing unless it has `kind`. */
	readonly expect: (kind: TokenKind) => Token;
	/** Consume the current token, failing unless it is the name `keyword`. */
	readonly expectKeyword: (keyword: string) => Token;
	/** Consume the current token when it is the name `keyword`. */
	readonly expectOptionalKeyword: (keyword: string) => boolean;
	/** Abort the parse with a located syntax error. */
	readonly fail: (message: string, token?: Token) => never;
	/** Describe a token for an error message. */
	readonly describe: (token: Token) => string;
	/** The span from `startToken` through the last consumed token. */
	readonly locate: (startToken: Token) => Location;
	/** Run `body` one level deeper, failing if the document nests too far. */
	readonly nested: <T>(body: () => T) => T;
}

/**
 * What one document may contain before it is refused.
 *
 * A parser walks its input recursively, so a document nested past what the
 * stack will hold has to be refused rather than crash the process; the token
 * cap keeps a merely enormous document from being read at all.
 */
export const PARSER_LIMITS = {
	MAX_TOKENS: 100_000,
	MAX_DEPTH: 256,
} as const;

/** Scan `source` and hand back a cursor over its tokens. */
export const createCursor = (source: string): ParserCursor => {
	const tokens = tokenize(source);
	let index = 0;
	let depth = 0;

	if (tokens.length > PARSER_LIMITS.MAX_TOKENS) {
		throw new NexSyntaxError({
			message: `This document has too many tokens: ${String(tokens.length)}, where at most ${String(PARSER_LIMITS.MAX_TOKENS)} are read`,
			location: { start: 0, line: 1, column: 1 },
		});
	}

	const peek = (offset = 0): Token => {
		const token = tokens[Math.min(index + offset, tokens.length - 1)];
		if (token === undefined) {
			throw new NexSyntaxError({
				message: 'Unexpected end of token stream',
				location: { start: source.length, line: 1, column: 1 },
			});
		}
		return token;
	};

	const fail = (message: string, token: Token = peek()): never => {
		const location = {
			start: token.start,
			line: token.line,
			column: token.column,
		};
		throw new NexSyntaxError({
			message,
			location,
			excerpt: printSourceExcerpt(source, location),
		});
	};

	const describe = (token: Token): string =>
		token.kind === TokenKind.NAME ||
		token.kind === TokenKind.INT ||
		token.kind === TokenKind.FLOAT
			? `"${token.value}"`
			: token.kind === TokenKind.EOF
				? '<EOF>'
				: `"${token.kind}"`;

	const advance = (): Token => {
		const token = peek();
		if (token.kind !== TokenKind.EOF) index += 1;
		return token;
	};

	const at = (kind: TokenKind, offset = 0): boolean =>
		peek(offset).kind === kind;

	const atKeyword = (keyword: string, offset = 0): boolean =>
		peek(offset).kind === TokenKind.NAME && peek(offset).value === keyword;

	const expect = (kind: TokenKind): Token => {
		const token = peek();
		if (token.kind !== kind) {
			fail(`Expected "${kind}", found ${describe(token)}`, token);
		}
		return advance();
	};

	const expectKeyword = (keyword: string): Token => {
		if (!atKeyword(keyword)) {
			fail(`Expected "${keyword}", found ${describe(peek())}`);
		}
		return advance();
	};

	const locate = (startToken: Token): Location => ({
		start: startToken.start,
		end: tokens[Math.max(index - 1, 0)]?.end ?? startToken.end,
		line: startToken.line,
		column: startToken.column,
	});

	const expectOptionalKeyword = (keyword: string): boolean => {
		if (!atKeyword(keyword)) return false;
		advance();
		return true;
	};

	const nested = <T>(body: () => T): T => {
		depth += 1;
		if (depth > PARSER_LIMITS.MAX_DEPTH) {
			depth -= 1;
			fail(
				`This document is nested too deeply: at most ${String(PARSER_LIMITS.MAX_DEPTH)} levels are read`
			);
		}
		try {
			return body();
		} finally {
			depth -= 1;
		}
	};

	return {
		peek,
		at,
		atKeyword,
		advance,
		expect,
		expectKeyword,
		expectOptionalKeyword,
		fail,
		describe,
		locate,
		nested,
	};
};
