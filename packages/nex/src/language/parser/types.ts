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

import type { NamedTypeNode, TypeNode } from '../ast/index.js';
import { Kind } from '../kinds/index.js';
import { TokenKind } from '../token/index.js';
import type { ParserCursor } from './context.js';
import { parseName } from './values.js';

export const parseNamedType = (cursor: ParserCursor): NamedTypeNode => {
	const startToken = cursor.peek();
	return {
		kind: Kind.NAMED_TYPE,
		name: parseName(cursor),
		loc: cursor.locate(startToken),
	};
};

export const parseType = (cursor: ParserCursor): TypeNode =>
	cursor.nested(() => parseTypeBody(cursor));

const parseTypeBody = (cursor: ParserCursor): TypeNode => {
	const startToken = cursor.peek();
	let type: TypeNode;

	if (cursor.at(TokenKind.BRACKET_L)) {
		cursor.advance();
		const inner = parseType(cursor);
		cursor.expect(TokenKind.BRACKET_R);
		type = {
			kind: Kind.LIST_TYPE,
			type: inner,
			loc: cursor.locate(startToken),
		};
	} else {
		type = parseNamedType(cursor);
	}

	for (;;) {
		if (cursor.at(TokenKind.BANG)) {
			cursor.advance();
			type = { kind: Kind.NON_NULL_TYPE, type, loc: cursor.locate(startToken) };
			continue;
		}
		if (cursor.at(TokenKind.QUESTION)) {
			cursor.advance();
			type = { kind: Kind.OPTIONAL_TYPE, type, loc: cursor.locate(startToken) };
			continue;
		}
		if (cursor.at(TokenKind.BRACKET_L) && cursor.at(TokenKind.BRACKET_R, 1)) {
			cursor.advance();
			cursor.advance();
			type = { kind: Kind.LIST_TYPE, type, loc: cursor.locate(startToken) };
			continue;
		}
		return type;
	}
};
