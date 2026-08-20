/**
 * MIT License
 *
 * Copyright (c) 2025 Chris M. Perez
 */

import { describe, expect, it } from 'vitest';
import {
	type EnumTypeDefinitionNode,
	type InputObjectTypeDefinitionNode,
	type InterfaceTypeDefinitionNode,
	Kind,
	parse,
	type ObjectTypeDefinitionNode,
	type UnionTypeDefinitionNode,
} from '../index.js';

const definitions = (source: string) => parse(source).definitions;
const first = (source: string) => definitions(source)[0];

describe('schema definition', () => {
	it('parses the root operation types', () => {
		expect(
			first('schema { query: Query mutation: Mutation live: Live }')
		).toMatchObject({
			kind: Kind.SCHEMA_DEFINITION,
			operationTypes: [
				{
					kind: Kind.OPERATION_TYPE_DEFINITION,
					operation: 'query',
					type: { kind: Kind.NAMED_TYPE, name: { value: 'Query' } },
				},
				{ operation: 'mutation', type: { name: { value: 'Mutation' } } },
				{ operation: 'live', type: { name: { value: 'Live' } } },
			],
		});
	});

	it('rejects a root operation type the language does not define', () => {
		expect(() => parse('schema { subscription: S }')).toThrowError(
			/operation type/i
		);
	});
});

describe('object types', () => {
	const user = (source: string) => first(source) as ObjectTypeDefinitionNode;

	it('parses fields with arguments, types, and directives', () => {
		const definition = user(
			'type User { posts(after: String, first: Int = 10): [Post!]! @connection }'
		);

		expect(definition).toMatchObject({
			kind: Kind.OBJECT_TYPE_DEFINITION,
			name: { value: 'User' },
			fields: [
				{
					kind: Kind.FIELD_DEFINITION,
					name: { value: 'posts' },
					arguments: [
						{
							kind: Kind.INPUT_VALUE_DEFINITION,
							name: { value: 'after' },
							type: { kind: Kind.NAMED_TYPE, name: { value: 'String' } },
						},
						{
							name: { value: 'first' },
							defaultValue: { kind: Kind.INT, value: '10' },
						},
					],
					type: {
						kind: Kind.NON_NULL_TYPE,
						type: { kind: Kind.LIST_TYPE, type: { kind: Kind.NON_NULL_TYPE } },
					},
					directives: [{ name: { value: 'connection' } }],
				},
			],
		});
	});

	it('parses the optional marker and a field default value', () => {
		const definition = user(
			'type Post { email: String? status: Status = DRAFT }'
		);

		expect(definition.fields?.[0]?.type).toMatchObject({
			kind: Kind.OPTIONAL_TYPE,
			type: { name: { value: 'String' } },
		});
		expect(definition.fields?.[1]?.defaultValue).toMatchObject({
			kind: Kind.ENUM,
			value: 'DRAFT',
		});
	});

	it('parses implemented interfaces, with or without a leading ampersand', () => {
		const withLeading = user(
			'type User implements & Node & Timestamped { id: ID! }'
		);
		const withoutLeading = user(
			'type User implements Node & Timestamped { id: ID! }'
		);
		const expected = [
			{ name: { value: 'Node' } },
			{ name: { value: 'Timestamped' } },
		];

		expect(withLeading.interfaces).toMatchObject(expected);
		expect(withoutLeading.interfaces).toMatchObject(expected);
	});

	it('parses descriptions on the type and its fields', () => {
		const definition = user(
			'"A person." type User { """Their id.""" id: ID! }'
		);

		expect(definition.description).toMatchObject({ value: 'A person.' });
		expect(definition.fields?.[0]?.description).toMatchObject({
			value: 'Their id.',
			block: true,
		});
	});

	it('parses a type with no field block', () => {
		expect(user('type Empty @external').fields).toBeUndefined();
	});
});

