/**
 * MIT License
 *
 * Copyright (c) 2025 Chris M. Perez
 */

import { describe, expect, it } from 'vitest';
import { buildCatalog, buildCatalogSafe, validateRequest } from '../index.js';

const catalog = buildCatalog(`
	type Query { name: String! }
	schema { query: Query }
`);

const problems = (request: string) =>
	validateRequest(request, catalog).map((problem) => problem.message);

describe('how far introspection may be walked', () => {
	it('refuses a request that walks the type graph too far', () => {
		expect(
			problems(
				'{ __schema { types { fields { type { fields { type { fields { name } } } } } } } }'
			)
		).toEqual([expect.stringMatching(/goes too deep/)]);
	});

	it('allows what an ordinary tool asks for', () => {
		expect(problems('{ __schema { queryType { name } } }')).toEqual([]);
		expect(
			problems('{ __schema { types { fields { type { name } } } } }')
		).toEqual([]);
	});

	it('counts the fields that step to another type, and only those', () => {
		// Wrappers of one type reference are finite whatever a request asks
		// for, so walking them is not what has to be bounded.
		expect(
			problems(
				'{ __schema { types { fields { type { ofType { ofType { ofType { name } } } } } } } }'
			)
		).toEqual([]);
	});

	it('does not follow a fragment round in a circle', () => {
		// The cycle is somebody else's error to report; counting depth must
		// simply not spin on it.
		expect(
			problems(`
				fragment Loop on __Type { fields { type { ...Loop } } }
				{ __schema { types { ...Loop } } }
			`)
		).toContainEqual(expect.stringMatching(/spreads itself/));

		// A cycle through steps that are not counted never reaches the limit,
		// so nothing but the guard stops it going round.
		expect(
			problems(`
				fragment Wrap on __Type { ofType { ...Wrap } }
				{ __schema { types { ...Wrap } } }
			`)
		).toContainEqual(expect.stringMatching(/spreads itself/));
	});

	it('counts through a fragment as if it were written inline', () => {
		expect(
			problems(`
				fragment Deep on __Type { fields { type { fields { name } } } }
				{ __schema { types { fields { type { ...Deep } } } } }
			`)
		).toEqual([expect.stringMatching(/goes too deep/)]);
	});
});

describe('a schema block that names an operation twice', () => {
	it('refuses two roots for one operation', () => {
		const built = buildCatalogSafe(`
			type Query { a: Int! }
			type Other { b: Int! }
			schema { query: Query, query: Other }
		`);

		expect(built.success).toBe(false);
		expect(built.success ? [] : built.errors.map((one) => one.message)).toEqual(
			[
				expect.stringMatching(
					/schema block names the query root more than once/
				),
			]
		);
	});

	it('refuses it even when both name the same type', () => {
		const built = buildCatalogSafe(`
			type Query { a: Int! }
			schema { query: Query, query: Query }
		`);

		expect(built.success).toBe(false);
	});

	it('allows one root per operation', () => {
		const built = buildCatalogSafe(`
			type Query { a: Int! }
			type Mutation { b: Int! }
			schema { query: Query, mutation: Mutation }
		`);

		expect(built.success).toBe(true);
	});
});
