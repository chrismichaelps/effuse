/**
 * MIT License
 *
 * Copyright (c) 2025 Chris M. Perez
 */

import { describe, expect, it } from 'vitest';
import {
	buildCatalog,
	execute,
	mergeCatalogs,
	mergeCatalogsSafe,
	printCatalog,
} from '../index.js';

const people = buildCatalog(`
	type Person { id: ID! name: String! }
	type Query { person(id: ID!): Person? }
	schema { query: Query }
`);

const posts = buildCatalog(`
	type Post { id: ID! title: String! }
	type Query { posts: [Post!]! }
	schema { query: Query }
`);

describe('merging catalogs', () => {
	it('keeps the types every source brought', () => {
		const merged = mergeCatalogs(people, posts);

		expect(merged.getType('Person')).toBeDefined();
		expect(merged.getType('Post')).toBeDefined();
	});

	it('joins the roots the sources share', () => {
		const merged = mergeCatalogs(people, posts);

		expect(merged.getField('Query', 'person')).toBeDefined();
		expect(merged.getField('Query', 'posts')).toBeDefined();
	});

	it('runs a request that reaches across sources', async () => {
		const merged = mergeCatalogs(people, posts);

		const result = await execute({
			request: '{ person(id: "1") { name } posts { title } }',
			catalog: merged,
			resolvers: {
				Query: {
					person: () => ({ id: '1', name: 'Ada' }),
					posts: () => [{ id: '1', title: 'On engines' }],
				},
			},
		});

		expect(result.errors).toBeUndefined();
		expect(result.data).toEqual({
			person: { name: 'Ada' },
			posts: [{ title: 'On engines' }],
		});
	});

	it('takes a single catalog as itself', () => {
		const merged = mergeCatalogs(people);

		expect(printCatalog(merged)).toBe(printCatalog(people));
	});

	it('refuses to merge nothing', () => {
		expect(() => mergeCatalogs()).toThrow(/at least one catalog/i);
	});

	it('keeps a root a source names for itself', () => {
		const named = buildCatalog(`
			type Root { now: String! }
			schema { query: Root }
		`);

		const merged = mergeCatalogs(named, posts);

		expect(merged.getField('Root', 'now')).toBeDefined();
		expect(merged.getField('Query', 'posts')).toBeDefined();
	});

	it('answers from one root however the sources named theirs', async () => {
		const named = buildCatalog(`
			type Root { now: String! }
			schema { query: Root }
		`);

		const merged = mergeCatalogs(named, posts);

		const result = await execute({
			request: '{ now posts { title } }',
			catalog: merged,
			resolvers: {
				Root: {
					now: () => 'noon',
					posts: () => [{ id: '1', title: 'On engines' }],
				},
			},
		});

		expect(result.errors).toBeUndefined();
		expect(result.data).toEqual({
			now: 'noon',
			posts: [{ title: 'On engines' }],
		});
	});

	it('joins the members of a union each source knows part of', () => {
		const left = buildCatalog(`
			type Person { id: ID! }
			union Actor = Person
			type Query { actor: Actor? }
			schema { query: Query }
		`);
		const right = buildCatalog(`
			type Robot { id: ID! }
			union Actor = Robot
			type Query { other: String? }
			schema { query: Query }
		`);

		const merged = mergeCatalogs(left, right);
		const members = merged
			.getPossibleTypes('Actor')
			.map((one) => one.name.value);

		expect(members).toEqual(['Person', 'Robot']);
	});

	it('keeps an interface every source implements', () => {
		const left = buildCatalog(`
			interface Node { id: ID! }
			type Person implements Node { id: ID! }
			type Query { person: Person? }
			schema { query: Query }
		`);
		const right = buildCatalog(`
			interface Node { id: ID! }
			type Post implements Node { id: ID! }
			type Query { post: Post? }
			schema { query: Query }
		`);

		const merged = mergeCatalogs(left, right);
		const kinds = merged.getPossibleTypes('Node').map((one) => one.name.value);

		expect(kinds).toEqual(['Person', 'Post']);
	});

	it('keeps a directive the sources define the same way', () => {
		const left = buildCatalog(`
			directive @tag(name: String!) on FIELD_DEFINITION
			type Query { a: String! }
			schema { query: Query }
		`);
		const right = buildCatalog(`
			directive @tag(name: String!) on FIELD_DEFINITION
			type Query { b: String! }
			schema { query: Query }
		`);

		expect(mergeCatalogs(left, right).getDirective('tag')).toBeDefined();
	});
});

