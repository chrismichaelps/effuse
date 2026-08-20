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

describe('a graph shaped like a table', () => {
	it('says a field holding a key should hold the thing', () => {
		expect(
			review(`
				type Author @identity { id: ID! }
				type Post @identity { id: ID! authorId: ID! }
				type Query { post: Post! }
				schema { query: Query }
			`)
		).toContain('FOREIGN_KEY');
	});

	it('names what to return instead', () => {
		const [notice] = notices(`
			type Author @identity { id: ID! }
			type Post @identity { id: ID! authorId: ID! }
			type Query { post: Post! }
			schema { query: Query }
		`).filter((one) => one.code === 'FOREIGN_KEY');

		expect(notice?.coordinate).toBe('Post.authorId');
		expect(notice?.message).toMatch(/"Author"/);
	});

	it('says the same about a list of keys', () => {
		expect(
			review(`
				type Tag @identity { id: ID! }
				type Post @identity { id: ID! tagIds: [ID!]! }
				type Query { post: Post! }
				schema { query: Query }
			`)
		).toContain('FOREIGN_KEY');
	});

	it('says nothing when there is no such type to return', () => {
		expect(
			review(`
				type Post @identity { id: ID! externalId: ID! }
				type Query { post: Post! }
				schema { query: Query }
			`)
		).not.toContain('FOREIGN_KEY');
	});

	it('does not tell a type to answer with itself', () => {
		// "Person.personId" is the type's own identifier under a longer name;
		// answering with "Person" is not something to suggest.
		expect(
			review(`
				type Person @identity { id: ID! personId: ID! }
				type Query { person: Person! }
				schema { query: Query }
			`)
		).not.toContain('FOREIGN_KEY');
	});

	it('leaves a type its own identifier', () => {
		expect(
			review(`
				type Post @identity { id: ID! }
				type Query { post: Post! }
				schema { query: Query }
			`)
		).not.toContain('FOREIGN_KEY');
	});
});

describe('names that do not read like the rest', () => {
	it('says a type should be written like a type', () => {
		expect(
			review(`
				type person @identity { id: ID! }
				type Query { person: person! }
				schema { query: Query }
			`)
		).toContain('UNCONVENTIONAL_NAME');
	});

	it('says a field should be written like a field', () => {
		expect(
			review(`
				type Person @identity { id: ID! FullName: String! }
				type Query { person: Person! }
				schema { query: Query }
			`)
		).toContain('UNCONVENTIONAL_NAME');
	});

	it('says an enum value should be written like one', () => {
		expect(
			review(`
				enum Colour { Red }
				type Person @identity { id: ID! colour: Colour! }
				type Query { person: Person! }
				schema { query: Query }
			`)
		).toContain('UNCONVENTIONAL_NAME');
	});

	it('says an argument should be written like a field', () => {
		expect(
			review(`
				type Person @identity { id: ID! name(Upper: Boolean?): String! }
				type Query { person: Person! }
				schema { query: Query }
			`)
		).toContain('UNCONVENTIONAL_NAME');
	});

	it('says a field should not repeat what asking already means', () => {
		expect(
			review(`
				type Person @identity { id: ID! }
				type Query { getPerson: Person! }
				schema { query: Query }
			`)
		).toContain('REDUNDANT_NAME');
	});

	it('says it only where asking is the whole point', () => {
		// On a root, the verb repeats the request. Further in, a field named
		// this way is a house style rather than a redundancy.
		expect(
			review(`
				type Address { city: String! }
				type Person @identity { id: ID! getAddress: Address! }
				type Query { person: Person! }
				schema { query: Query }
			`)
		).not.toContain('REDUNDANT_NAME');
	});

	it('leaves a name that happens to start with those letters alone', () => {
		expect(
			review(`
				type Person @identity { id: ID! }
				type Query { getaway: Person! settings: Person! }
				schema { query: Query }
			`)
		).not.toContain('REDUNDANT_NAME');
	});

	it('says nothing about a catalog that reads the same way throughout', () => {
		expect(
			review(`
				enum Colour { RED DEEP_BLUE }
				type Person @identity { id: ID! fullName(upper: Boolean?): String! colour: Colour! }
				type Query { person: Person! }
				schema { query: Query }
			`)
		).toEqual([]);
	});
});

describe('a review a catalog can disagree with', () => {
	const source = `
		type person @identity { id: ID! }
		type Query { getPerson: person! }
		schema { query: Query }
	`;

	it('leaves names alone when asked to', () => {
		const found = reviewCatalog(buildCatalog(source), { naming: false }).map(
			(one) => one.code
		);

		expect(found).not.toContain('UNCONVENTIONAL_NAME');
		expect(found).not.toContain('REDUNDANT_NAME');
	});

	it('still says what would actually break', () => {
		const relational = `
			type Author @identity { id: ID! }
			type Post @identity { id: ID! authorId: ID! }
			type Query { posts: [Post!]! }
			schema { query: Query }
		`;
		const found = reviewCatalog(buildCatalog(relational), {
			naming: false,
		}).map((one) => one.code);

		expect(found).toContain('UNBOUNDED_LIST');
		expect(found).toContain('FOREIGN_KEY');
	});
});
