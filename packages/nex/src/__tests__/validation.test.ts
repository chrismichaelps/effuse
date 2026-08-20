/**
 * MIT License
 *
 * Copyright (c) 2025 Chris M. Perez
 */

import { describe, expect, it } from 'vitest';
import { NexValidationError, buildCatalog, validateRequest } from '../index.js';

const catalog = buildCatalog(`
	schema { query: Query mutation: Mutation }

	type Query {
		user(id: ID!, verbose: Boolean = false): User
		posts(status: Status): [Post!]! @connection
		tags: [String!]!
		node: Node
		media: Media
	}

	type Mutation { createPost(input: CreatePostInput!): Post! }

	interface Node { id: ID! }

	type User implements Node {
		id: ID!
		name: String!
		nickname: String?
		age: Int
		posts: [Post!]! @connection
		drafts: [Post!]!
	}

	type Post implements Node {
		id: ID!
		title: String!
		status: Status!
		createdAt: DateTime!
		author: User!
	}

	type Photo { url: String! }
	union Media = Photo | Post

	enum Status { DRAFT PUBLISHED ARCHIVED }
	input CreatePostInput { title: String! tags: [String!] }
	scalar DateTime
`);

/** Validate `source` and return the messages, in order. */
const messages = (source: string): readonly string[] =>
	validateRequest(source, catalog).map((error) => error.message);

/** Assert a request is accepted. */
const accepts = (source: string): void => {
	expect(validateRequest(source, catalog)).toEqual([]);
};

describe('valid requests', () => {
	it('accepts a request that uses every language feature', () => {
		accepts(`
			query Feed($status: Status = PUBLISHED, $limit: Int = 10, $cursor: String) @cost(value: 5) {
				user(id: "1") {
					...UserCard
					nickname
					posts
						| filter status == $status and not (title != "")
						| sort createdAt desc
						| page first: $limit after: $cursor {
							title
							author { name }
						}
				}
				node { __typename ... on User { name } }
				media { ... on Photo { url } }
				tags
			}
			fragment UserCard on User { id name @include(if: true) }
		`);
	});

	it('accepts a mutation against the mutation root', () => {
		accepts(
			'mutation M($input: CreatePostInput!) { createPost(input: $input) { id } }'
		);
	});
});

describe('operations', () => {
	it('rejects duplicate operation names', () => {
		expect(messages('query A { tags } query A { tags }')).toEqual([
			'There can be only one operation named "A"',
		]);
	});

	it('rejects an anonymous operation alongside another operation', () => {
		expect(messages('{ tags } query A { tags }')[0]).toMatch(
			/anonymous operation/i
		);
	});

	it('rejects an operation whose root type the catalog does not define', () => {
		expect(messages('live L { tags }')[0]).toMatch(/live.*root type/i);
	});
});

describe('fields', () => {
	it('rejects a field the parent type does not declare', () => {
		expect(messages('{ user(id: "1") { missing } }')[0]).toMatch(
			/Cannot query field "missing" on type "User"/
		);
	});

	it('requires a selection set on a composite field', () => {
		expect(messages('{ user(id: "1") }')[0]).toMatch(/must have a selection/i);
	});

	it('rejects a selection set on a leaf field', () => {
		expect(messages('{ tags { length } }')[0]).toMatch(
			/cannot have a selection/i
		);
	});

	it('allows __typename anywhere, including on a union', () => {
		accepts('{ media { __typename } user(id: "1") { __typename } }');
	});

	it('rejects a direct field selection on a union type', () => {
		expect(messages('{ media { url } }')[0]).toMatch(/union type "Media"/i);
	});
});

describe('arguments', () => {
	it('rejects an unknown argument', () => {
		expect(messages('{ user(id: "1", nope: 1) { id } }')[0]).toMatch(
			/Unknown argument "nope"/
		);
	});

	it('rejects a duplicate argument', () => {
		expect(messages('{ user(id: "1", id: "2") { id } }')[0]).toMatch(
			/provided more than once/i
		);
	});

	it('rejects a missing required argument', () => {
		expect(messages('{ user(verbose: true) { id } }')[0]).toMatch(
			/Argument "id" of type "ID!" is required/
		);
	});

	it('rejects a value of the wrong type', () => {
		expect(messages('{ user(id: "1", verbose: 3) { id } }')[0]).toMatch(
			/Boolean/
		);
		expect(messages('{ posts(status: NOPE) { id } }')[0]).toMatch(
			/"NOPE" is not a member of enum "Status"/
		);
	});

	it('rejects null for a non-null argument', () => {
		expect(messages('{ user(id: null) { id } }')[0]).toMatch(/cannot be null/i);
	});

	it('checks the fields of an input object', () => {
		expect(
			messages('mutation { createPost(input: { tags: ["a"] }) { id } }')[0]
		).toMatch(/Field "title" of input type "CreatePostInput" is required/);
		expect(
			messages(
				'mutation { createPost(input: { title: "t", nope: 1 }) { id } }'
			)[0]
		).toMatch(/Unknown field "nope"/);
	});
});