describe('other type definitions', () => {
	it('parses interfaces', () => {
		const definition = first(
			'interface Node implements Base { id: ID! }'
		) as InterfaceTypeDefinitionNode;

		expect(definition).toMatchObject({
			kind: Kind.INTERFACE_TYPE_DEFINITION,
			name: { value: 'Node' },
			interfaces: [{ name: { value: 'Base' } }],
			fields: [{ name: { value: 'id' } }],
		});
	});

	it('parses unions, with or without a leading pipe', () => {
		const withLeading = first(
			'union Media = | Photo | Video'
		) as UnionTypeDefinitionNode;
		const withoutLeading = first(
			'union Media = Photo | Video'
		) as UnionTypeDefinitionNode;
		const expected = [
			{ name: { value: 'Photo' } },
			{ name: { value: 'Video' } },
		];

		expect(withLeading).toMatchObject({
			kind: Kind.UNION_TYPE_DEFINITION,
			types: expected,
		});
		expect(withoutLeading.types).toMatchObject(expected);
	});

	it('parses enums with directives on their values', () => {
		const definition = first(
			'enum Status { DRAFT PUBLISHED ARCHIVED @deprecated(reason: "gone") }'
		) as EnumTypeDefinitionNode;

		expect(definition).toMatchObject({
			kind: Kind.ENUM_TYPE_DEFINITION,
			name: { value: 'Status' },
			values: [
				{ kind: Kind.ENUM_VALUE_DEFINITION, name: { value: 'DRAFT' } },
				{ name: { value: 'PUBLISHED' } },
				{
					name: { value: 'ARCHIVED' },
					directives: [{ name: { value: 'deprecated' } }],
				},
			],
		});
	});

	it('parses input objects', () => {
		const definition = first(
			'input CreatePostInput { title: String! tags: [String!] }'
		) as InputObjectTypeDefinitionNode;

		expect(definition).toMatchObject({
			kind: Kind.INPUT_OBJECT_TYPE_DEFINITION,
			fields: [
				{ kind: Kind.INPUT_VALUE_DEFINITION, name: { value: 'title' } },
				{ name: { value: 'tags' } },
			],
		});
	});

	it('parses scalars', () => {
		expect(
			first('scalar DateTime @specifiedBy(url: "https://example.com")')
		).toMatchObject({
			kind: Kind.SCALAR_TYPE_DEFINITION,
			name: { value: 'DateTime' },
			directives: [{ name: { value: 'specifiedBy' } }],
		});
	});

	it('parses directive definitions, including repeatable ones', () => {
		expect(
			first('directive @auth(requires: Role!) on FIELD | OBJECT')
		).toMatchObject({
			kind: Kind.DIRECTIVE_DEFINITION,
			name: { value: 'auth' },
			repeatable: false,
			arguments: [{ name: { value: 'requires' } }],
			locations: [{ value: 'FIELD' }, { value: 'OBJECT' }],
		});
		expect(first('directive @tag repeatable on FIELD')).toMatchObject({
			repeatable: true,
			locations: [{ value: 'FIELD' }],
		});
	});
});

describe('mixed documents', () => {
	it('parses executable and type system definitions side by side', () => {
		const kinds = definitions(
			'query A { a } type User { id: ID! } fragment F on User { id } enum E { X }'
		).map((definition) => definition.kind);

		expect(kinds).toEqual([
			Kind.OPERATION_DEFINITION,
			Kind.OBJECT_TYPE_DEFINITION,
			Kind.FRAGMENT_DEFINITION,
			Kind.ENUM_TYPE_DEFINITION,
		]);
	});

	it('keeps a description attached to the definition that follows it', () => {
		const [operation] = definitions('"Docs." type A { b: C }');

		expect(operation).toMatchObject({ description: { value: 'Docs.' } });
	});
});

describe('type system failures', () => {
	it.each([
		['type', 'type { id: ID! }'],
		['empty field block', 'type User { }'],
		['union with no members', 'union Media ='],
		['enum with no values', 'enum Status { }'],
		['directive with no locations', 'directive @auth on'],
		['description with nothing after it', '"orphan"'],
	])('rejects %s', (_label, source) => {
		expect(() => parse(source)).toThrowError();
	});
});
