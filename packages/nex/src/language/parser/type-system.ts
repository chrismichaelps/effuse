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
	DirectiveDefinitionNode,
	EnumTypeDefinitionNode,
	EnumValueDefinitionNode,
	FieldDefinitionNode,
	InputObjectTypeDefinitionNode,
	InputValueDefinitionNode,
	InterfaceTypeDefinitionNode,
	NameNode,
	NamedTypeNode,
	ObjectTypeDefinitionNode,
	OperationTypeDefinitionNode,
	ScalarTypeDefinitionNode,
	StringValueNode,
	SchemaDefinitionNode,
	SchemaExtensionNode,
	TypeSystemExtensionNode,
	TypeSystemDefinitionNode,
	UnionTypeDefinitionNode,
} from '../ast/index.js';
import { Kind } from '../kinds/index.js';
import { TokenKind, type Token } from '../token/index.js';
import type { ParserCursor } from './context.js';
import { KEYWORD } from './keywords.js';
import { OPERATION_KEYWORDS, TYPE_SYSTEM_KEYWORDS } from './operators.js';
import { parseNamedType, parseType } from './types.js';
import {
	parseDescription,
	parseDirectives,
	parseName,
	parseValue,
} from './values.js';

/** Whether the cursor sits on a definition or extension describing the catalog. */
export const atTypeSystemDefinition = (cursor: ParserCursor): boolean => {
	const offset =
		cursor.at(TokenKind.STRING) || cursor.at(TokenKind.BLOCK_STRING) ? 1 : 0;
	const token = cursor.peek(offset);
	if (token.kind !== TokenKind.NAME) return false;

	return (
		TYPE_SYSTEM_KEYWORDS.has(token.value) ||
		(token.value === KEYWORD.EXTEND && offset === 0)
	);
};

/** Parse `open item+ close`, requiring at least one item. */
const many = <T>(
	cursor: ParserCursor,
	open: TokenKind,
	parseItem: (cursor: ParserCursor) => T,
	close: TokenKind,
	subject: string
): readonly T[] => {
	cursor.expect(open);
	const items: T[] = [];

	while (!cursor.at(close)) {
		if (cursor.at(TokenKind.EOF))
			cursor.fail(`Expected "${close}", found <EOF>`);
		items.push(parseItem(cursor));
		if (cursor.at(TokenKind.COMMA)) cursor.advance();
	}

	if (items.length === 0) cursor.fail(`Expected at least one ${subject}`);
	cursor.advance();

	return items;
};

/** Parse `open item+ close` when the block is present at all. */
const optionalMany = <T>(
	cursor: ParserCursor,
	open: TokenKind,
	parseItem: (cursor: ParserCursor) => T,
	close: TokenKind,
	subject: string
): readonly T[] | undefined =>
	cursor.at(open) ? many(cursor, open, parseItem, close, subject) : undefined;

/** Parse `first delimiter item*`, allowing a leading delimiter. */
const delimitedMany = <T>(
	cursor: ParserCursor,
	delimiter: TokenKind,
	parseItem: (cursor: ParserCursor) => T
): readonly T[] => {
	const items: T[] = [];
	if (cursor.at(delimiter)) cursor.advance();

	do {
		items.push(parseItem(cursor));
	} while (cursor.at(delimiter) && (cursor.advance(), true));

	return items;
};

const parseOperationTypeDefinition = (
	cursor: ParserCursor
): OperationTypeDefinitionNode => {
	const startToken = cursor.peek();
	const operation = OPERATION_KEYWORDS.get(startToken.value);
	if (operation === undefined) {
		return cursor.fail(
			`Expected a root operation type, found ${cursor.describe(startToken)}`,
			startToken
		);
	}
	cursor.advance();
	cursor.expect(TokenKind.COLON);

	return {
		kind: Kind.OPERATION_TYPE_DEFINITION,
		operation,
		type: parseNamedType(cursor),
		loc: cursor.locate(startToken),
	};
};

const parseInputValueDefinition = (
	cursor: ParserCursor
): InputValueDefinitionNode => {
	const startToken = cursor.peek();
	const description = parseDescription(cursor);
	const name = parseName(cursor);
	cursor.expect(TokenKind.COLON);
	const type = parseType(cursor);
	const defaultValue = cursor.at(TokenKind.EQUALS)
		? (cursor.advance(), parseValue(cursor))
		: undefined;
	const directives = parseDirectives(cursor);

	return {
		kind: Kind.INPUT_VALUE_DEFINITION,
		...(description === undefined ? {} : { description }),
		name,
		type,
		...(defaultValue === undefined ? {} : { defaultValue }),
		...(directives === undefined ? {} : { directives }),
		loc: cursor.locate(startToken),
	};
};

