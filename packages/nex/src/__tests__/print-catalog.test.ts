/**
 * MIT License
 *
 * Copyright (c) 2025 Chris M. Perez
 */

import { describe, expect, it } from 'vitest';
import { buildCatalog, parse, printCatalog } from '../index.js';

const roundTrip = (source: string): string =>
	printCatalog(buildCatalog(source));

describe('printing a catalog', () => {
	it('renders types the way they were written', () => {
		expect(
			roundTrip(`
				"A person."
				type Query { me: User posts(status: Status = PUBLISHED): [Post!]! @connection }
				type User { id: ID! nickname: String? }
				type Post { id: ID! }
				enum Status { DRAFT PUBLISHED }
			`)
		).toContain('"A person."\ntype Query {');
	});

	it('renders every kind of definition', () => {
		const printed = roundTrip(`
			schema { query: Query }
			type Query { node: Node m: Media s: DateTime f(input: Filter): Int }
			interface Node { id: ID! }
			type User implements Node { id: ID! }
			type Photo { url: String! }
			union Media = User | Photo
			enum Status { DRAFT }
			input Filter { term: String! }
			scalar DateTime
			directive @tag(name: String!) repeatable on FIELD
		`);

		for (const fragment of [
			'schema {',
			'type Query {',
			'interface Node {',
			'type User implements Node {',
			'union Media = User | Photo',
			'enum Status {',
			'input Filter {',
			'scalar DateTime',
			'directive @tag(name: String!) repeatable on FIELD',
		]) {
			expect(printed).toContain(fragment);
		}
	});

	it('carries extensions into the type they extended', () => {
		const printed = roundTrip(`
			type Query { a: Int }
			type User { id: ID! }
			extend type User { nickname: String? }
		`);

		expect(printed).toContain('nickname: String?');
		expect(printed).not.toContain('extend');
	});

	it('leaves the directives a catalog did not declare out of it', () => {
		const printed = roundTrip('type Query { a: Int }');

		expect(printed).not.toContain('directive @include');
		expect(printed).not.toContain('directive @connection');
	});

	it('prints something that builds back into the same catalog', () => {
		const source = `
			schema { query: Query mutation: Mutation }
			type Query { posts(status: Status): [Post!]! @connection }
			type Mutation { createPost(input: NewPost!): Post! }
			type Post { id: ID! title: String! status: Status! }
			enum Status { DRAFT PUBLISHED }
			input NewPost { title: String! draft: Boolean = true }
		`;
		const once = roundTrip(source);
		const twice = printCatalog(buildCatalog(once));

		expect(twice).toBe(once);
		expect(parse(once).definitions.length).toBeGreaterThan(0);
	});
});
