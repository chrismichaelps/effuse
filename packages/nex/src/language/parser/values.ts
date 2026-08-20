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

import type {
	ArgumentNode,
	DirectiveNode,
	NameNode,
	ObjectFieldNode,
	StringValueNode,
	ValueNode,
	VariableNode,
} from '../ast/index.js';
import { Kind } from '../kinds/index.js';
import { TokenKind } from '../token/index.js';
import type { ParserCursor } from './context.js';
import { KEYWORD } from './keywords.js';

export const parseName = (cursor: ParserCursor): NameNode => {
	const token = cursor.expect(TokenKind.NAME);
	return { kind: Kind.NAME, value: token.value, loc: cursor.locate(token) };
};

export const parseVariable = (cursor: ParserCursor): VariableNode => {
	const startToken = cursor.expect(TokenKind.DOLLAR);
	return {
		kind: Kind.VARIABLE,
		name: parseName(cursor),
		loc: cursor.locate(startToken),
	};
};

export const parseValue = (cursor: ParserCursor): ValueNode =>
	cursor.nested(() => parseValueBody(cursor));

const parseValueBody = (cursor: ParserCursor): ValueNode => {
	const token = cursor.peek();

	switch (token.kind) {
		case TokenKind.DOLLAR:
			return parseVariable(cursor);
		case TokenKind.INT:
			cursor.advance();
			return { kind: Kind.INT, value: token.value, loc: cursor.locate(token) };
		case TokenKind.FLOAT:
			cursor.advance();
			return {
				kind: Kind.FLOAT,
				value: token.value,
				loc: cursor.locate(token),
			};
		case TokenKind.STRING:
			cursor.advance();
			return {
				kind: Kind.STRING,
				value: token.value,
				loc: cursor.locate(token),
			};
		case TokenKind.BLOCK_STRING:
			cursor.advance();
			return {
				kind: Kind.STRING,
				value: token.value,
				block: true,
				loc: cursor.locate(token),
			};
		case TokenKind.BRACKET_L: {
			cursor.advance();
			const values: ValueNode[] = [];
			while (!cursor.at(TokenKind.BRACKET_R)) {
				if (cursor.at(TokenKind.EOF))
					cursor.fail('Unterminated list value', token);
				values.push(parseValue(cursor));
				if (cursor.at(TokenKind.COMMA)) cursor.advance();
			}
			cursor.advance();
			return { kind: Kind.LIST, values, loc: cursor.locate(token) };
		}
		case TokenKind.BRACE_L: {
			cursor.advance();
			const fields: ObjectFieldNode[] = [];
			while (!cursor.at(TokenKind.BRACE_R)) {
				if (cursor.at(TokenKind.EOF))
					cursor.fail('Unterminated object value', token);
				const fieldToken = cursor.peek();
				const name = parseName(cursor);
				cursor.expect(TokenKind.COLON);
				fields.push({
					kind: Kind.OBJECT_FIELD,
					name,
					value: parseValue(cursor),
					loc: cursor.locate(fieldToken),
				});
				if (cursor.at(TokenKind.COMMA)) cursor.advance();
			}
			cursor.advance();
			return { kind: Kind.OBJECT, fields, loc: cursor.locate(token) };
		}
		case TokenKind.NAME: {
			cursor.advance();
			if (token.value === KEYWORD.TRUE || token.value === KEYWORD.FALSE) {
				return {
					kind: Kind.BOOLEAN,
					value: token.value === KEYWORD.TRUE,
					loc: cursor.locate(token),
				};
			}
			if (token.value === KEYWORD.NULL) {
				return { kind: Kind.NULL, loc: cursor.locate(token) };
			}
			return { kind: Kind.ENUM, value: token.value, loc: cursor.locate(token) };
		}
		default:
			return cursor.fail(
				`Expected a value, found ${cursor.describe(token)}`,
				token
			);
	}
};

export const parseArguments = (
	cursor: ParserCursor
): readonly ArgumentNode[] => {
	cursor.expect(TokenKind.PAREN_L);
	const args: ArgumentNode[] = [];
	while (!cursor.at(TokenKind.PAREN_R)) {
		if (cursor.at(TokenKind.EOF)) cursor.fail('Unterminated argument list');
		args.push(parseArgument(cursor));
		if (cursor.at(TokenKind.COMMA)) cursor.advance();
	}
	cursor.advance();
	return args;
};

export const parseArgument = (cursor: ParserCursor): ArgumentNode => {
	const startToken = cursor.peek();
	const name = parseName(cursor);
	cursor.expect(TokenKind.COLON);
	return {
		kind: Kind.ARGUMENT,
		name,
		value: parseValue(cursor),
		loc: cursor.locate(startToken),
	};
};

export const parseBareArguments = (
	cursor: ParserCursor
): readonly ArgumentNode[] => {
	const args: ArgumentNode[] = [];
	while (cursor.at(TokenKind.NAME) && cursor.at(TokenKind.COLON, 1)) {
		args.push(parseArgument(cursor));
		if (cursor.at(TokenKind.COMMA)) cursor.advance();
	}
	return args;
};

export const parseDirectives = (
	cursor: ParserCursor
): readonly DirectiveNode[] | undefined => {
	const directives: DirectiveNode[] = [];
	while (cursor.at(TokenKind.AT)) {
		const startToken = cursor.advance();
		const name = parseName(cursor);
		const args = cursor.at(TokenKind.PAREN_L)
			? parseArguments(cursor)
			: undefined;
		directives.push({
			kind: Kind.DIRECTIVE,
			name,
			...(args === undefined ? {} : { arguments: args }),
			loc: cursor.locate(startToken),
		});
	}
	return directives.length > 0 ? directives : undefined;
};

/**
 * A description is a string literal in front of a definition. Block strings
 * are the conventional spelling, but a single-quoted string reads fine too.
 */
export const parseDescription = (
	cursor: ParserCursor
): StringValueNode | undefined => {
	if (!cursor.at(TokenKind.STRING) && !cursor.at(TokenKind.BLOCK_STRING)) {
		return undefined;
	}

	const value = parseValue(cursor);
	return value.kind === Kind.STRING ? value : undefined;
};
