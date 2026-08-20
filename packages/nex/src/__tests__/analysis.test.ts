/**
 * MIT License
 *
 * Copyright (c) 2025 Chris M. Perez
 */

import { describe, expect, it } from 'vitest';
import { analyzeRequest, buildCatalog, validateRequest } from '../index.js';

const catalog = buildCatalog(`
	type Query {
		tags: [String!]!
		posts(status: Status): [Post!]! @connection
		report: Report @cost(value: 50)
	}
	type Post {
		id: ID!
		title: String!
		author: User!
		comments: [Comment!]! @connection
	}
	type User { id: ID! name: String! posts: [Post!]! @connection }
	type Comment { id: ID! body: String! }
	type Report { total: Int! }
	enum Status { DRAFT PUBLISHED }
`);

const analyze = (
	source: string,
	variables?: Readonly<Record<string, unknown>>
) =>
	analyzeRequest(source, catalog, variables === undefined ? {} : { variables });

describe('depth', () => {
	it('counts the deepest selection path', () => {
		expect(analyze('{ tags }').depth).toBe(1);
		expect(analyze('{ posts | take 1 { title } }').depth).toBe(2);
		expect(analyze('{ posts | take 1 { author { name } } }').depth).toBe(3);
	});

	it('counts depth through fragments', () => {
		expect(
			analyze(
				'{ posts | take 1 { ...F } } fragment F on Post { author { name } }'
			).depth
		).toBe(3);
	});

	it('does not run forever on a fragment cycle', () => {
		expect(
			analyze('{ posts | take 1 { ...A } } fragment A on Post { ...A }').depth
		).toBeGreaterThan(0);
	});
});

describe('cost', () => {
	it('charges one per field by default', () => {
		expect(analyze('{ tags }').cost).toBe(1);
	});

	it('honours @cost on a field definition', () => {
		expect(analyze('{ report { total } }').cost).toBe(51);
	});

	it('multiplies a list subtree by the page size', () => {
		expect(analyze('{ posts | page first: 10 { title } }').cost).toBe(11);
		expect(analyze('{ posts | take 3 { title author { name } } }').cost).toBe(
			10
		);
	});

	it('multiplies nested pages', () => {
		expect(
			analyze(
				'{ posts | page first: 10 { comments | page first: 5 { body } } }'
			).cost
		).toBe(1 + 10 * (1 + 5 * 1));
	});

	it('reads a page size passed as a variable', () => {
		expect(
			analyze('query A($n: Int!) { posts | page first: $n { title } }', {
				n: 4,
			}).cost
		).toBe(5);
	});

	it('falls back to a default page size when none can be read', () => {
		expect(
			analyze('query A($n: Int!) { posts | page first: $n { title } }').cost
		).toBe(1 + 20 * 1);
	});

	it('charges an unpaged list like a page of the default size', () => {
		expect(analyze('{ posts { title } }').cost).toBe(21);
	});
});

describe('limits', () => {
	it('rejects a request deeper than the limit', () => {
		const errors = validateRequest(
			'{ posts | take 1 { author { posts | take 1 { title } } } }',
			catalog,
			{ maxDepth: 3 }
		);

		expect(errors[0]?.message).toMatch(/depth 4 exceeds the maximum of 3/);
	});

	it('rejects a request costing more than the limit', () => {
		const errors = validateRequest('{ report { total } }', catalog, {
			maxCost: 10,
		});

		expect(errors[0]?.message).toMatch(/cost 51 exceeds the maximum of 10/);
	});

	it('leaves a request within its limits alone', () => {
		expect(
			validateRequest('{ tags }', catalog, { maxCost: 10, maxDepth: 3 })
		).toEqual([]);
	});

	it('checks limits against the variables the request will run with', () => {
		const source = 'query A($n: Int!) { posts | page first: $n { title } }';

		expect(
			validateRequest(source, catalog, { maxCost: 30, variables: { n: 5 } })
		).toEqual([]);
		expect(
			validateRequest(source, catalog, {
				maxCost: 30,
				variables: { n: 100 },
			})[0]?.message
		).toMatch(/cost 101 exceeds/);
	});
});
