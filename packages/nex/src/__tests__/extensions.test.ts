/**
 * MIT License
 *
 * Copyright (c) 2025 Chris M. Perez
 */

import { describe, expect, it } from 'vitest';
import {
	Kind,
	buildCatalog,
	buildCatalogSafe,
	parse,
	print,
	validateDocument,
} from '../index.js';

const messages = (source: string): readonly string[] => {
	const result = buildCatalogSafe(source);
	return result.success ? [] : result.errors.map((error) => error.message);
};

describe('parsing extensions', () => {
	it('parses every kind of extension', () => {
		const kinds = parse(`
			extend schema { mutation: Mutation }
			extend scalar DateTime @tz
			extend type User implements Node { nickname: String? }
			extend interface Node { createdAt: DateTime! }
			extend union Media = Video
			extend enum Status { SCHEDULED }
			extend input CreatePostInput { draft: Boolean }
		`).definitions.map((definition) => definition.kind);

		expect(kinds).toEqual([
			Kind.SCHEMA_EXTENSION,
			Kind.SCALAR_TYPE_EXTENSION,
			Kind.OBJECT_TYPE_EXTENSION,
			Kind.INTERFACE_TYPE_EXTENSION,
			Kind.UNION_TYPE_EXTENSION,
			Kind.ENUM_TYPE_EXTENSION,
			Kind.INPUT_OBJECT_TYPE_EXTENSION,
		]);
	});

	it('rejects an extension with nothing to add', () => {
		expect(() => parse('extend type User')).toThrowError(/adds nothing/i);
	});

	it('rejects a description in front of an extension', () => {
		expect(() => parse('"docs" extend type User { a: Int }')).toThrowError();
	});

	it('round-trips through the printer', () => {
		const source =
			'extend type User implements Node @tag { nickname: String? }';
		const printed = print(parse(source));

		expect(print(parse(printed))).toBe(printed);
		expect(printed).toContain('extend type User implements Node @tag {');
	});

	it('validates against the AST schema like any other node', () => {
		expect(
			validateDocument(parse('extend enum Status { SCHEDULED }'))
		).toBeTruthy();
	});
});

describe('applying extensions', () => {
	const catalog = buildCatalog(`
		type Query { me: User }
		interface Node { id: ID! }
		type User implements Node { id: ID! name: String! }
		type Photo { url: String! }
		type Video { url: String! }
		union Media = Photo
		enum Status { DRAFT }
		input CreatePostInput { title: String! }
		scalar DateTime

		extend type User implements Node { nickname: String? createdAt: DateTime! }
		extend interface Node { createdAt: DateTime! }
		extend union Media = Video
		extend enum Status { PUBLISHED }
		extend input CreatePostInput { draft: Boolean }
		extend scalar DateTime @tz
	`);

	it('adds fields to an object type', () => {
		expect(catalog.getField('User', 'nickname')).toMatchObject({
			name: { value: 'nickname' },
		});
		expect(catalog.getField('User', 'name')).toBeDefined();
	});

	it('adds fields to an interface', () => {
		expect(catalog.getField('Node', 'createdAt')).toBeDefined();
	});

	it('adds members to a union', () => {
		expect(
			catalog.getPossibleTypes('Media').map((type) => type.name.value)
		).toEqual(['Photo', 'Video']);
	});

	it('adds values to an enum and fields to an input object', () => {
		const status = catalog.getType('Status');
		const input = catalog.getType('CreatePostInput');

		expect(
			status?.kind === Kind.ENUM_TYPE_DEFINITION
				? status.values?.map((value) => value.name.value)
				: undefined
		).toEqual(['DRAFT', 'PUBLISHED']);
		expect(
			input?.kind === Kind.INPUT_OBJECT_TYPE_DEFINITION
				? input.fields?.map((field) => field.name.value)
				: undefined
		).toEqual(['title', 'draft']);
	});

	it('adds directives to a scalar', () => {
		const scalar = catalog.getType('DateTime');

		expect(
			scalar?.kind === Kind.SCALAR_TYPE_DEFINITION
				? scalar.directives?.map((directive) => directive.name.value)
				: undefined
		).toEqual(['tz']);
	});

	it('extends the schema block', () => {
		const extended = buildCatalog(`
			type Query { a: Int }
			type Mutation { b: Int }
			schema { query: Query }
			extend schema { mutation: Mutation }
		`);

		expect(extended.getRootType('mutation')?.name.value).toBe('Mutation');
	});

	it('lets an extension arrive before the definition it extends', () => {
		const catalog = buildCatalog(`
			extend type User { nickname: String? }
			type Query { me: User }
			type User { id: ID! }
		`);

		expect(catalog.getField('User', 'nickname')).toBeDefined();
	});
});

describe('extensions that do not fit', () => {
	it('rejects extending a type the catalog does not define', () => {
		expect(
			messages('type Query { a: Int } extend type Missing { b: Int }')[0]
		).toMatch(/Cannot extend type "Missing": the catalog does not define it/);
	});

	it('rejects extending a type as the wrong kind', () => {
		expect(
			messages(
				'type Query { a: Int } enum Status { A } extend type Status { b: Int }'
			)[0]
		).toMatch(/"Status" is an enum/i);
	});

	it('rejects a field the type already has', () => {
		expect(
			messages('type Query { a: Int } extend type Query { a: Int }')[0]
		).toMatch(/Field "a" already exists on type "Query"/);
	});

	it('rejects an enum value the type already has', () => {
		expect(
			messages('type Query { a: Int } enum S { A } extend enum S { A }')[0]
		).toMatch(/Value "A" already exists on enum "S"/);
	});

	it('rejects a union member the type already has', () => {
		expect(
			messages(
				'type Query { a: Int } type P { a: Int } union M = P extend union M = P'
			)[0]
		).toMatch(/"P" is already a member of union "M"/);
	});

	it('rejects a second schema extension naming the same operation', () => {
		expect(
			messages(
				'type Query { a: Int } type M { b: Int } schema { query: Query mutation: M } extend schema { mutation: M }'
			)[0]
		).toMatch(/mutation root type is already/i);
	});
});
