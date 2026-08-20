/**
 * MIT License
 *
 * Copyright (c) 2025 Chris M. Perez
 */

import { describe, expect, it } from 'vitest';
import { buildCatalog, execute, validateRequest } from '../index.js';

const catalog = buildCatalog(`
	schema { query: Query mutation: Mutation }

	"The entry points."
	type Query {
		posts(status: Status = PUBLISHED): [Post!]! @connection @cost(value: 7)
		me: User @auth(requires: "member")
		legacy: String @deprecated(reason: "use me")
		node: Node
		media: Media
	}
	type Mutation { noop: Boolean }

	interface Node { id: ID! }
	"A person."
	type User implements Node { id: ID! name: String! nickname: String? tags: [String!] }
	type Post implements Node { id: ID! title: String! status: Status! }
	type Photo { url: String! }
	union Media = Photo | Post

	enum Status { DRAFT PUBLISHED ARCHIVED @deprecated(reason: "gone") }
	input CreatePostInput { title: String! draft: Boolean = true }
	scalar DateTime
`);

const run = async (request: string) => {
	const result = await execute({ request, catalog });
	expect(result.errors).toBeUndefined();
	return result.data as Record<string, unknown>;
};

describe('__schema', () => {
	it('names the root operation types the catalog declares', async () => {
		const data = await run(
			'{ __schema { queryType { name } mutationType { name } liveType { name } } }'
		);

		expect(data.__schema).toEqual({
			queryType: { name: 'Query' },
			mutationType: { name: 'Mutation' },
			liveType: null,
		});
	});

	it('lists the catalog types alongside the introspection ones', async () => {
		const data = await run('{ __schema { types { name } } }');
		const names = (data.__schema as { types: { name: string }[] }).types.map(
			(type) => type.name
		);

		expect(names).toContain('User');
		expect(names).toContain('Status');
		expect(names).toContain('__Schema');
		expect(names).toContain('__Type');
	});

	it('lists the directives, with their locations and arguments', async () => {
		const data = await run(
			'{ __schema { directives { name isRepeatable locations args { name type { name } } } } }'
		);
		const directives = (data.__schema as { directives: { name: string }[] })
			.directives;
		const include = directives.find(
			(directive) => directive.name === 'include'
		);

		expect(include).toMatchObject({
			name: 'include',
			isRepeatable: false,
			locations: ['FIELD', 'FRAGMENT_SPREAD', 'INLINE_FRAGMENT'],
			args: [{ name: 'if' }],
		});
	});

	it('lists the pipeline operators the language defines', async () => {
		const data = await run(
			'{ __schema { pipelineOperators { name arguments appliesTo } } }'
		);
		const operators = (
			data.__schema as { pipelineOperators: { name: string }[] }
		).pipelineOperators.map((operator) => operator.name);

		expect(operators).toEqual([
			'filter',
			'sort',
			'take',
			'skip',
			'page',
			'unique',
		]);
	});
});