describe('variables', () => {
	it('rejects an undefined variable', () => {
		expect(messages('query A { user(id: $id) { id } }')[0]).toMatch(
			/Variable "\$id" is not defined/
		);
	});

	it('rejects an unused variable', () => {
		expect(messages('query A($unused: Int) { tags }')[0]).toMatch(
			/Variable "\$unused" is never used/
		);
	});

	it('rejects a duplicate variable name', () => {
		expect(messages('query A($a: Int, $a: Int) { tags }')[0]).toMatch(
			/only one variable named/i
		);
	});

	it('rejects a variable whose type is not an input type', () => {
		expect(messages('query A($u: User) { tags }')[0]).toMatch(
			/cannot be used as a variable type/i
		);
	});

	it('rejects a variable used where its type does not fit', () => {
		expect(
			messages('query A($flag: Boolean) { user(id: $flag) { id } }')[0]
		).toMatch(/cannot be used for argument "id"/i);
	});

	it('rejects a non-null variable of the wrong named type', () => {
		expect(
			messages('query A($flag: Boolean!) { posts(status: $flag) { id } }')[0]
		).toMatch(
			/"\$flag" of type "Boolean!" cannot be used for argument "status"/
		);
	});

	it('accepts a non-null variable where a nullable value is expected', () => {
		accepts('query A($status: Status!) { posts(status: $status) { id } }');
	});
});

describe('fragments', () => {
	it('rejects duplicate fragment names', () => {
		expect(
			messages(
				'{ user(id: "1") { ...F } } fragment F on User { id } fragment F on User { name }'
			)[0]
		).toMatch(/only one fragment named "F"/i);
	});

	it('rejects a spread with no definition', () => {
		expect(messages('{ user(id: "1") { ...Missing } }')[0]).toMatch(
			/Unknown fragment "Missing"/
		);
	});

	it('rejects an unused fragment', () => {
		expect(messages('{ tags } fragment Unused on User { id }')[0]).toMatch(
			/never used/i
		);
	});

	it('rejects a type condition the catalog does not define', () => {
		expect(
			messages('{ user(id: "1") { ...F } } fragment F on Missing { id }')[0]
		).toMatch(/Unknown type "Missing"/);
	});

	it('rejects a spread that can never apply to its parent type', () => {
		expect(
			messages('{ user(id: "1") { ...F } } fragment F on Post { title }')[0]
		).toMatch(/can never apply/i);
	});

	it('rejects a fragment cycle', () => {
		expect(
			messages(
				'{ user(id: "1") { ...A } } fragment A on User { ...B } fragment B on User { ...A }'
			)[0]
		).toMatch(/cycle/i);
	});

	it('accepts a spread through an interface', () => {
		accepts('{ node { ...F } } fragment F on User { name }');
	});
});

describe('directives', () => {
	it('rejects an unknown directive', () => {
		expect(messages('{ tags @nope }')[0]).toMatch(/Unknown directive "@nope"/);
	});

	it('rejects a directive used where it is not allowed', () => {
		expect(messages('query A @include(if: true) { tags }')[0]).toMatch(
			/cannot be used on a query operation/i
		);
	});

	it('rejects repeating a directive that is not repeatable', () => {
		expect(
			messages('{ tags @include(if: true) @include(if: false) }')[0]
		).toMatch(/can only be used once/i);
	});

	it('checks directive arguments like field arguments', () => {
		expect(messages('{ tags @include(if: 3) }')[0]).toMatch(/Boolean/);
	});
});

