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
	BinaryOperator,
	ExpressionNode,
	FieldPathNode,
	NameNode,
} from '../ast/index.js';
import { Kind } from '../kinds/index.js';
import { TokenKind } from '../token/index.js';
import type { ParserCursor } from './context.js';
import { KEYWORD } from './keywords.js';
import { COMPARISON_OPERATORS } from './operators.js';
import { parseName, parseValue } from './values.js';

export const parseFieldPath = (cursor: ParserCursor): FieldPathNode => {
	const startToken = cursor.peek();
	const segments: NameNode[] = [parseName(cursor)];
	while (cursor.at(TokenKind.DOT)) {
		cursor.advance();
		segments.push(parseName(cursor));
	}
	return { kind: Kind.FIELD_PATH, segments, loc: cursor.locate(startToken) };
};

export const parseOperand = (
	cursor: ParserCursor,
	preferValue: boolean
): ExpressionNode => {
	if (cursor.at(TokenKind.PAREN_L)) {
		cursor.advance();
		const expression = parseExpression(cursor);
		cursor.expect(TokenKind.PAREN_R);
		return expression;
	}

	const token = cursor.peek();
	if (token.kind === TokenKind.NAME) {
		const isKeywordLiteral =
			token.value === KEYWORD.TRUE ||
			token.value === KEYWORD.FALSE ||
			token.value === KEYWORD.NULL;
		if (!isKeywordLiteral && (!preferValue || cursor.at(TokenKind.DOT, 1))) {
			return parseFieldPath(cursor);
		}
	}

	return parseValue(cursor);
};

export const parseComparison = (cursor: ParserCursor): ExpressionNode => {
	const startToken = cursor.peek();
	const left = parseOperand(cursor, false);
	const operator = COMPARISON_OPERATORS.get(cursor.peek().kind);
	if (operator === undefined) return left;

	cursor.advance();
	return {
		kind: Kind.BINARY_EXPRESSION,
		operator,
		left,
		right: parseOperand(cursor, true),
		loc: cursor.locate(startToken),
	};
};

export const parseUnary = (cursor: ParserCursor): ExpressionNode => {
	if (!cursor.atKeyword(KEYWORD.NOT)) return parseComparison(cursor);

	const startToken = cursor.advance();
	return {
		kind: Kind.UNARY_EXPRESSION,
		operator: 'not',
		expression: parseUnary(cursor),
		loc: cursor.locate(startToken),
	};
};

export const parseBinary = (
	cursor: ParserCursor,
	keyword: BinaryOperator,
	parseNext: () => ExpressionNode
): ExpressionNode => {
	const startToken = cursor.peek();
	let left = parseNext();
	while (cursor.atKeyword(keyword)) {
		cursor.advance();
		left = {
			kind: Kind.BINARY_EXPRESSION,
			operator: keyword,
			left,
			right: parseNext(),
			loc: cursor.locate(startToken),
		};
	}
	return left;
};

export const parseExpression = (cursor: ParserCursor): ExpressionNode =>
	parseBinary(cursor, 'or', () =>
		parseBinary(cursor, 'and', () => parseUnary(cursor))
	);
