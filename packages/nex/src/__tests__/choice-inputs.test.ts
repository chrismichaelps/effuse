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
	generateCatalogTypes,
	generateTypes,
	validateRequest,
} from '../index.js';

const catalog = buildCatalog(`
	"Exactly one way of naming a person."
	input Lookup @choice { id: ID? email: String? handle: String? }
	type Person { id: ID! name: String! }
	type Query { person(by: Lookup!): Person? people(by: Lookup?): [Person!]! @connection }
	schema { query: Query }
`);

const run = (request: string, variables?: Record<string, unknown>) =>
	execute({
		request,
		catalog,
		...(variables === undefined ? {} : { variables }),
		resolvers: {
			Query: {
				person: (_source, args) => {
					const by = args.by as Record<string, unknown>;
					const [key] = Object.keys(by);
					return { id: '1', name: `found by ${String(key)}` };
				},
				people: () => [],
			},
		},
	});

describe('an input that takes exactly one of what it offers', () => {
	it('takes one', async () => {
		const result = await run('{ person(by: { id: "1" }) { name } }');

		expect(result.errors).toBeUndefined();
		expect(result.data).toEqual({ person: { name: 'found by id' } });
	});

	it('takes a different one', async () => {
		const result = await run('{ person(by: { email: "a@b.c" }) { name } }');

		expect(result.data).toEqual({ person: { name: 'found by email' } });
	});

	it('refuses none of them', async () => {
		const result = await run('{ person(by: {}) { name } }');

		// The field is nullable, so the request survives and the field does not.
		expect(result.data).toEqual({ person: null });
		expect(result.errors?.[0]?.message).toMatch(/exactly one/i);
	});

	it('refuses more than one', async () => {
		const result = await run(
			'{ person(by: { id: "1", email: "a@b.c" }) { name } }'
		);

		expect(result.data).toEqual({ person: null });
		expect(result.errors?.[0]?.message).toMatch(/exactly one/i);
	});

	it('names what was given when it refuses', async () => {
		const result = await run(
			'{ person(by: { id: "1", email: "a@b.c" }) { name } }'
		);

		expect(result.errors?.[0]?.message).toMatch(/id/);
		expect(result.errors?.[0]?.message).toMatch(/email/);
	});

	it('counts a field given as null as having been given', async () => {
		const result = await run(
			'{ person(by: { id: null, email: "a@b.c" }) { name } }'
		);

		// Writing a field at all is choosing it, and choosing nothing for it
		// is a different thing from leaving it out.
		expect(result.errors?.[0]?.message).toMatch(/exactly one/i);
	});

	it('holds a value that arrived in a variable to the same rule', async () => {
		const result = await run(
			'query P($by: Lookup!) { person(by: $by) { name } }',
			{ by: { id: '1', handle: 'ada' } }
		);

		// A variable is read before anything runs, so the request is refused
		// rather than one field of it failing.
		expect(result.data).toBeNull();
		expect(result.errors?.[0]?.message).toMatch(/exactly one/i);
	});

	it('lets the whole input be left out when it may be', () => {
		expect(validateRequest('{ people { id } }', catalog)).toEqual([]);
	});
});

describe('what a catalog must say for a choice to mean anything', () => {
	it('refuses one whose field must always be given', () => {
		const built = buildCatalogSafe(`
			input Lookup @choice { id: ID! email: String? }
			type Query { thing(by: Lookup!): String! }
			schema { query: Query }
		`);

		expect(built.success).toBe(false);
		expect(built.success ? [] : built.errors.map((one) => one.message)).toEqual(
			[expect.stringMatching(/"Lookup.id" must be optional/)]
		);
	});

	it('refuses one with nothing to choose between', () => {
		const built = buildCatalogSafe(`
			input Lookup @choice { id: ID? }
			type Query { thing(by: Lookup!): String! }
			schema { query: Query }
		`);

		expect(built.success).toBe(false);
		expect(built.success ? [] : built.errors.map((one) => one.message)).toEqual(
			[expect.stringMatching(/at least two/)]
		);
	});

	it('refuses a field of it carrying a default', () => {
		const built = buildCatalogSafe(`
			input Lookup @choice { id: ID? = "1" email: String? }
			type Query { thing(by: Lookup!): String! }
			schema { query: Query }
		`);

		// A default is a value nobody chose, which would make the choice for
		// the caller every time.
		expect(built.success).toBe(false);
	});
});

describe('the types written for a choice', () => {
	it('is one shape per way of naming it, not one with everything optional', () => {
		const generated = generateCatalogTypes(catalog);

		expect(generated).toContain(
			'export type Lookup =\n\t| { id: string }\n\t| { email: string }\n\t| { handle: string };'
		);
	});

	it('says as much where a request takes one', () => {
		const generated = generateTypes(
			'query P($by: Lookup!) { person(by: $by) { name } }',
			catalog
		);

		// A caller who passes two, or none, is wrong before anything runs.
		expect(generated).toContain(
			'by: ({ id: string } | { email: string } | { handle: string });'
		);
	});

	it('leaves an ordinary input alone', () => {
		const plain = buildCatalog(`
			input Filter { name: String? limit: Int? }
			type Query { thing(by: Filter!): String! }
			schema { query: Query }
		`);

		expect(generateCatalogTypes(plain)).toContain('name?: string | null;');
	});
});
