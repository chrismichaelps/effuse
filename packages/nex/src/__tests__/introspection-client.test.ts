/**
 * MIT License
 *
 * Copyright (c) 2025 Chris M. Perez
 */

import { describe, expect, it } from 'vitest';
import {
	INTROSPECTION_QUERY,
	buildCatalog,
	buildCatalogFromIntrospection,
	buildCatalogFromIntrospectionSafe,
	execute,
	printCatalog,
	validateRequest,
} from '../index.js';

const source = `
	schema { query: Query mutation: Mutation }

	"Everything a client can read."
	type Query {
		me: User
		posts(status: Status = PUBLISHED, first: Int): [Post!]! @connection @cost(value: 4)
		node: Node
		media: Media
		when: DateTime
	}
	type Mutation { createPost(input: NewPost!): Post! }

	interface Node { id: ID! }
	type User implements Node { id: ID! name: String! nickname: String? tags: [String!] }
	type Post implements Node { id: ID! title: String! status: Status! legacy: String @deprecated(reason: "gone") }
	type Photo { url: String! }
	union Media = User | Photo

	enum Status { DRAFT PUBLISHED ARCHIVED @deprecated(reason: "no longer used") }
	input NewPost { title: String! draft: Boolean = true tags: [String!] }
	scalar DateTime
	directive @tag(name: String!) repeatable on FIELD
`;

const original = buildCatalog(source);

const introspect = async () => {
	const result = await execute({
		request: INTROSPECTION_QUERY,
		catalog: original,
	});
	expect(result.errors).toBeUndefined();
	return result;
};

describe('the introspection request', () => {
	it('is something the catalog accepts', () => {
		expect(validateRequest(INTROSPECTION_QUERY, original)).toEqual([]);
	});

	it('asks for everything a catalog is made of', async () => {
		const result = await introspect();
		const schema = (result.data as { __schema: Record<string, unknown> })
			.__schema;

		expect(Object.keys(schema)).toEqual(
			expect.arrayContaining(['types', 'queryType', 'directives'])
		);
	});
});

describe('rebuilding a catalog from what a server said', () => {
	it('rebuilds the same catalog', async () => {
		const rebuilt = buildCatalogFromIntrospection(await introspect());

		expect(printCatalog(rebuilt)).toBe(printCatalog(original));
	});

	it('keeps the root types', async () => {
		const rebuilt = buildCatalogFromIntrospection(await introspect());

		expect(rebuilt.getRootType('query')?.name.value).toBe('Query');
		expect(rebuilt.getRootType('mutation')?.name.value).toBe('Mutation');
		expect(rebuilt.getRootType('live')).toBeUndefined();
	});

	it('keeps what a client needs to write a request', async () => {
		const rebuilt = buildCatalogFromIntrospection(await introspect());

		expect(rebuilt.isConnectionField('Query', 'posts')).toBe(true);
		expect(
			rebuilt
				.getField('Query', 'posts')
				?.arguments?.map((argument) => argument.name.value)
		).toEqual(['status', 'first']);
		expect(
			rebuilt.getPossibleTypes('Media').map((type) => type.name.value)
		).toEqual(['User', 'Photo']);
	});

	it('validates a request the same way the server would', async () => {
		const rebuilt = buildCatalogFromIntrospection(await introspect());
		const request =
			'{ posts | filter status == PUBLISHED | page first: 2 { title } }';

		expect(validateRequest(request, rebuilt)).toEqual(
			validateRequest(request, original)
		);
		expect(validateRequest('{ posts { nope } }', rebuilt)[0]?.message).toMatch(
			/Cannot query field "nope"/
		);
	});

	it('reports a result that is not an introspection result', () => {
		const result = buildCatalogFromIntrospectionSafe({ data: { nope: true } });

		expect(result.success).toBe(false);
		expect(
			result.success ? [] : result.errors.map((error) => error.message)
		).toContainEqual(expect.stringMatching(/introspection/i));
	});

	it('throws for the same thing when asked directly', () => {
		expect(() => buildCatalogFromIntrospection({})).toThrowError(
			/introspection/i
		);
	});
});

describe('introspection that goes too deep', () => {
	it('refuses a request that walks the type graph over and over', () => {
		// Each `fields` steps onto another type, and the graph is cyclic, so
		// this walks the same handful of types round and round.
		const nested = `{
			__schema {
				types {
					fields { type { fields { type { fields { type { fields { name } } } } } } }
				}
			}
		}`;

		expect(validateRequest(nested, original)[0]?.message).toMatch(
			/Introspection goes too deep/i
		);
	});

	it('leaves an ordinary introspection request alone', () => {
		expect(validateRequest(INTROSPECTION_QUERY, original)).toEqual([]);
	});
});
