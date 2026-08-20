/**
 * MIT License
 *
 * Copyright (c) 2025 Chris M. Perez
 */

import { describe, expect, it } from 'vitest';
import {
	ChangeSeverity,
	buildCatalog,
	compareCatalogs,
	findBrokenOperations,
} from '../index.js';

const before = buildCatalog(`
	type Query {
		posts(status: Status, first: Int): [Post!]! @connection
		me: User
		legacy: String
	}
	type Post { id: ID! title: String! body: String }
	type User { id: ID! name: String! }
	enum Status { DRAFT PUBLISHED }
	input NewPost { title: String! subtitle: String }
	interface Node { id: ID! }
`);

const changes = (source: string) =>
	compareCatalogs(before, buildCatalog(source)).map((change) => ({
		severity: change.severity,
		coordinate: change.coordinate,
	}));

const after = (extra: string) => `
	type Query {
		posts(status: Status, first: Int): [Post!]! @connection
		me: User
		legacy: String
	}
	type Post { id: ID! title: String! body: String }
	type User { id: ID! name: String! }
	enum Status { DRAFT PUBLISHED }
	input NewPost { title: String! subtitle: String }
	interface Node { id: ID! }
	${extra}
`;

describe('what changed between two catalogs', () => {
	it('says nothing when nothing changed', () => {
		expect(compareCatalogs(before, before)).toEqual([]);
	});

	it('reports a type that left', () => {
		const removed = changes(`
			type Query { posts(status: Status, first: Int): [Post!]! @connection me: User legacy: String }
			type Post { id: ID! title: String! body: String }
			type User { id: ID! name: String! }
			enum Status { DRAFT PUBLISHED }
			input NewPost { title: String! subtitle: String }
		`);

		expect(removed).toContainEqual({
			severity: ChangeSeverity.BREAKING,
			coordinate: 'Node',
		});
	});

	it('reports a field that left, and one that arrived', () => {
		const edited = changes(`
			type Query { posts(status: Status, first: Int): [Post!]! @connection me: User }
			type Post { id: ID! title: String! body: String byline: String }
			type User { id: ID! name: String! }
			enum Status { DRAFT PUBLISHED }
			input NewPost { title: String! subtitle: String }
			interface Node { id: ID! }
		`);

		expect(edited).toContainEqual({
			severity: ChangeSeverity.BREAKING,
			coordinate: 'Query.legacy',
		});
		expect(edited).toContainEqual({
			severity: ChangeSeverity.SAFE,
			coordinate: 'Post.byline',
		});
	});

	it('reports a field whose type changed', () => {
		const edited = changes(`
			type Query { posts(status: Status, first: Int): [Post!]! @connection me: User legacy: Int }
			type Post { id: ID! title: String! body: String }
			type User { id: ID! name: String! }
			enum Status { DRAFT PUBLISHED }
			input NewPost { title: String! subtitle: String }
			interface Node { id: ID! }
		`);

		expect(edited).toContainEqual({
			severity: ChangeSeverity.BREAKING,
			coordinate: 'Query.legacy',
		});
	});

	it('treats a field becoming non-null as safe, and nullable as breaking', () => {
		const stricter = changes(`
			type Query { posts(status: Status, first: Int): [Post!]! @connection me: User legacy: String! }
			type Post { id: ID! title: String! body: String }
			type User { id: ID! name: String! }
			enum Status { DRAFT PUBLISHED }
			input NewPost { title: String! subtitle: String }
			interface Node { id: ID! }
		`);
		const looser = changes(`
			type Query { posts(status: Status, first: Int): [Post!]! @connection me: User legacy: String }
			type Post { id: ID! title: String body: String }
			type User { id: ID! name: String! }
			enum Status { DRAFT PUBLISHED }
			input NewPost { title: String! subtitle: String }
			interface Node { id: ID! }
		`);

		expect(stricter).toContainEqual({
			severity: ChangeSeverity.SAFE,
			coordinate: 'Query.legacy',
		});
		expect(looser).toContainEqual({
			severity: ChangeSeverity.BREAKING,
			coordinate: 'Post.title',
		});
	});

	it('reports an argument that arrived required, and one that left', () => {
		const edited = changes(`
			type Query { posts(status: Status, first: Int, required: Int!): [Post!]! @connection me: User legacy: String }
			type Post { id: ID! title: String! body: String }
			type User { id: ID! name: String! }
			enum Status { DRAFT PUBLISHED }
			input NewPost { title: String! subtitle: String }
			interface Node { id: ID! }
		`);

		expect(edited).toContainEqual({
			severity: ChangeSeverity.BREAKING,
			coordinate: 'Query.posts(required:)',
		});
	});

	it('reports an enum value that left as breaking, and one that arrived as risky', () => {
		const edited = changes(`
			type Query { posts(status: Status, first: Int): [Post!]! @connection me: User legacy: String }
			type Post { id: ID! title: String! body: String }
			type User { id: ID! name: String! }
			enum Status { DRAFT SCHEDULED }
			input NewPost { title: String! subtitle: String }
			interface Node { id: ID! }
		`);

		expect(edited).toContainEqual({
			severity: ChangeSeverity.BREAKING,
			coordinate: 'Status.PUBLISHED',
		});
		expect(edited).toContainEqual({
			severity: ChangeSeverity.RISKY,
			coordinate: 'Status.SCHEDULED',
		});
	});

	it('reports an input field that arrived required as breaking', () => {
		const edited = changes(`
			type Query { posts(status: Status, first: Int): [Post!]! @connection me: User legacy: String }
			type Post { id: ID! title: String! body: String }
			type User { id: ID! name: String! }
			enum Status { DRAFT PUBLISHED }
			input NewPost { title: String! subtitle: String extra: Int! }
			interface Node { id: ID! }
		`);

		expect(edited).toContainEqual({
			severity: ChangeSeverity.BREAKING,
			coordinate: 'NewPost.extra',
		});
	});

	it('says what happened in words', () => {
		const [change] = compareCatalogs(
			before,
			buildCatalog(after('type Extra { a: Int }'))
		);

		expect(change?.message).toMatch(/"Extra" was added/);
	});
});

describe('which operations a change would break', () => {
	const operations = [
		'query Feed { posts | page first: 2 { title body } }',
		'query Me { me { name } }',
	];

	it('says nothing when every operation still runs', () => {
		expect(findBrokenOperations(operations, before)).toEqual([]);
	});

	it('names the operation that stopped working, and why', () => {
		const changed = buildCatalog(`
			type Query { posts(status: Status): [Post!]! @connection me: User }
			type Post { id: ID! title: String! }
			type User { id: ID! name: String! }
			enum Status { DRAFT PUBLISHED }
		`);
		const broken = findBrokenOperations(operations, changed);

		expect(broken).toHaveLength(1);
		expect(broken[0]?.operation).toContain('query Feed');
		expect(broken[0]?.problems[0]?.message).toMatch(
			/Cannot query field "body" on type "Post"/
		);
	});

	it('reads the operations a store holds', async () => {
		const { createOperationStore } = await import('../index.js');
		const store = createOperationStore();
		await store.register('query Me { me { name } }');
		await store.register('query Gone { legacy }');

		const changed = buildCatalog(`
			type Query { me: User }
			type User { id: ID! name: String! }
		`);

		expect(findBrokenOperations(store, changed)).toHaveLength(1);
	});
});