describe('what a merge refuses', () => {
	const errorsOf = (...catalogs: Parameters<typeof mergeCatalogsSafe>) => {
		const merged = mergeCatalogsSafe(...catalogs);
		if (merged.success) throw new Error('the merge was expected to fail');
		return merged.errors.map((error) => error.message);
	};

	it('refuses a field two sources declare differently', () => {
		const left = buildCatalog(`
			type Query { thing: String! }
			schema { query: Query }
		`);
		const right = buildCatalog(`
			type Query { thing: Int! }
			schema { query: Query }
		`);

		expect(errorsOf(left, right)).toEqual([
			expect.stringMatching(/"Query.thing" is declared differently/),
		]);
	});

	it('refuses a name two sources give different kinds', () => {
		const left = buildCatalog(`
			type Thing { id: ID! }
			type Query { a: Thing! }
			schema { query: Query }
		`);
		const right = buildCatalog(`
			scalar Thing
			type Query { b: Thing! }
			schema { query: Query }
		`);

		expect(errorsOf(left, right)).toEqual([
			expect.stringMatching(/"Thing" is an object type in one source/),
		]);
	});

	it('refuses an input type the sources disagree about', () => {
		const left = buildCatalog(`
			input Filter { name: String? }
			type Query { a(filter: Filter?): String! }
			schema { query: Query }
		`);
		const right = buildCatalog(`
			input Filter { name: String? age: Int? }
			type Query { b(filter: Filter?): String! }
			schema { query: Query }
		`);

		expect(errorsOf(left, right)).toEqual([
			expect.stringMatching(/"Filter" is declared differently/),
		]);
	});

	it('refuses an enum the sources disagree about', () => {
		const left = buildCatalog(`
			enum Colour { RED }
			type Query { a: Colour! }
			schema { query: Query }
		`);
		const right = buildCatalog(`
			enum Colour { RED GREEN }
			type Query { b: Colour! }
			schema { query: Query }
		`);

		expect(errorsOf(left, right)).toEqual([
			expect.stringMatching(/"Colour" is declared differently/),
		]);
	});

	it('refuses a directive the sources define differently', () => {
		const left = buildCatalog(`
			directive @tag(name: String!) on FIELD_DEFINITION
			type Query { a: String! }
			schema { query: Query }
		`);
		const right = buildCatalog(`
			directive @tag(name: Int!) on FIELD_DEFINITION
			type Query { b: String! }
			schema { query: Query }
		`);

		expect(errorsOf(left, right)).toEqual([
			expect.stringMatching(/"@tag" is defined differently/),
		]);
	});

	it('reports every disagreement rather than the first', () => {
		const left = buildCatalog(`
			type Query { a: String! b: String! }
			schema { query: Query }
		`);
		const right = buildCatalog(`
			type Query { a: Int! b: Int! }
			schema { query: Query }
		`);

		expect(errorsOf(left, right)).toHaveLength(2);
	});

	it('says where a merged catalog stops hanging together', () => {
		const left = buildCatalog(`
			type Query { a: String! }
			schema { query: Query }
		`);
		const right = buildCatalog(`
			type Person implements Node { id: ID! }
			interface Node { id: ID! }
			type Query { person: Person? }
			schema { query: Query }
		`);

		expect(mergeCatalogsSafe(left, right).success).toBe(true);
	});

	it('throws the disagreements when merged without a net', () => {
		const left = buildCatalog(`
			type Query { thing: String! }
			schema { query: Query }
		`);
		const right = buildCatalog(`
			type Query { thing: Int! }
			schema { query: Query }
		`);

		expect(() => mergeCatalogs(left, right)).toThrow(/declared differently/);
	});
});
