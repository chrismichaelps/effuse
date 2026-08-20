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
	FieldNode,
	FragmentDefinitionNode,
	NameNode,
	OperationDefinitionNode,
	SelectionNode,
	SelectionSetNode,
	ValueNode,
	VariableDefinitionNode,
} from '../ast/index.js';
import { Kind, OperationType } from '../kinds/index.js';
import { TokenKind } from '../token/index.js';
import type { ParserCursor } from './context.js';
import { KEYWORD } from './keywords.js';
import { OPERATION_KEYWORDS } from './operators.js';
import { parsePipeline } from './pipeline.js';
import { parseNamedType, parseType } from './types.js';
import {
	parseDirectives,
	parseName,
	parseValue,
	parseVariable,
	parseArguments,
} from './values.js';

export const parseField = (cursor: ParserCursor): FieldNode => {
	const startToken = cursor.peek();
	let name = parseName(cursor);
	let alias: NameNode | undefined;

	if (cursor.at(TokenKind.COLON)) {
		cursor.advance();
		alias = name;
		name = parseName(cursor);
	}

	const args = cursor.at(TokenKind.PAREN_L)
		? parseArguments(cursor)
		: undefined;
	const directives = parseDirectives(cursor);
	const pipeline = parsePipeline(cursor);
	const selectionSet = cursor.at(TokenKind.BRACE_L)
		? parseSelectionSet(cursor)
		: undefined;

	return {
		kind: Kind.FIELD,
		...(alias === undefined ? {} : { alias }),
		name,
		...(args === undefined ? {} : { arguments: args }),
		...(directives === undefined ? {} : { directives }),
		...(pipeline === undefined ? {} : { pipeline }),
		...(selectionSet === undefined ? {} : { selectionSet }),
		loc: cursor.locate(startToken),
	};
};

export const parseSelection = (cursor: ParserCursor): SelectionNode => {
	if (!cursor.at(TokenKind.SPREAD)) return parseField(cursor);

	const startToken = cursor.advance();
	if (cursor.atKeyword(KEYWORD.ON)) {
		cursor.advance();
		const typeCondition = parseNamedType(cursor);
		const directives = parseDirectives(cursor);
		return {
			kind: Kind.INLINE_FRAGMENT,
			typeCondition,
			...(directives === undefined ? {} : { directives }),
			selectionSet: parseSelectionSet(cursor),
			loc: cursor.locate(startToken),
		};
	}

	if (cursor.at(TokenKind.NAME)) {
		const name = parseName(cursor);
		const directives = parseDirectives(cursor);
		return {
			kind: Kind.FRAGMENT_SPREAD,
			name,
			...(directives === undefined ? {} : { directives }),
			loc: cursor.locate(startToken),
		};
	}

	const directives = parseDirectives(cursor);
	return {
		kind: Kind.INLINE_FRAGMENT,
		...(directives === undefined ? {} : { directives }),
		selectionSet: parseSelectionSet(cursor),
		loc: cursor.locate(startToken),
	};
};

export const parseSelectionSet = (cursor: ParserCursor): SelectionSetNode =>
	cursor.nested(() => parseSelectionSetBody(cursor));

const parseSelectionSetBody = (cursor: ParserCursor): SelectionSetNode => {
	const startToken = cursor.expect(TokenKind.BRACE_L);
	const selections: SelectionNode[] = [];

	while (!cursor.at(TokenKind.BRACE_R)) {
		if (cursor.at(TokenKind.EOF)) cursor.fail('Expected "}", found <EOF>');
		selections.push(parseSelection(cursor));
		if (cursor.at(TokenKind.COMMA)) cursor.advance();
	}

	if (selections.length === 0) {
		cursor.fail(
			'Expected at least one selection inside a selection set',
			startToken
		);
	}
	cursor.advance();

	return {
		kind: Kind.SELECTION_SET,
		selections,
		loc: cursor.locate(startToken),
	};
};

export const parseVariableDefinitions = (
	cursor: ParserCursor
): readonly VariableDefinitionNode[] => {
	cursor.expect(TokenKind.PAREN_L);
	const definitions: VariableDefinitionNode[] = [];

	while (!cursor.at(TokenKind.PAREN_R)) {
		if (cursor.at(TokenKind.EOF))
			cursor.fail('Unterminated variable definition list');
		const startToken = cursor.peek();
		const variable = parseVariable(cursor);
		cursor.expect(TokenKind.COLON);
		const type = parseType(cursor);
		let defaultValue: ValueNode | undefined;
		if (cursor.at(TokenKind.EQUALS)) {
			cursor.advance();
			defaultValue = parseValue(cursor);
		}
		const directives = parseDirectives(cursor);
		definitions.push({
			kind: Kind.VARIABLE_DEFINITION,
			variable,
			type,
			...(defaultValue === undefined ? {} : { defaultValue }),
			...(directives === undefined ? {} : { directives }),
			loc: cursor.locate(startToken),
		});
		if (cursor.at(TokenKind.COMMA)) cursor.advance();
	}
	cursor.advance();

	return definitions;
};

export const parseOperationDefinition = (
	cursor: ParserCursor
): OperationDefinitionNode => {
	const startToken = cursor.peek();

	if (cursor.at(TokenKind.BRACE_L)) {
		return {
			kind: Kind.OPERATION_DEFINITION,
			operation: OperationType.QUERY,
			selectionSet: parseSelectionSet(cursor),
			loc: cursor.locate(startToken),
		};
	}

	const operation = OPERATION_KEYWORDS.get(startToken.value);
	if (operation === undefined) {
		return cursor.fail(
			`Expected an operation type, found ${cursor.describe(startToken)}`,
			startToken
		);
	}
	cursor.advance();

	const name = cursor.at(TokenKind.NAME) ? parseName(cursor) : undefined;
	const variableDefinitions = cursor.at(TokenKind.PAREN_L)
		? parseVariableDefinitions(cursor)
		: undefined;
	const directives = parseDirectives(cursor);

	return {
		kind: Kind.OPERATION_DEFINITION,
		operation,
		...(name === undefined ? {} : { name }),
		...(variableDefinitions === undefined ? {} : { variableDefinitions }),
		...(directives === undefined ? {} : { directives }),
		selectionSet: parseSelectionSet(cursor),
		loc: cursor.locate(startToken),
	};
};

export const parseFragmentDefinition = (
	cursor: ParserCursor
): FragmentDefinitionNode => {
	const startToken = cursor.expectKeyword(KEYWORD.FRAGMENT);
	const name = parseName(cursor);
	cursor.expectKeyword(KEYWORD.ON);
	const typeCondition = parseNamedType(cursor);
	const directives = parseDirectives(cursor);

	return {
		kind: Kind.FRAGMENT_DEFINITION,
		name,
		typeCondition,
		...(directives === undefined ? {} : { directives }),
		selectionSet: parseSelectionSet(cursor),
		loc: cursor.locate(startToken),
	};
};