describe('__type', () => {
	it('describes an object type and its fields', async () => {
		const data = await run(
			'{ __type(name: "User") { kind name description fields { name type { kind name ofType { name } } } } }'
		);

		expect(data.__type).toMatchObject({
			kind: 'OBJECT',
			name: 'User',
			description: 'A person.',
			fields: [
				{ name: 'id', type: { kind: 'NON_NULL', ofType: { name: 'ID' } } },
				{
					name: 'name',
					type: { kind: 'NON_NULL', ofType: { name: 'String' } },
				},
				{
					name: 'nickname',
					type: { kind: 'OPTIONAL', ofType: { name: 'String' } },
				},
				{ name: 'tags', type: { kind: 'LIST' } },
			],
		});
	});

	it('reports what a type implements and what an abstract type can be', async () => {
		const user = await run('{ __type(name: "User") { interfaces { name } } }');
		const node = await run(
			'{ __type(name: "Node") { kind possibleTypes { name } } }'
		);
		const media = await run(
			'{ __type(name: "Media") { kind possibleTypes { name } } }'
		);

		expect(user.__type).toEqual({ interfaces: [{ name: 'Node' }] });
		expect(node.__type).toMatchObject({ kind: 'INTERFACE' });
		expect(
			(node.__type as { possibleTypes: { name: string }[] }).possibleTypes.map(
				(type) => type.name
			)
		).toEqual(['User', 'Post']);
		expect(media.__type).toMatchObject({
			kind: 'UNION',
			possibleTypes: [{ name: 'Photo' }, { name: 'Post' }],
		});
	});

	it('describes enums and input objects', async () => {
		const status = await run(
			'{ __type(name: "Status") { kind enumValues(includeDeprecated: true) { name isDeprecated deprecationReason } } }'
		);
		const input = await run(
			'{ __type(name: "CreatePostInput") { kind inputFields { name type { kind } defaultValue } } }'
		);

		expect(status.__type).toMatchObject({
			kind: 'ENUM',
			enumValues: [
				{ name: 'DRAFT', isDeprecated: false, deprecationReason: null },
				{ name: 'PUBLISHED' },
				{ name: 'ARCHIVED', isDeprecated: true, deprecationReason: 'gone' },
			],
		});
		expect(input.__type).toMatchObject({
			kind: 'INPUT_OBJECT',
			inputFields: [
				{ name: 'title', type: { kind: 'NON_NULL' }, defaultValue: null },
				{ name: 'draft', defaultValue: 'true' },
			],
		});
	});

	it('hides deprecated enum values unless asked for them', async () => {
		const data = await run(
			'{ __type(name: "Status") { enumValues { name } } }'
		);

		expect(
			(data.__type as { enumValues: { name: string }[] }).enumValues.map(
				(value) => value.name
			)
		).toEqual(['DRAFT', 'PUBLISHED']);
	});

	it('describes a scalar', async () => {
		expect(
			(await run('{ __type(name: "DateTime") { kind name } }')).__type
		).toEqual({
			kind: 'SCALAR',
			name: 'DateTime',
		});
	});

	it('has nothing to say about a type the catalog does not define', async () => {
		expect(
			(await run('{ __type(name: "Missing") { name } }')).__type
		).toBeNull();
	});
});

describe('what the catalog knows beyond the shape', () => {
	it('reports arguments with their defaults', async () => {
		const data = await run(
			'{ __type(name: "Query") { fields { name args { name defaultValue type { name } } } } }'
		);
		const posts = (
			data.__type as { fields: { name: string; args: unknown[] }[] }
		).fields.find((field) => field.name === 'posts');

		expect(posts?.args).toEqual([
			{ name: 'status', defaultValue: 'PUBLISHED', type: { name: 'Status' } },
		]);
	});

	it('reports connection, cost, and authorization on a field', async () => {
		const data = await run(
			'{ __type(name: "Query") { fields { name isConnection cost auth } } }'
		);
		const fields = (data.__type as { fields: Record<string, unknown>[] })
			.fields;

		expect(fields.find((field) => field.name === 'posts')).toMatchObject({
			isConnection: true,
			cost: 7,
		});
		expect(fields.find((field) => field.name === 'me')).toMatchObject({
			isConnection: false,
			cost: null,
			auth: 'member',
		});
	});

	it('reports deprecation, and hides deprecated fields unless asked', async () => {
		const shown = await run(
			'{ __type(name: "Query") { fields(includeDeprecated: true) { name isDeprecated deprecationReason } } }'
		);
		const hidden = await run('{ __type(name: "Query") { fields { name } } }');

		expect(
			(shown.__type as { fields: { name: string }[] }).fields.map((f) => f.name)
		).toContain('legacy');
		expect(
			(hidden.__type as { fields: { name: string }[] }).fields.map(
				(f) => f.name
			)
		).not.toContain('legacy');
	});
});

describe('introspection and the rest of the package', () => {
	it('passes validation like any other request', () => {
		expect(
			validateRequest('{ __schema { queryType { name } } }', catalog)
		).toEqual([]);
		expect(
			validateRequest('{ __schema { nope } }', catalog)[0]?.message
		).toMatch(/Cannot query field "nope" on type "__Schema"/);
	});

	it('resolves __typename on an introspection type', async () => {
		expect(
			(await run('{ __type(name: "User") { __typename } }')).__type
		).toEqual({
			__typename: '__Type',
		});
	});

	it('does not leak introspection fields onto other types', () => {
		expect(
			validateRequest('{ me { __schema { types { name } } } }', catalog)[0]
				?.message
		).toMatch(/Cannot query field "__schema" on type "User"/);
	});
});
