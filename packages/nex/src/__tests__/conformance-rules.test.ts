/**
 * MIT License
 *
 * Copyright (c) 2025 Chris M. Perez
 */

import { describe, expect, it } from 'vitest';
import { buildCatalogSafe } from '../index.js';

const problems = (source: string): readonly string[] => {
	const built = buildCatalogSafe(source);
	return built.success ? [] : built.errors.map((one) => one.message);
};

describe('a type that implements an interface', () => {
	it('may promise more than the interface asked for', () => {
		// Anyone reading through the interface expects something that may be
		// missing and gets something that never is, which is no surprise.
		expect(
			problems(`
				interface Node { id: ID? }
				type Person implements Node { id: ID! }
				type Query { person: Person! }
				schema { query: Query }
			`)
		).toEqual([]);
	});

	it('may not promise less', () => {
		expect(
			problems(`
				interface Node { id: ID! }
				type Person implements Node { id: ID? }
				type Query { person: Person! }
				schema { query: Query }
			`)
		).toEqual([
			expect.stringMatching(
				/"Person.id" is "ID\?" where interface "Node" declares "ID!"/
			),
		]);
	});

	it('may promise more inside a list too', () => {
		expect(
			problems(`
				interface Node { tags: [String?]! }
				type Person implements Node { tags: [String!]! }
				type Query { person: Person! }
				schema { query: Query }
			`)
		).toEqual([]);
	});

	it('may not answer with a different type entirely', () => {
		expect(
			problems(`
				interface Node { id: ID! }
				type Person implements Node { id: Int! }
				type Query { person: Person! }
				schema { query: Query }
			`)
		).toEqual([expect.stringMatching(/"Person.id"/)]);
	});

	it('may not change what an argument takes', () => {
		// A caller writing against the interface passes what the interface
		// declared, and would be passing it to something else entirely.
		expect(
			problems(`
				interface Node { at(when: String!): String! }
				type Person implements Node { at(when: Int!): String! }
				type Query { person: Person! }
				schema { query: Query }
			`)
		).toEqual([expect.stringMatching(/"Person.at" takes "when" as "Int!"/)]);
	});

	it('may not make an argument required that was optional', () => {
		expect(
			problems(`
				interface Node { at(when: String?): String! }
				type Person implements Node { at(when: String!): String! }
				type Query { person: Person! }
				schema { query: Query }
			`)
		).toEqual([expect.stringMatching(/"Person.at" takes "when"/)]);
	});

	it('may take an argument of its own, so long as it is optional', () => {
		expect(
			problems(`
				interface Node { at(when: String!): String! }
				type Person implements Node { at(when: String!, format: String?): String! }
				type Query { person: Person! }
				schema { query: Query }
			`)
		).toEqual([]);
	});

	it('may not require an argument of its own', () => {
		// Anyone calling through the interface would never pass it.
		expect(
			problems(`
				interface Node { at(when: String!): String! }
				type Person implements Node { at(when: String!, format: String!): String! }
				type Query { person: Person! }
				schema { query: Query }
			`)
		).toEqual([
			expect.stringMatching(
				/"Person.at" requires "format", which interface "Node" does not/
			),
		]);
	});
});

describe('a default the catalog writes down', () => {
	it('has to be a value of the type it defaults', () => {
		expect(
			problems(`
				type Query { a(n: Int! = "text"): String! }
				schema { query: Query }
			`)
		).toEqual([expect.stringMatching(/"Query.a\(n:\)"/)]);
	});

	it('is fine when it is', () => {
		expect(
			problems(`
				type Query { a(n: Int! = 3): String! }
				schema { query: Query }
			`)
		).toEqual([]);
	});

	it('is checked on an input field too', () => {
		expect(
			problems(`
				input Filter { limit: Int! = "many" }
				type Query { a(f: Filter!): String! }
				schema { query: Query }
			`)
		).toEqual([expect.stringMatching(/"Filter.limit"/)]);
	});

	it('may be null where the type allows it', () => {
		expect(
			problems(`
				type Query { a(n: Int? = null): String! }
				schema { query: Query }
			`)
		).toEqual([]);
	});

	it('may not be null where the type does not', () => {
		expect(
			problems(`
				type Query { a(n: Int! = null): String! }
				schema { query: Query }
			`)
		).toEqual([expect.stringMatching(/"Query.a\(n:\)"/)]);
	});
});

describe('a directive used more than once', () => {
	it('is refused where the catalog did not say it may be', () => {
		expect(
			problems(`
				directive @once on FIELD_DEFINITION
				type Query { a: String! @once @once }
				schema { query: Query }
			`)
		).toEqual([expect.stringMatching(/"@once" may only be used once/)]);
	});

	it('is allowed where it said it may', () => {
		expect(
			problems(`
				directive @tag(name: String!) repeatable on FIELD_DEFINITION
				type Query { a: String! @tag(name: "x") @tag(name: "y") }
				schema { query: Query }
			`)
		).toEqual([]);
	});

	it('is refused on a type as well as a field', () => {
		expect(
			problems(`
				directive @once on OBJECT
				type Person @once @once { id: ID! }
				type Query { person: Person! }
				schema { query: Query }
			`)
		).toEqual([expect.stringMatching(/"@once" may only be used once/)]);
	});
});
