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
	execute,
	introspectionFromCatalog,
	printCatalog,
} from '../index.js';

const catalog = buildCatalog(`
	type Person @identity { id: ID! name: String! }
	type Book @identity(field: "isbn") { isbn: String! title: String! }
	type Weather { temperature: Float! }
	type Query { person: Person! book: Book! weather: Weather! }
	schema { query: Query }
`);

const typeNamed = async (name: string) => {
	const result = await execute({
		request: `{ __type(name: "${name}") { name identityField } }`,
		catalog,
	});

	expect(result.errors).toBeUndefined();
	return result.data?.__type as { name: string; identityField: string | null };
};

describe('what introspection says identifies a type', () => {
	it('names the field a type identifies by', async () => {
		expect(await typeNamed('Person')).toMatchObject({
			identityField: 'id',
		});
	});

	it('names the field a type chose for itself', async () => {
		expect(await typeNamed('Book')).toMatchObject({
			identityField: 'isbn',
		});
	});

	it('says nothing for a type that identifies by nothing', async () => {
		expect(await typeNamed('Weather')).toMatchObject({
			identityField: null,
		});
	});

	it('says nothing for a type that could not have one', async () => {
		expect(await typeNamed('String')).toMatchObject({
			identityField: null,
		});
	});

	it('is asked for by the query this package ships', async () => {
		const result = await execute({ request: INTROSPECTION_QUERY, catalog });

		expect(result.errors).toBeUndefined();
		const schema = result.data?.__schema as {
			types: { name: string; identityField: string | null }[];
		};
		const person = schema.types.find((type) => type.name === 'Person');

		expect(person?.identityField).toBe('id');
	});
});

describe('a catalog built back from what a server said', () => {
	it('ignores a server claiming an interface identifies by something', () => {
		// Only an object can carry @identity, and what comes back over the wire
		// is whatever a server sent rather than something this package wrote.
		const rebuilt = buildCatalogFromIntrospection({
			__schema: {
				queryType: { name: 'Query' },
				mutationType: null,
				subscriptionType: null,
				directives: [],
				types: [
					{
						kind: 'INTERFACE',
						name: 'Named',
						identityField: 'id',
						fields: [
							{
								name: 'id',
								args: [],
								type: {
									kind: 'NON_NULL',
									ofType: { kind: 'SCALAR', name: 'ID' },
								},
								isDeprecated: false,
							},
						],
					},
					{
						kind: 'OBJECT',
						name: 'Query',
						fields: [
							{
								name: 'named',
								args: [],
								type: {
									kind: 'NON_NULL',
									ofType: { kind: 'INTERFACE', name: 'Named' },
								},
								isDeprecated: false,
							},
						],
					},
				],
			},
		} as never);

		expect(rebuilt.identityField('Named')).toBeUndefined();
		expect(rebuilt.getType('Named')).toBeDefined();
	});

	it('keeps what identifies each type', async () => {
		const described = await introspectionFromCatalog(catalog);
		const rebuilt = buildCatalogFromIntrospection(described);

		expect(rebuilt.identityField('Person')).toBe('id');
		expect(rebuilt.identityField('Book')).toBe('isbn');
		expect(rebuilt.identityField('Weather')).toBeUndefined();
	});

	it('answers a reference from the catalog it was rebuilt into', async () => {
		const described = await introspectionFromCatalog(catalog);
		const rebuilt = buildCatalogFromIntrospection(described);

		const result = await execute({
			request: '{ person { __ref name } }',
			catalog: rebuilt,
			resolvers: { Query: { person: () => ({ id: '1', name: 'Ada' }) } },
		});

		expect(result.errors).toBeUndefined();
		expect(result.data?.person).toMatchObject({ name: 'Ada' });
	});

	it('writes it back out as source', async () => {
		const described = await introspectionFromCatalog(catalog);
		const rebuilt = buildCatalogFromIntrospection(described);

		const written = printCatalog(rebuilt);

		// The one that named no field reads the way it was written, without an
		// argument put back on that nobody typed.
		expect(written).toMatch(/type Person @identity \{/);
		expect(written).toMatch(/type Book @identity\(field: "isbn"\) \{/);
	});
});