describe('pipelines', () => {
	it('rejects a pipeline on a field that is not a list', () => {
		expect(messages('{ user(id: "1") { name | unique } }')[0]).toMatch(
			/only be applied to a list field/i
		);
	});

	it('rejects paging a field that is not a connection', () => {
		expect(
			messages('{ user(id: "1") { drafts | page first: 5 { title } } }')[0]
		).toMatch(/is not marked @connection/i);
	});

	it('rejects mixing forward and backward paging', () => {
		expect(messages('{ posts | page first: 5 before: "c" { id } }')[0]).toMatch(
			/forward.*backward|backward.*forward/i
		);
	});

	it('requires a page size', () => {
		expect(messages('{ posts | page after: "c" { id } }')[0]).toMatch(
			/"first" or "last"/
		);
	});

	it('rejects an unknown page argument', () => {
		expect(messages('{ posts | page first: 5 sideways: 1 { id } }')[0]).toMatch(
			/Unknown argument "sideways"/
		);
	});

	it('rejects a non-integer take or skip', () => {
		expect(messages('{ posts | take "5" { id } }')[0]).toMatch(/take.*Int/i);
		expect(messages('{ posts | skip 1.5 { id } }')[0]).toMatch(/skip.*Int/i);
	});

	it('accepts an Int variable as a page size or a take count', () => {
		accepts('query A($n: Int!) { posts | take $n | page first: $n { id } }');
	});

	it('rejects a sort path the item type does not declare', () => {
		expect(messages('{ posts | sort missing { id } }')[0]).toMatch(
			/Cannot sort on "missing"/
		);
	});

	it('rejects sorting on a composite field', () => {
		expect(messages('{ posts | sort author { id } }')[0]).toMatch(
			/is not a leaf field/i
		);
	});

	it('resolves a dotted path through the item type', () => {
		accepts('{ posts | sort author.name desc { id } }');
		expect(messages('{ posts | sort author.missing { id } }')[0]).toMatch(
			/Cannot sort on "author.missing"/
		);
	});

	it('checks the fields a filter compares', () => {
		accepts('{ posts | filter status == PUBLISHED { id } }');
		expect(messages('{ posts | filter missing == 1 { id } }')[0]).toMatch(
			/Cannot filter on "missing"/
		);
		expect(messages('{ posts | filter status == NOPE { id } }')[0]).toMatch(
			/"NOPE" is not a member of enum "Status"/
		);
	});

	it('rejects a stage written after a page', () => {
		expect(messages('{ posts | page first: 5 | sort id { id } }')[0]).toMatch(
			/"\| page" must be the last stage/
		);
	});

	it('leaves custom stages to the runtime that defines them', () => {
		accepts('{ posts | search term: "nex" { id } }');
	});
});

describe('reported errors', () => {
	it('are plain errors carrying a location and a path', () => {
		const [error] = validateRequest('{ user(id: "1") { missing } }', catalog);

		expect(error).toBeInstanceOf(NexValidationError);
		expect(error).toBeInstanceOf(Error);
		expect(error?.location?.line).toBe(1);
		expect(error?.path).toEqual(['user', 'missing']);
	});

	it('report every problem, not just the first', () => {
		expect(messages('{ nope1 nope2 }')).toHaveLength(2);
	});

	it('surface a syntax error on their own', () => {
		const errors = validateRequest('{ user', catalog);

		expect(errors).toHaveLength(1);
		expect(errors[0]?.message).toMatch(/Expected|EOF/);
	});
});

describe('what a request may contain', () => {
	it('rejects catalog definitions sent as a request', () => {
		expect(messages('{ tags } type Sneaky { a: Int }')[0]).toMatch(
			/A request may only hold operations and fragments/
		);
		expect(messages('{ tags } extend type Query { b: Int }')[0]).toMatch(
			/A request may only hold operations and fragments/
		);
	});
});

describe('selections that cannot be merged', () => {
	it('rejects two fields sharing a response key with different names', () => {
		expect(messages('{ a: tags b: tags }')).toEqual([]);
		expect(messages('{ x: tags x: node { __typename } }')[0]).toMatch(
			/"x" cannot be both "tags" and "node"/
		);
	});

	it('rejects the same field asked for with different arguments', () => {
		expect(
			messages('{ user(id: "1") { id } user(id: "2") { id } }')[0]
		).toMatch(/"user" is asked for twice with different arguments/);
	});

	it('accepts the same field asked for with the same arguments', () => {
		expect(messages('{ user(id: "1") { id } user(id: "1") { name } }')).toEqual(
			[]
		);
	});

	it('looks inside merged selections', () => {
		expect(
			messages('{ user(id: "1") { p: posts { id } p: drafts { id } } }')[0]
		).toMatch(/"p" cannot be both "posts" and "drafts"/);
	});

	it('follows fragments when merging', () => {
		expect(
			messages(
				'{ user(id: "1") { ...A ...B } } fragment A on User { x: name } fragment B on User { x: nickname }'
			)[0]
		).toMatch(/"x" cannot be both "name" and "nickname"/);
	});

	it('leaves selections on different branches of a union alone', () => {
		expect(
			messages('{ media { ... on Photo { x: url } ... on Post { x: title } } }')
		).toEqual([]);
	});
});
