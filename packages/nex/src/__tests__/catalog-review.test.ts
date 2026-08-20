/**
 * MIT License
 *
 * Copyright (c) 2025 Chris M. Perez
 */

import { describe, expect, it } from 'vitest';
import { buildCatalog, reviewCatalog } from '../index.js';

const review = (source: string) =>
	reviewCatalog(buildCatalog(source)).map((notice) => notice.code);

const notices = (source: string) => reviewCatalog(buildCatalog(source));

describe('a catalog that will not hurt anyone', () => {
	it('has nothing to say about one', () => {
		expect(
			review(`
				"Someone with an account."
				type Person @identity { id: ID! name: String! }
				"What a caller may ask for."
				type Query { people: [Person!]! @connection }
				"What a caller may change."
				type Mutation { rename(id: ID!, to: String!): Person! }
				schema { query: Query, mutation: Mutation }
			`)
		).toEqual([]);
	});
});

describe('a list nobody can put a limit on', () => {
	it('says a list field should be pageable', () => {
		expect(
			review(`
				type Person @identity { id: ID! }
				type Query { people: [Person!]! }
				schema { query: Query }
			`)
		).toContain('UNBOUNDED_LIST');
	});

	it('says nothing about one that is', () => {
		expect(
			review(`
				type Person @identity { id: ID! }
				type Query { people: [Person!]! @connection }
				schema { query: Query }
			`)
		).not.toContain('UNBOUNDED_LIST');
	});

	it('names the field it means', () => {
		const [notice] = notices(`
			type Person @identity { id: ID! }
			type Query { people: [Person!]! }
			schema { query: Query }
		`).filter((one) => one.code === 'UNBOUNDED_LIST');

		expect(notice?.coordinate).toBe('Query.people');
	});
});

describe('an object a client cannot cache', () => {
	it('says a type with an id should say it identifies by it', () => {
		expect(
			review(`
				type Person { id: ID! name: String! }
				type Query { person: Person! }
				schema { query: Query }
			`)
		).toContain('UNIDENTIFIED_OBJECT');
	});

	it('says nothing about a root, whatever fields it happens to have', () => {
		// A root is where a request starts, not an object a client caches.
		expect(
			review(`
				type Query { id: ID! }
				schema { query: Query }
			`)
		).not.toContain('UNIDENTIFIED_OBJECT');
	});

	it('says nothing about a type with nothing to identify it by', () => {
		expect(
			review(`
				type Weather { temperature: Float! }
				type Query { weather: Weather! }
				schema { query: Query }
			`)
		).not.toContain('UNIDENTIFIED_OBJECT');
	});
});

describe('a change a client cannot see', () => {
	it('says a mutation should answer with what it changed', () => {
		expect(
			review(`
				type Person @identity { id: ID! }
				type Query { person: Person! }
				type Mutation { rename(id: ID!): Boolean! }
				schema { query: Query, mutation: Mutation }
			`)
		).toContain('OPAQUE_MUTATION');
	});

	it('says nothing about one that answers with the object', () => {
		expect(
			review(`
				type Person @identity { id: ID! }
				type Query { person: Person! }
				type Mutation { rename(id: ID!): Person! }
				schema { query: Query, mutation: Mutation }
			`)
		).not.toContain('OPAQUE_MUTATION');
	});
});

describe('something nobody can reach', () => {
	it('says a type no root leads to is unreachable', () => {
		expect(
			review(`
				type Person @identity { id: ID! }
				type Ghost { id: ID! }
				type Query { person: Person! }
				schema { query: Query }
			`)
		).toContain('UNREACHABLE_TYPE');
	});

	it('follows a union to its members', () => {
		expect(
			review(`
				type Person @identity { id: ID! }
				type Robot @identity { id: ID! }
				union Actor = Person | Robot
				type Query { actor: Actor! }
				schema { query: Query }
			`)
		).not.toContain('UNREACHABLE_TYPE');
	});

	it('follows an interface to what implements it', () => {
		expect(
			review(`
				interface Named { name: String! }
				type Person implements Named @identity { id: ID! name: String! }
				type Query { named: Named! }
				schema { query: Query }
			`)
		).not.toContain('UNREACHABLE_TYPE');
	});

	it('follows an argument to the input types it takes', () => {
		expect(
			review(`
				input Filter { name: String? }
				type Person @identity { id: ID! }
				type Query { people(filter: Filter?): [Person!]! @connection }
				schema { query: Query }
			`)
		).not.toContain('UNREACHABLE_TYPE');
	});
});

describe('a warning nobody can act on', () => {
	it('says a deprecation should say why', () => {
		expect(
			review(`
				type Person @identity { id: ID! old: String! @deprecated }
				type Query { person: Person! }
				schema { query: Query }
			`)
		).toContain('DEPRECATED_WITHOUT_REASON');
	});

	it('says nothing when it does', () => {
		expect(
			review(`
				type Person @identity {
					id: ID!
					old: String! @deprecated(reason: "Use name")
				}
				type Query { person: Person! }
				schema { query: Query }
			`)
		).not.toContain('DEPRECATED_WITHOUT_REASON');
	});
});

describe('what a review hands back', () => {
	it('says what to do about it, not just what is wrong', () => {
		const [notice] = notices(`
			type Person { id: ID! }
			type Query { person: Person! }
			schema { query: Query }
		`);

		expect(notice?.message).toMatch(/@identity/);
		expect(notice?.coordinate).toBe('Person');
	});

	it('reports everything rather than the first thing', () => {
		expect(
			review(`
				type Person { id: ID! old: String! @deprecated }
				type Query { people: [Person!]! }
				schema { query: Query }
			`).sort()
		).toEqual([
			'DEPRECATED_WITHOUT_REASON',
			'UNBOUNDED_LIST',
			'UNIDENTIFIED_OBJECT',
		]);
	});

	it('leaves the types every catalog has out of it', () => {
		expect(
			review(`
				type Person @identity { id: ID! }
				type Query { person: Person! }
				schema { query: Query }
			`)
		).toEqual([]);
	});
});
