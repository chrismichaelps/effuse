/**
 * MIT License
 *
 * Copyright (c) 2025 Chris M. Perez
 */

import { describe, expect, it } from 'vitest';
import {
	buildCatalog,
	buildCatalogSafe,
	execute,
	parseRef,
	refFor,
	validateRequest,
} from '../index.js';

const catalog = buildCatalog(`
	type Person @identity { id: ID! name: String! }
	type Book @identity(field: "isbn") { isbn: String! title: String! }
	type Note { body: String! }
	type Query { person: Person! book: Book! note: Note! people: [Person!]! }
	schema { query: Query }
`);

const resolvers = {
	Query: {
		person: () => ({ id: '1', name: 'Ada' }),
		book: () => ({ isbn: '978-1', title: 'On engines' }),
		note: () => ({ body: 'hello' }),
		people: () => [
			{ id: '1', name: 'Ada' },
			{ id: '2', name: 'Grace' },
		],
	},
};

const run = (request: string) => execute({ request, catalog, resolvers });

describe('what identifies an object', () => {
	it('hands out a reference for a type that has one', async () => {
		const result = await run('{ person { __ref name } }');

		expect(result.errors).toBeUndefined();
		expect((result.data?.person as { __ref: string }).__ref).toBe(
			refFor('Person', '1')
		);
	});

	it('reads back the type and the value it was built from', () => {
		expect(parseRef(refFor('Person', '1'))).toEqual({
			type: 'Person',
			id: '1',
		});
	});

	it('says nothing about an object it did not hand out', () => {
		expect(parseRef('not-a-reference')).toBeUndefined();
		expect(parseRef('')).toBeUndefined();
	});

	it('refuses an opaque token some other system handed out', () => {
		// Base64 that decodes to "authtoken:user:42" - a plausible token from
		// somewhere else, carrying separators where a reference has its own.
		// Without a mark of its own, a reference would read this as an "en"
		// of "user:42".
		expect(parseRef('YXV0aHRva2VuOnVzZXI6NDI=')).toBeUndefined();
	});

	it('is never confused with a cursor', async () => {
		const paged = buildCatalog(`
			type Person @identity { id: ID! }
			type Query { people: [Person!]! @connection }
			schema { query: Query }
		`);

		const result = await execute({
			request: '{ people | page first: 1 { id } }',
			catalog: paged,
			resolvers: { Query: { people: () => [{ id: '1' }, { id: '2' }] } },
		});

		const { endCursor } = (
			result.data?.people as { pageInfo: { endCursor: string } }
		).pageInfo;

		// Both are opaque base64 this package hands out; neither reads as the
		// other, so a cursor sent where a reference belongs is refused.
		expect(endCursor).toBeTruthy();
		expect(parseRef(endCursor)).toBeUndefined();
	});

	it('reads a value that carries the separator', () => {
		expect(parseRef(refFor('Book', 'urn:isbn:978-1'))).toEqual({
			type: 'Book',
			id: 'urn:isbn:978-1',
		});
	});

	it('uses the field the type named', async () => {
		const result = await run('{ book { __ref } }');

		expect((result.data?.book as { __ref: string }).__ref).toBe(
			refFor('Book', '978-1')
		);
	});

	it('gives every row of a list its own', async () => {
		const result = await run('{ people { __ref } }');

		expect(result.data?.people).toEqual([
			{ __ref: refFor('Person', '1') },
			{ __ref: refFor('Person', '2') },
		]);
	});

	it('is opaque rather than the value itself', () => {
		const reference = refFor('Person', '1');

		expect(reference).not.toContain('Person');
		expect(reference).not.toBe('1');
	});

	it('costs what asking the type its name costs', async () => {
		const named = await run('{ person { name __typename } }');
		const referenced = await run('{ person { name __ref } }');

		// Neither reaches a resolver, and neither should be priced as if it did.
		expect(referenced.extensions.cost).toBe(named.extensions.cost);
	});
});

describe('what a request may ask for', () => {
	const problems = (request: string) =>
		validateRequest(request, catalog).map((problem) => problem.message);

	it('refuses a reference to a type that has none', () => {
		expect(problems('{ note { __ref } }')).toEqual([
			expect.stringMatching(/"Note" does not say what identifies it/),
		]);
	});

	it('refuses a reference asked for as an object', () => {
		expect(problems('{ person { __ref { id } } }')).toEqual([
			expect.stringMatching(/cannot have a selection of subfields/),
		]);
	});

	it('allows it wherever the type appears', () => {
		expect(problems('{ people { __ref } person { __ref } }')).toEqual([]);
	});
});

describe('what a catalog must say to have one', () => {
	it('refuses a type naming a field it does not have', () => {
		const built = buildCatalogSafe(`
			type Person @identity(field: "slug") { id: ID! }
			type Query { person: Person! }
			schema { query: Query }
		`);

		expect(built.success).toBe(false);
		expect(built.success ? [] : built.errors.map((one) => one.message)).toEqual(
			[expect.stringMatching(/"Person" says "slug" identifies it/)]
		);
	});

	it('refuses a type with no field to identify it by', () => {
		const built = buildCatalogSafe(`
			type Person @identity { name: String! }
			type Query { person: Person! }
			schema { query: Query }
		`);

		expect(built.success).toBe(false);
	});
});

describe('answering with a reference a client sent back', () => {
	it('finds what a reference points at', async () => {
		const refetchable = buildCatalog(`
			type Person @identity { id: ID! name: String! }
			type Query { person: Person! lookup(ref: String!): Person? }
			schema { query: Query }
		`);

		const rows = new Map([['1', { id: '1', name: 'Ada' }]]);

		const result = await execute({
			request: `{ lookup(ref: "${refFor('Person', '1')}") { name } }`,
			catalog: refetchable,
			resolvers: {
				Query: {
					person: () => ({ id: '1', name: 'Ada' }),
					lookup: (_source, args) => {
						const reference = parseRef(String(args.ref));
						if (reference?.type !== 'Person') return null;
						return rows.get(reference.id) ?? null;
					},
				},
			},
		});

		expect(result.data).toEqual({ lookup: { name: 'Ada' } });
	});
});
