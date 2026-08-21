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

import type { PipelineStageNode, SortDirection } from '../ast/index.js';
import { Kind } from '../kinds/index.js';
import { TokenKind } from '../token/index.js';
import type { ParserCursor } from './context.js';
import { parseExpression, parseFieldPath } from './expressions.js';
import { KEYWORD } from './keywords.js';
import {
	parseArguments,
	parseBareArguments,
	parseName,
	parseValue,
} from './values.js';

/** What someone writes when they mean to pass a stage something. */
const ARGUMENT_LIKE: ReadonlySet<TokenKind> = new Set([
	TokenKind.NAME,
	TokenKind.INT,
	TokenKind.FLOAT,
	TokenKind.STRING,
]);

export const parsePipelineStage = (cursor: ParserCursor): PipelineStageNode => {
	const startToken = cursor.expect(TokenKind.PIPE);
	const nameToken = cursor.peek();
	if (nameToken.kind !== TokenKind.NAME) {
		cursor.fail(
			`Expected a pipeline stage, found ${cursor.describe(nameToken)}`,
			nameToken
		);
	}

	/**
	 * Say what a stage needed, rather than what the next token was not.
	 *
	 * A stage missing its argument runs into whatever follows - usually the
	 * selection set - and the parser's own account of that names the bracket
	 * rather than the stage, which is the thing that was actually wrong.
	 */
	const needs = (what: string): never => {
		const found = cursor.peek();
		return cursor.fail(
			`"| ${String(nameToken.value)}" ${what}, found ${cursor.describe(found)}`,
			found
		);
	};

	const wanting = (kind: TokenKind, what: string): void => {
		if (!cursor.at(kind)) needs(what);
	};

	switch (nameToken.value) {
		case KEYWORD.FILTER:
			cursor.advance();
			if (cursor.at(TokenKind.BRACE_L)) needs('needs something to test');
			return {
				kind: Kind.FILTER_STAGE,
				condition: parseExpression(cursor),
				loc: cursor.locate(startToken),
			};
		case KEYWORD.SORT: {
			cursor.advance();
			wanting(TokenKind.NAME, 'needs a field to sort by');
			const field = parseFieldPath(cursor);
			const direction: SortDirection = cursor.atKeyword(KEYWORD.DESC)
				? 'desc'
				: 'asc';
			if (cursor.atKeyword(KEYWORD.DESC) || cursor.atKeyword(KEYWORD.ASC))
				cursor.advance();
			return {
				kind: Kind.SORT_STAGE,
				field,
				direction,
				loc: cursor.locate(startToken),
			};
		}
		case KEYWORD.TAKE:
			cursor.advance();
			if (cursor.at(TokenKind.BRACE_L)) needs('needs a count');
			return {
				kind: Kind.TAKE_STAGE,
				count: parseValue(cursor),
				loc: cursor.locate(startToken),
			};
		case KEYWORD.SKIP:
			cursor.advance();
			if (cursor.at(TokenKind.BRACE_L)) needs('needs a count');
			return {
				kind: Kind.SKIP_STAGE,
				count: parseValue(cursor),
				loc: cursor.locate(startToken),
			};
		case KEYWORD.PAGE:
			cursor.advance();
			return {
				kind: Kind.PAGE_STAGE,
				arguments: parseBareArguments(cursor),
				loc: cursor.locate(startToken),
			};
		case KEYWORD.UNIQUE:
			cursor.advance();

			// A stage may be followed by the next one, by a selection set, or
			// by the end of the field - a list of scalars has no selection.
			// What it may not be followed by is something written as an
			// argument, which it does not take and which would otherwise be
			// left to derail the rest of the parse.
			if (ARGUMENT_LIKE.has(cursor.peek().kind)) needs('takes nothing');

			return { kind: Kind.UNIQUE_STAGE, loc: cursor.locate(startToken) };
		default: {
			const name = parseName(cursor);
			const args = cursor.at(TokenKind.PAREN_L)
				? parseArguments(cursor)
				: parseBareArguments(cursor);
			return {
				kind: Kind.CUSTOM_STAGE,
				name,
				arguments: args,
				loc: cursor.locate(startToken),
			};
		}
	}
};

export const parsePipeline = (
	cursor: ParserCursor
): readonly PipelineStageNode[] | undefined => {
	const stages: PipelineStageNode[] = [];
	while (cursor.at(TokenKind.PIPE)) stages.push(parsePipelineStage(cursor));
	return stages.length > 0 ? stages : undefined;
};