const parseArgumentDefinitions = (
	cursor: ParserCursor
): readonly InputValueDefinitionNode[] | undefined =>
	optionalMany(
		cursor,
		TokenKind.PAREN_L,
		parseInputValueDefinition,
		TokenKind.PAREN_R,
		'argument definition'
	);

const parseFieldDefinition = (cursor: ParserCursor): FieldDefinitionNode => {
	const startToken = cursor.peek();
	const description = parseDescription(cursor);
	const name = parseName(cursor);
	const args = parseArgumentDefinitions(cursor);
	cursor.expect(TokenKind.COLON);
	const type = parseType(cursor);
	const defaultValue = cursor.at(TokenKind.EQUALS)
		? (cursor.advance(), parseValue(cursor))
		: undefined;
	const directives = parseDirectives(cursor);

	return {
		kind: Kind.FIELD_DEFINITION,
		...(description === undefined ? {} : { description }),
		name,
		...(args === undefined ? {} : { arguments: args }),
		type,
		...(defaultValue === undefined ? {} : { defaultValue }),
		...(directives === undefined ? {} : { directives }),
		loc: cursor.locate(startToken),
	};
};

const parseFieldsDefinition = (
	cursor: ParserCursor
): readonly FieldDefinitionNode[] | undefined =>
	optionalMany(
		cursor,
		TokenKind.BRACE_L,
		parseFieldDefinition,
		TokenKind.BRACE_R,
		'field definition'
	);

const parseImplementsInterfaces = (
	cursor: ParserCursor
): readonly NamedTypeNode[] | undefined =>
	cursor.expectOptionalKeyword(KEYWORD.IMPLEMENTS)
		? delimitedMany(cursor, TokenKind.AMP, parseNamedType)
		: undefined;

const parseEnumValueDefinition = (
	cursor: ParserCursor
): EnumValueDefinitionNode => {
	const startToken = cursor.peek();
	const description = parseDescription(cursor);
	const name = parseName(cursor);
	const directives = parseDirectives(cursor);

	return {
		kind: Kind.ENUM_VALUE_DEFINITION,
		...(description === undefined ? {} : { description }),
		name,
		...(directives === undefined ? {} : { directives }),
		loc: cursor.locate(startToken),
	};
};

const parseSchemaDefinition = (
	cursor: ParserCursor,
	startToken: Token,
	description: StringValueNode | undefined
): SchemaDefinitionNode => {
	cursor.expectKeyword(KEYWORD.SCHEMA);
	const directives = parseDirectives(cursor);

	return {
		kind: Kind.SCHEMA_DEFINITION,
		...(description === undefined ? {} : { description }),
		...(directives === undefined ? {} : { directives }),
		operationTypes: many(
			cursor,
			TokenKind.BRACE_L,
			parseOperationTypeDefinition,
			TokenKind.BRACE_R,
			'root operation type'
		),
		loc: cursor.locate(startToken),
	};
};

const parseScalarTypeDefinition = (
	cursor: ParserCursor,
	startToken: Token,
	description: StringValueNode | undefined
): ScalarTypeDefinitionNode => {
	cursor.expectKeyword(KEYWORD.SCALAR);
	const name = parseName(cursor);
	const directives = parseDirectives(cursor);

	return {
		kind: Kind.SCALAR_TYPE_DEFINITION,
		...(description === undefined ? {} : { description }),
		name,
		...(directives === undefined ? {} : { directives }),
		loc: cursor.locate(startToken),
	};
};

const parseObjectTypeDefinition = (
	cursor: ParserCursor,
	startToken: Token,
	description: StringValueNode | undefined
): ObjectTypeDefinitionNode => {
	cursor.expectKeyword(KEYWORD.TYPE);
	const name = parseName(cursor);
	const interfaces = parseImplementsInterfaces(cursor);
	const directives = parseDirectives(cursor);
	const fields = parseFieldsDefinition(cursor);

	return {
		kind: Kind.OBJECT_TYPE_DEFINITION,
		...(description === undefined ? {} : { description }),
		name,
		...(interfaces === undefined ? {} : { interfaces }),
		...(directives === undefined ? {} : { directives }),
		...(fields === undefined ? {} : { fields }),
		loc: cursor.locate(startToken),
	};
};

const parseInterfaceTypeDefinition = (
	cursor: ParserCursor,
	startToken: Token,
	description: StringValueNode | undefined
): InterfaceTypeDefinitionNode => {
	cursor.expectKeyword(KEYWORD.INTERFACE);
	const name = parseName(cursor);
	const interfaces = parseImplementsInterfaces(cursor);
	const directives = parseDirectives(cursor);
	const fields = parseFieldsDefinition(cursor);

	return {
		kind: Kind.INTERFACE_TYPE_DEFINITION,
		...(description === undefined ? {} : { description }),
		name,
		...(interfaces === undefined ? {} : { interfaces }),
		...(directives === undefined ? {} : { directives }),
		...(fields === undefined ? {} : { fields }),
		loc: cursor.locate(startToken),
	};
};

