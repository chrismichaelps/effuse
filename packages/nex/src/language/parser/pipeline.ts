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

export const parsePipelineStage = (cursor: ParserCursor): PipelineStageNode => {
	const startToken = cursor.expect(TokenKind.PIPE);
	const nameToken = cursor.peek();
	if (nameToken.kind !== TokenKind.NAME) {
		cursor.fail(
			`Expected a pipeline stage, found ${cursor.describe(nameToken)}`,
			nameToken
		);
	}

	switch (nameToken.value) {
		case KEYWORD.FILTER:
			cursor.advance();
			return {
				kind: Kind.FILTER_STAGE,
				condition: parseExpression(cursor),
				loc: cursor.locate(startToken),
			};
		case KEYWORD.SORT: {
			cursor.advance();
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
			return {
				kind: Kind.TAKE_STAGE,
				count: parseValue(cursor),
				loc: cursor.locate(startToken),
			};
		case KEYWORD.SKIP:
			cursor.advance();
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
