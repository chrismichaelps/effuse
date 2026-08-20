/**
 * MIT License
 *
 * Copyright (c) 2025 Chris M. Perez
 *
 * A catalog has to hold together before anything can be checked against it.
 */

import { describe, expect, it } from 'vitest';
import { buildCatalogSafe } from '../index.js';

const problems = (source: string): readonly string[] => {
	const result = buildCatalogSafe(source);
	return result.success ? [] : result.errors.map((error) => error.message);
};

const accepts = (source: string): void => {
	const result = buildCatalogSafe(source);
	expect(
		result.success ? [] : result.errors.map((error) => error.message)
	).toEqual([]);
};

describe('root types', () => {
	it('accepts a catalog whose roots are object types', () => {
		accepts('schema { query: Query } type Query { a: Int }');
	});

	it('rejects a root that is not an object type', () => {
		expect(problems('schema { query: Status } enum Status { A } ')[0]).toMatch(
			/query root type "Status" must be an object type/i
		);
	});

	it('rejects a catalog with no query root at all', () => {
		expect(problems('type User { id: ID! }')[0]).toMatch(
			/must define a query root type/i
		);
	});
});

describe('fields and the types they carry', () => {
	it('rejects an output field that carries an input type', () => {
		expect(
			problems('type Query { a: Filter } input Filter { b: Int }')[0]
		).toMatch(/Field "Query.a" cannot carry input type "Filter"/);
	});

	it('rejects an argument that carries an output type', () => {
		expect(
			problems('type Query { a(who: User): Int } type User { id: ID! }')[0]
		).toMatch(/Argument "Query.a\(who:\)" cannot carry output type "User"/);
	});

	it('rejects an input field that carries an output type', () => {
		expect(
			problems(
				'type Query { a: Int } input Filter { who: User } type User { id: ID! }'
			)[0]
		).toMatch(/Field "Filter.who" cannot carry output type "User"/);
	});

	it('rejects a type with no fields', () => {
		expect(problems('type Query { a: Int } type Empty')[0]).toMatch(
			/Type "Empty" must define at least one field/
		);
	});

	it('rejects an enum with no values', () => {
		expect(problems('type Query { a: Int } enum Empty')[0]).toMatch(
			/Enum "Empty" must define at least one value/
		);
	});

	it('rejects a duplicated field, value, or member', () => {
		expect(problems('type Query { a: Int a: Int }')[0]).toMatch(
			/Field "a" is defined more than once on type "Query"/
		);
		expect(problems('type Query { a: Int } enum E { A A }')[0]).toMatch(
			/Value "A" is defined more than once on enum "E"/
		);
		expect(
			problems('type Query { a: Int } type P { a: Int } union M = P | P')[0]
		).toMatch(/"P" is listed more than once in union "M"/);
	});

	it('rejects a duplicated argument', () => {
		expect(problems('type Query { a(x: Int, x: Int): Int }')[0]).toMatch(
			/Argument "x" is defined more than once on "Query.a"/
		);
	});
});

describe('interfaces', () => {
	it('accepts a type that declares everything its interface does', () => {
		accepts(`
			type Query { node: Node }
			interface Node { id: ID! name(short: Boolean): String! }
			type User implements Node { id: ID! name(short: Boolean): String! age: Int }
		`);
	});

	it('rejects a type missing a field its interface declares', () => {
		expect(
			problems(`
				type Query { node: Node }
				interface Node { id: ID! }
				type User implements Node { name: String! }
			`)[0]
		).toMatch(
			/Type "User" says it implements "Node" but does not declare "id"/
		);
	});

	it('rejects a field whose type does not match the interface', () => {
		expect(
			problems(`
				type Query { node: Node }
				interface Node { id: ID! }
				type User implements Node { id: String! }
			`)[0]
		).toMatch(/"User.id" is "String!" where interface "Node" declares "ID!"/);
	});

	it('rejects a field missing an argument the interface declares', () => {
		expect(
			problems(`
				type Query { node: Node }
				interface Node { name(short: Boolean): String! }
				type User implements Node { name: String! }
			`)[0]
		).toMatch(/"User.name" is missing argument "short"/);
	});

	it('rejects implementing something that is not an interface', () => {
		expect(
			problems(
				'type Query { a: Int } type P { a: Int } type User implements P { a: Int }'
			)[0]
		).toMatch(/"P" is not an interface/);
	});
});

describe('unions', () => {
	it('rejects a member that is not an object type', () => {
		expect(
			problems('type Query { m: M } union M = Status enum Status { A }')[0]
		).toMatch(/Union "M" cannot include "Status", which is not an object type/);
	});

	it('rejects a union with no members', () => {
		expect(problems('type Query { m: M } union M')[0]).toMatch(
			/Union "M" must include at least one type/
		);
	});
});

describe('reserved names', () => {
	it('rejects a type or field a client would take for introspection', () => {
		expect(
			problems('type Query { a: Int } type __Secret { a: Int }')[0]
		).toMatch(/"__Secret" is reserved/);
		expect(problems('type Query { __secret: Int }')[0]).toMatch(
			/"Query.__secret" is reserved/
		);
	});
});

describe('input objects that cannot be built', () => {
	it('rejects an input type that requires itself', () => {
		expect(
			problems(
				'type Query { a(f: Filter): Int } input Filter { self: Filter! }'
			)[0]
		).toMatch(
			/Input type "Filter" cannot be built: "Filter.self" requires "Filter"/
		);
	});

	it('accepts one that merely refers to itself', () => {
		accepts('type Query { a(f: Filter): Int } input Filter { self: Filter }');
	});
});