const parseUnionTypeDefinition = (
	cursor: ParserCursor,
	startToken: Token,
	description: StringValueNode | undefined
): UnionTypeDefinitionNode => {
	cursor.expectKeyword(KEYWORD.UNION);
	const name = parseName(cursor);
	const directives = parseDirectives(cursor);
	const types = cursor.at(TokenKind.EQUALS)
		? (cursor.advance(), delimitedMany(cursor, TokenKind.PIPE, parseNamedType))
		: undefined;

	return {
		kind: Kind.UNION_TYPE_DEFINITION,
		...(description === undefined ? {} : { description }),
		name,
		...(directives === undefined ? {} : { directives }),
		...(types === undefined ? {} : { types }),
		loc: cursor.locate(startToken),
	};
};

const parseEnumTypeDefinition = (
	cursor: ParserCursor,
	startToken: Token,
	description: StringValueNode | undefined
): EnumTypeDefinitionNode => {
	cursor.expectKeyword(KEYWORD.ENUM);
	const name = parseName(cursor);
	const directives = parseDirectives(cursor);
	const values = optionalMany(
		cursor,
		TokenKind.BRACE_L,
		parseEnumValueDefinition,
		TokenKind.BRACE_R,
		'enum value'
	);

	return {
		kind: Kind.ENUM_TYPE_DEFINITION,
		...(description === undefined ? {} : { description }),
		name,
		...(directives === undefined ? {} : { directives }),
		...(values === undefined ? {} : { values }),
		loc: cursor.locate(startToken),
	};
};

const parseInputObjectTypeDefinition = (
	cursor: ParserCursor,
	startToken: Token,
	description: StringValueNode | undefined
): InputObjectTypeDefinitionNode => {
	cursor.expectKeyword(KEYWORD.INPUT);
	const name = parseName(cursor);
	const directives = parseDirectives(cursor);
	const fields = optionalMany(
		cursor,
		TokenKind.BRACE_L,
		parseInputValueDefinition,
		TokenKind.BRACE_R,
		'input field'
	);

	return {
		kind: Kind.INPUT_OBJECT_TYPE_DEFINITION,
		...(description === undefined ? {} : { description }),
		name,
		...(directives === undefined ? {} : { directives }),
		...(fields === undefined ? {} : { fields }),
		loc: cursor.locate(startToken),
	};
};

const parseDirectiveDefinition = (
	cursor: ParserCursor,
	startToken: Token,
	description: StringValueNode | undefined
): DirectiveDefinitionNode => {
	cursor.expectKeyword(KEYWORD.DIRECTIVE);
	cursor.expect(TokenKind.AT);
	const name = parseName(cursor);
	const args = parseArgumentDefinitions(cursor);
	const repeatable = cursor.expectOptionalKeyword(KEYWORD.REPEATABLE);
	cursor.expectKeyword(KEYWORD.ON);
	const locations = delimitedMany(
		cursor,
		TokenKind.PIPE,
		parseDirectiveLocation
	);

	return {
		kind: Kind.DIRECTIVE_DEFINITION,
		...(description === undefined ? {} : { description }),
		name,
		...(args === undefined ? {} : { arguments: args }),
		repeatable,
		locations,
		loc: cursor.locate(startToken),
	};
};

const parseDirectiveLocation = (cursor: ParserCursor): NameNode =>
	parseName(cursor);

const parseSchemaExtension = (
	cursor: ParserCursor,
	startToken: Token
): SchemaExtensionNode => {
	cursor.expectKeyword(KEYWORD.SCHEMA);
	const directives = parseDirectives(cursor);
	const operationTypes = optionalMany(
		cursor,
		TokenKind.BRACE_L,
		parseOperationTypeDefinition,
		TokenKind.BRACE_R,
		'root operation type'
	);

	if (directives === undefined && operationTypes === undefined) {
		cursor.fail('This schema extension adds nothing', startToken);
	}

	return {
		kind: Kind.SCHEMA_EXTENSION,
		...(directives === undefined ? {} : { directives }),
		...(operationTypes === undefined ? {} : { operationTypes }),
		loc: cursor.locate(startToken),
	};
};

/**
 * Parse `extend ...`.
 *
 * An extension has to add something; one that adds nothing is a typo, not a
 * statement, so it is rejected here rather than ignored later.
 */
