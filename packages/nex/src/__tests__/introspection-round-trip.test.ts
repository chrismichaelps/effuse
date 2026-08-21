/**
 * MIT License
 *
 * Copyright (c) 2025 Chris M. Perez
 */

import { describe, expect, it } from 'vitest';
import {
	buildCatalog,
	buildCatalogFromIntrospection,
	introspectionFromCatalog,
	printCatalog,
} from '../index.js';

/**
 * Everything the catalog model can express, in one catalog.
 *
 * A client that only ever sees a server through introspection has to be able
 * to rebuild what the server holds - so anything this model gains has to
 * survive the trip, and this is where that is found out.
 */
const EVERYTHING = `
	"Someone with an account."
	type Person implements Named @identity @tag(name: "people") {
		id: ID!
		"What they are called."
		name: String!
		old: String? @deprecated(reason: "Use name")
		friends: [Person!]! @connection
	}
	type Robot implements Named @identity(field: "serial") {
		serial: String!
		name: String!
	}
	"Anything with a name."
	interface Named { name: String! }
	union Actor = Person | Robot
	"How far along something is."
	enum Status { DRAFT PUBLISHED RETIRED @deprecated(reason: "No longer used") }
	input Filter { status: Status? limit: Int! = 10 name: String? = "any" }
	scalar Money
	directive @tag(name: String!, weight: Int? = 1) on FIELD_DEFINITION | OBJECT
	type Query {
		actor: Actor!
		named: Named!
		people(filter: Filter?): [Person!]! @connection
		price: Money! @cost(value: 5)
		secret: String! @auth(requires: "member")
		tagged: String! @tag(name: "one")
	}
	type Mutation { rename(id: ID!, to: String!): Person! }
	type Live { changed: Person! }
	schema { query: Query, mutation: Mutation, live: Live }
`;

describe('a catalog seen only through introspection', () => {
	it('is rebuilt as exactly what it was', async () => {
		const original = buildCatalog(EVERYTHING);
		const rebuilt = buildCatalogFromIntrospection(
			await introspectionFromCatalog(original)
		);

		// One assertion over everything the model can say: whatever is added
		// to it later has to survive this trip, or a client that only sees the
		// server through introspection cannot know about it.
		expect(printCatalog(rebuilt)).toBe(printCatalog(original));
	});

	it('keeps every root it was given', async () => {
		const original = buildCatalog(EVERYTHING);
		const rebuilt = buildCatalogFromIntrospection(
			await introspectionFromCatalog(original)
		);

		expect(rebuilt.getRootType('query')?.name.value).toBe('Query');
		expect(rebuilt.getRootType('mutation')?.name.value).toBe('Mutation');
		expect(rebuilt.getRootType('live')?.name.value).toBe('Live');
	});

	it('keeps what a type identifies by', async () => {
		const original = buildCatalog(EVERYTHING);
		const rebuilt = buildCatalogFromIntrospection(
			await introspectionFromCatalog(original)
		);

		expect(rebuilt.identityField('Person')).toBe('id');
		expect(rebuilt.identityField('Robot')).toBe('serial');
		expect(rebuilt.identityField('Named')).toBeUndefined();
	});

	it('keeps what a union and an interface hold', async () => {
		const original = buildCatalog(EVERYTHING);
		const rebuilt = buildCatalogFromIntrospection(
			await introspectionFromCatalog(original)
		);

		const of = (name: string) =>
			rebuilt
				.getPossibleTypes(name)
				.map((one) => one.name.value)
				.sort();

		expect(of('Actor')).toEqual(['Person', 'Robot']);
		expect(of('Named')).toEqual(['Person', 'Robot']);
	});

	it('keeps a directive written on a type', async () => {
		const original = buildCatalog(EVERYTHING);
		const rebuilt = buildCatalogFromIntrospection(
			await introspectionFromCatalog(original)
		);

		expect(printCatalog(rebuilt)).toContain('@tag(name: "people")');
	});

	it('keeps a directive a catalog declared, arguments and all', async () => {
		const original = buildCatalog(EVERYTHING);
		const rebuilt = buildCatalogFromIntrospection(
			await introspectionFromCatalog(original)
		);

		const tag = rebuilt.getDirective('tag');
		expect(tag?.arguments?.map((one) => one.name.value)).toEqual([
			'name',
			'weight',
		]);
	});

	it('survives being sent round twice', async () => {
		const original = buildCatalog(EVERYTHING);
		const once = buildCatalogFromIntrospection(
			await introspectionFromCatalog(original)
		);
		const twice = buildCatalogFromIntrospection(
			await introspectionFromCatalog(once)
		);

		// A gateway may sit in front of another, so the trip happens more than
		// once and must not lose a little each time.
		expect(printCatalog(twice)).toBe(printCatalog(original));
	});
});
