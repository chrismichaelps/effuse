/**
 * MIT License
 *
 * Copyright (c) 2025 Chris M. Perez
 */

import { describe, expect, it } from 'vitest';
import { buildCatalogSafe } from '../index.js';

const problems = (source: string) => {
	const built = buildCatalogSafe(source);
	return built.success ? [] : built.errors.map((error) => error.message);
};

describe('a directive a catalog writes', () => {
	it('has to be one the catalog defines', () => {
		expect(
			problems(`
				type Query @nonsense { a: String! }
				schema { query: Query }
			`)
		).toEqual([expect.stringMatching(/"@nonsense" is not defined/)]);
	});

	it('catches the typo that made it look deprecated', () => {
		// The whole point of a warning is that something reads it, and nothing
		// reads @depreacted.
		expect(
			problems(`
				type Query { a: String! @depreacted(reason: "use b") b: String! }
				schema { query: Query }
			`)
		).toEqual([expect.stringMatching(/"@depreacted" is not defined/)]);
	});

	it('has to be written where it says it may be', () => {
		expect(
			problems(`
				type Query @connection { a: String! }
				schema { query: Query }
			`)
		).toEqual([
			expect.stringMatching(
				/"@connection" cannot be written on an object type/
			),
		]);
	});

	it('refuses one meant for objects on an interface', () => {
		expect(
			problems(`
				interface Named @identity { id: ID! }
				type Person implements Named { id: ID! }
				type Query { named: Named! }
				schema { query: Query }
			`)
		).toEqual([expect.stringMatching(/"@identity" cannot be written/)]);
	});

	it('checks a custom directive the same way', () => {
		expect(
			problems(`
				directive @tag on FIELD_DEFINITION
				type Query @tag { a: String! }
				schema { query: Query }
			`)
		).toEqual([
			expect.stringMatching(/"@tag" cannot be written on an object type/),
		]);
	});

	it('checks an argument', () => {
		expect(
			problems(`
				directive @tag on FIELD_DEFINITION
				type Query { a(x: String? @tag): String! }
				schema { query: Query }
			`)
		).toEqual([expect.stringMatching(/"@tag" cannot be written/)]);
	});

	it('checks an enum value', () => {
		expect(
			problems(`
				enum Colour { RED @connection }
				type Query { a: Colour! }
				schema { query: Query }
			`)
		).toEqual([expect.stringMatching(/"@connection" cannot be written/)]);
	});

	it('checks a field of an input type', () => {
		expect(
			problems(`
				directive @tag on FIELD_DEFINITION
				input Filter { name: String? @tag }
				type Query { a(f: Filter?): String! }
				schema { query: Query }
			`)
		).toEqual([expect.stringMatching(/"@tag" cannot be written/)]);
	});

	it('reports every one rather than the first', () => {
		expect(
			problems(`
				type Query @connection { a: String! @nonsense }
				schema { query: Query }
			`)
		).toHaveLength(2);
	});
});

describe('a directive written where it belongs', () => {
	it('is left alone on a field', () => {
		expect(
			problems(`
				type Post { id: ID! }
				type Query { posts: [Post!]! @connection @cost(value: 5) }
				schema { query: Query }
			`)
		).toEqual([]);
	});

	it('is left alone on the type it is meant for', () => {
		expect(
			problems(`
				type Person @identity { id: ID! }
				type Query { person: Person! }
				schema { query: Query }
			`)
		).toEqual([]);
	});

	it('is left alone on an enum value', () => {
		expect(
			problems(`
				enum Colour { RED @deprecated(reason: "use CRIMSON") CRIMSON }
				type Query { a: Colour! }
				schema { query: Query }
			`)
		).toEqual([]);
	});

	it('is left alone where a catalog declared its own', () => {
		expect(
			problems(`
				directive @tag(name: String!) on OBJECT | FIELD_DEFINITION
				type Person @tag(name: "core") { id: ID! @tag(name: "key") }
				type Query { person: Person! }
				schema { query: Query }
			`)
		).toEqual([]);
	});

	it('is left alone on a schema block', () => {
		expect(
			problems(`
				directive @version(is: String!) on SCHEMA
				type Query { a: String! }
				schema @version(is: "1") { query: Query }
			`)
		).toEqual([]);
	});
});