export const parseTypeSystemExtension = (
	cursor: ParserCursor
): TypeSystemExtensionNode => {
	const startToken = cursor.expectKeyword(KEYWORD.EXTEND);
	const keyword = cursor.peek();

	const empty = (): never =>
		cursor.fail(`This ${keyword.value} extension adds nothing`, startToken);

	switch (keyword.value) {
		case KEYWORD.SCHEMA:
			return parseSchemaExtension(cursor, startToken);

		case KEYWORD.SCALAR: {
			cursor.advance();
			const name = parseName(cursor);
			const directives = parseDirectives(cursor);
			if (directives === undefined) empty();
			return {
				kind: Kind.SCALAR_TYPE_EXTENSION,
				name,
				directives: directives ?? [],
				loc: cursor.locate(startToken),
			};
		}

		case KEYWORD.TYPE:
		case KEYWORD.INTERFACE: {
			const isObject = keyword.value === KEYWORD.TYPE;
			cursor.advance();
			const name = parseName(cursor);
			const interfaces = parseImplementsInterfaces(cursor);
			const directives = parseDirectives(cursor);
			const fields = parseFieldsDefinition(cursor);
			if (
				interfaces === undefined &&
				directives === undefined &&
				fields === undefined
			) {
				empty();
			}
			return {
				kind: isObject
					? Kind.OBJECT_TYPE_EXTENSION
					: Kind.INTERFACE_TYPE_EXTENSION,
				name,
				...(interfaces === undefined ? {} : { interfaces }),
				...(directives === undefined ? {} : { directives }),
				...(fields === undefined ? {} : { fields }),
				loc: cursor.locate(startToken),
			};
		}

		case KEYWORD.UNION: {
			cursor.advance();
			const name = parseName(cursor);
			const directives = parseDirectives(cursor);
			const types = cursor.at(TokenKind.EQUALS)
				? (cursor.advance(),
					delimitedMany(cursor, TokenKind.PIPE, parseNamedType))
				: undefined;
			if (directives === undefined && types === undefined) empty();
			return {
				kind: Kind.UNION_TYPE_EXTENSION,
				name,
				...(directives === undefined ? {} : { directives }),
				...(types === undefined ? {} : { types }),
				loc: cursor.locate(startToken),
			};
		}

		case KEYWORD.ENUM: {
			cursor.advance();
			const name = parseName(cursor);
			const directives = parseDirectives(cursor);
			const values = optionalMany(
				cursor,
				TokenKind.BRACE_L,
				parseEnumValueDefinition,
				TokenKind.BRACE_R,
				'enum value'
			);
			if (directives === undefined && values === undefined) empty();
			return {
				kind: Kind.ENUM_TYPE_EXTENSION,
				name,
				...(directives === undefined ? {} : { directives }),
				...(values === undefined ? {} : { values }),
				loc: cursor.locate(startToken),
			};
		}

		case KEYWORD.INPUT: {
			cursor.advance();
			const name = parseName(cursor);
			const directives = parseDirectives(cursor);
			const fields = optionalMany(
				cursor,
				TokenKind.BRACE_L,
				parseInputValueDefinition,
				TokenKind.BRACE_R,
				'input field'
			);
			if (directives === undefined && fields === undefined) empty();
			return {
				kind: Kind.INPUT_OBJECT_TYPE_EXTENSION,
				name,
				...(directives === undefined ? {} : { directives }),
				...(fields === undefined ? {} : { fields }),
				loc: cursor.locate(startToken),
			};
		}

		default:
			return cursor.fail(
				`Expected something to extend, found ${cursor.describe(keyword)}`,
				keyword
			);
	}
};

/** Parse one catalog definition, including any description in front of it. */
export const parseTypeSystemDefinition = (
	cursor: ParserCursor
): TypeSystemDefinitionNode => {
	const startToken = cursor.peek();
	const description = parseDescription(cursor);
	const keyword = cursor.peek();

	switch (keyword.value) {
		case KEYWORD.SCHEMA:
			return parseSchemaDefinition(cursor, startToken, description);
		case KEYWORD.SCALAR:
			return parseScalarTypeDefinition(cursor, startToken, description);
		case KEYWORD.TYPE:
			return parseObjectTypeDefinition(cursor, startToken, description);
		case KEYWORD.INTERFACE:
			return parseInterfaceTypeDefinition(cursor, startToken, description);
		case KEYWORD.UNION:
			return parseUnionTypeDefinition(cursor, startToken, description);
		case KEYWORD.ENUM:
			return parseEnumTypeDefinition(cursor, startToken, description);
		case KEYWORD.INPUT:
			return parseInputObjectTypeDefinition(cursor, startToken, description);
		case KEYWORD.DIRECTIVE:
			return parseDirectiveDefinition(cursor, startToken, description);
		default:
			return cursor.fail(
				`Expected a type system definition, found ${cursor.describe(keyword)}`,
				keyword
			);
	}
};
