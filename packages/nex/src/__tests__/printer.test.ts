/**
 * MIT License
 *
 * Copyright (c) 2025 Chris M. Perez
 */

import { describe, expect, it } from 'vitest';
import { parse } from '../language/parser/index.js';
import { print } from '../language/printer/index.js';

/** Strip locations so two parses can be compared structurally. */
const withoutLocations = (value: unknown): unknown => {
	if (Array.isArray(value)) return value.map(withoutLocations);
	if (value === null || typeof value !== 'object') return value;
	return Object.fromEntries(
		Object.entries(value as Record<string, unknown>)
			.filter(([key]) => key !== 'loc')
			.map(([key, entry]) => [key, withoutLocations(entry)])
	);
};

const roundTrip = (source: string): void => {
	const once = parse(source);
	const twice = parse(print(once));
	expect(withoutLocations(twice)).toEqual(withoutLocations(once));
};

describe('printer', () => {
	it('prints a query with variables, arguments, and nesting', () => {
		expect(print(parse('query A($id:ID!){owner:user(id:$id){name}}'))).toBe(
			[
				'query A($id: ID!) {',
				'  owner: user(id: $id) {',
				'    name',
				'  }',
				'}',
			].join('\n')
		);
	});

	it('prints a pipeline in written order', () => {
		expect(
			print(
				parse(
					'{posts|filter status==PUBLISHED and not(archived==true)|sort createdAt desc|page first:10 after:$cursor{title}}'
				)
			)
		).toBe(
			[
				'{',
				'  posts',
				'    | filter status == PUBLISHED and not (archived == true)',
				'    | sort createdAt desc',
				'    | page first: 10, after: $cursor {',
				'    title',
				'  }',
				'}',
			].join('\n')
		);
	});

	it('round-trips operations, fragments, values, and types', () => {
		roundTrip(`
			query GetPosts($status: Status = PUBLISHED, $limit: Int = 10, $tags: [String!]?) @cost(value: 5) {
				user(id: $id) {
					...UserCard
					... on Admin @include(if: $show) { level }
					posts | filter a.b >= 2 or c != null | take 3 | skip 1 | unique | search term: "nex" {
						title
						meta(shape: { tags: ["a", "b"], ratio: 1.5, missing: null, ok: false })
					}
				}
			}
			mutation Create($input: CreatePostInput!) { createPost(input: $input) { id } }
			live Feed { feed | page last: 5 before: $cursor { id } }
			fragment UserCard on User { id __typename }
		`);
	});

	it('round-trips block strings and escaped text', () => {
		roundTrip(
			'{ field(a: """\n  block\n  """, b: "quote \\" and \\\\ and \\n") }'
		);
	});
});

describe('printer: type system', () => {
	it('prints a catalog the way the specification writes it', () => {
		expect(
			print(
				parse(
					'schema{query:Query mutation:Mutation live:Live} type User implements Node{id:ID! email:String? posts(first:Int=10):[Post!]! @connection}'
				)
			)
		).toBe(
			[
				'schema {',
				'  query: Query',
				'  mutation: Mutation',
				'  live: Live',
				'}',
				'',
				'type User implements Node {',
				'  id: ID!',
				'  email: String?',
				'  posts(first: Int = 10): [Post!]! @connection',
				'}',
			].join('\n')
		);
	});

	it('round-trips every kind of catalog definition', () => {
		roundTrip(`
			"The root." schema @cost(value: 1) { query: Query }
			scalar DateTime @specifiedBy(url: "https://example.com")
			"A person."
			type User implements Node & Timestamped @key {
				"""Their id."""
				id: ID!
				status: Status = DRAFT
				posts(after: String, first: Int = 10): [Post!]! @connection
			}
			interface Node { id: ID! }
			union Media @shared = Photo | Video
			enum Status { DRAFT PUBLISHED ARCHIVED @deprecated(reason: "gone") }
			input CreatePostInput { title: String! tags: [String!] body: String = "" }
			directive @auth(requires: Role!) repeatable on FIELD | OBJECT
			query UsesIt { user { id } }
		`);
	});
});
