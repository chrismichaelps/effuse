/**
 * MIT License
 *
 * Copyright (c) 2025 Chris M. Perez
 */

import { describe, expect, it } from 'vitest';
import { buildCatalog, generateTypes } from '../index.js';

const catalog = buildCatalog(`
	schema { query: Query mutation: Mutation }

	type Query {
		hello: String!
		me: User
		posts(status: Status): [Post!]! @connection
		tags: [String!]!
		node: Node
		media: Media
		when: DateTime!
	}
	type Mutation { createPost(input: NewPost!): Post! }

	interface Node { id: ID! }
	type User implements Node { id: ID! name: String! nickname: String? age: Int }
	type Post implements Node { id: ID! title: String! status: Status! author: User! }
	type Photo { url: String! }
	union Media = User | Photo

	enum Status { DRAFT PUBLISHED }
	input NewPost { title: String! draft: Boolean = true tags: [String!] size: Int! = 5 }
	scalar DateTime
`);

const generated = (source: string) => generateTypes(source, catalog);

describe('the shape a request comes back as', () => {
	it('writes scalars, with null where the catalog allows it', () => {
		expect(generated('query A { hello when }')).toContain(
			[
				'export type AData = {',
				'\thello: string;',
				'\twhen: string;',
				'};',
			].join('\n')
		);
	});

	it('marks a nullable field as possibly null', () => {
		const types = generated('query A { me { name nickname age } }');

		expect(types).toContain('me: {');
		expect(types).toContain('name: string;');
		expect(types).toContain('nickname: string | null;');
		expect(types).toContain('age: number | null;');
		expect(types).toMatch(/\}\s*\|\s*null;/);
	});

	it('writes a list as an array', () => {
		expect(generated('query A { tags }')).toContain('tags: string[];');
	});

	it('writes the page shape when a request pages', () => {
		const types = generated('query A { posts | page first: 2 { title } }');

		expect(types).toContain('items: {');
		expect(types).toContain('hasNextPage: boolean;');
		expect(types).toContain('endCursor: string | null;');
		expect(types).toContain('totalCount: number;');
	});

	it('writes a plain array when a request does not page', () => {
		expect(generated('query A { posts | take 2 { title } }')).toContain(
			'posts: {'
		);
		expect(generated('query A { posts | take 2 { title } }')).toContain('}[];');
	});

	it('writes an enum as the values it can take', () => {
		expect(generated('query A { posts { status } }')).toContain(
			"status: 'DRAFT' | 'PUBLISHED';"
		);
	});

	it('follows an alias', () => {
		expect(generated('query A { greeting: hello }')).toContain(
			'greeting: string;'
		);
	});

	it('follows a fragment', () => {
		expect(
			generated('query A { me { ...U } } fragment U on User { name }')
		).toContain('name: string;');
	});

	it('writes __typename as the type it will be', () => {
		expect(generated('query A { me { __typename } }')).toContain(
			"__typename: 'User';"
		);
	});
});

describe('the whole of what it writes', () => {
	it('reads as source a person would have written', () => {
		expect(
			generateTypes(
				'query Feed($status: Status) { posts(status: $status) | page first: 2 { title author { name } } me { name } }',
				catalog
			)
		).toBe(
			[
				'export type FeedVariables = {',
				"\tstatus?: 'DRAFT' | 'PUBLISHED' | null;",
				'};',
				'',
				'export type FeedData = {',
				'\tposts: {',
				'\t\titems: {',
				'\t\t\ttitle: string;',
				'\t\t\tauthor: {',
				'\t\t\t\tname: string;',
				'\t\t\t};',
				'\t\t}[];',
				'\t\tpageInfo: {',
				'\t\t\thasNextPage: boolean;',
				'\t\t\thasPreviousPage: boolean;',
				'\t\t\tstartCursor: string | null;',
				'\t\t\tendCursor: string | null;',
				'\t\t};',
				'\t\ttotalCount: number;',
				'\t};',
				'\tme: {',
				'\t\tname: string;',
				'\t} | null;',
				'};',
				'',
			].join('\n')
		);
	});
});

describe('a request that asks about an abstract type', () => {
	it('writes one shape per branch', () => {
		const types = generated(
			'query A { media { __typename ... on User { name } ... on Photo { url } } }'
		);

		expect(types).toContain("__typename: 'User';");
		expect(types).toContain("__typename: 'Photo';");
		expect(types).toMatch(/\}\s*\|\s*\{/);
	});

	it('keeps what was asked of the interface itself in every branch', () => {
		const types = generated('query A { node { id ... on User { name } } }');

		expect(types).toContain('id: string;');
		expect(types).toContain('name: string;');
	});
});

describe('the variables a request takes', () => {
	it('writes each one, optional when it has a default', () => {
		const types = generateTypes(
			'query A($status: Status, $limit: Int = 10) { posts(status: $status) | take $limit { title } }',
			catalog
		);

		expect(types).toContain('export type AVariables = {');
		expect(types).toContain("status?: 'DRAFT' | 'PUBLISHED' | null;");
		expect(types).toContain('limit?: number | null;');
	});

	it('makes a required variable optional when it has a default', () => {
		const types = generateTypes(
			'query A($limit: Int! = 10) { posts | take $limit { title } }',
			catalog
		);

		expect(types).toContain('limit?: number;');
	});

	it('makes a required input field optional when it has a default', () => {
		const types = generateTypes(
			'mutation M($input: NewPost!) { createPost(input: $input) { id } }',
			catalog
		);

		expect(types).toContain('size?: number;');
	});

	it('writes an input object as an object', () => {
		const types = generateTypes(
			'mutation M($input: NewPost!) { createPost(input: $input) { id } }',
			catalog
		);

		expect(types).toContain('export type MVariables = {');
		expect(types).toContain('input: {');
		expect(types).toContain('title: string;');
		expect(types).toContain('draft?: boolean | null;');
		expect(types).toContain('tags?: string[] | null;');
	});

	it('writes nothing when a request takes none', () => {
		expect(generated('query A { hello }')).not.toContain('AVariables');
	});
});

describe('naming what it writes', () => {
	it('names types after the operation', () => {
		const types = generateTypes('query Feed { hello }', catalog);

		expect(types).toContain('export type FeedData = {');
	});

	it('names an anonymous operation for what it is', () => {
		expect(generated('{ hello }')).toContain('export type AnonymousData = {');
	});

	it('writes every operation in the document', () => {
		const types = generateTypes('query A { hello } query B { tags }', catalog);

		expect(types).toContain('export type AData = {');
		expect(types).toContain('export type BData = {');
	});

	it('refuses a request that does not agree with the catalog', () => {
		expect(() => generated('query A { nope }')).toThrowError(
			/Cannot query field "nope"/
		);
	});
});
