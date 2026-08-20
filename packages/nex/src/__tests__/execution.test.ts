/**
 * MIT License
 *
 * Copyright (c) 2025 Chris M. Perez
 */

import { describe, expect, it } from 'vitest';
import { type Resolvers, buildCatalog, execute } from '../index.js';

const catalog = buildCatalog(`
	schema { query: Query mutation: Mutation live: Live }

	type Query {
		hello: String!
		me: User
		posts(status: Status): [Post!]! @connection
		numbers: [Int!]!
		node(id: ID!): Node
		media: Media
		boom: String!
		maybeBoom: String
	}

	type Mutation {
		createPost(input: CreatePostInput!): Post!
		fail: String!
		transaction: Transaction!
	}

	type Transaction {
		first: String!
		second: String!
	}

	type Live { ticker: String! }

	interface Node { id: ID! }
	type User implements Node { id: ID! name: String! age: Int nickname: String? }
	type Post implements Node {
		id: ID!
		title: String!
		status: Status!
		rank: Int!
		author: User!
	}
	type Photo { url: String! }
	union Media = Photo | Post

	enum Status { DRAFT PUBLISHED ARCHIVED }
	input CreatePostInput { title: String! }
`);

const posts = [
	{ id: '1', title: 'beta', status: 'PUBLISHED', rank: 2, authorId: 'u1' },
	{ id: '2', title: 'alpha', status: 'DRAFT', rank: 1, authorId: 'u1' },
	{ id: '3', title: 'gamma', status: 'PUBLISHED', rank: 3, authorId: 'u2' },
];

const users: Record<string, { id: string; name: string; age: number | null }> =
	{
		u1: { id: 'u1', name: 'Ada', age: 36 },
		u2: { id: 'u2', name: 'Grace', age: 45 },
	};

const order: string[] = [];

const resolvers: Resolvers = {
	Query: {
		hello: () => 'world',
		me: () => users.u1,
		posts: (_source, args) =>
			args.status === undefined
				? posts
				: posts.filter((post) => post.status === args.status),
		numbers: () => [3, 1, 2, 3],
		node: (_source, args) => ({ ...users.u1, __typename: 'User', id: args.id }),
		media: () => ({ __typename: 'Photo', url: 'https://example.com/a.png' }),
		boom: () => {
			throw new Error('boom failed');
		},
		maybeBoom: () => {
			throw new Error('maybeBoom failed');
		},
	},
	Mutation: {
		createPost: (_source, args) => ({
			id: '9',
			title: (args.input as { title: string }).title,
			status: 'DRAFT',
			rank: 0,
			authorId: 'u1',
		}),
		fail: () => {
			throw new Error('mutation failed');
		},
		transaction: () => ({}),
	},
	Transaction: {
		first: async () => {
			await Promise.resolve();
			order.push('first');
			return 'one';
		},
		second: () => {
			order.push('second');
			return 'two';
		},
	},
	Post: {
		author: (source) => users[(source as { authorId: string }).authorId],
	},
	Live: { ticker: () => 'tick' },
};

const run = async (request: string, options: Record<string, unknown> = {}) =>
	execute({ request, catalog, resolvers, ...options });

describe('basic execution', () => {
	it('resolves a scalar field', async () => {
		expect(await run('{ hello }')).toMatchObject({ data: { hello: 'world' } });
	});

	it('reads properties without a resolver', async () => {
		expect(await run('{ me { id name } }')).toMatchObject({
			data: { me: { id: 'u1', name: 'Ada' } },
		});
	});

	it('honours aliases', async () => {
		expect(await run('{ greeting: hello }')).toMatchObject({
			data: { greeting: 'world' },
		});
	});

	it('passes arguments, including defaults from variables', async () => {
		const result = await run(
			'query A($status: Status = PUBLISHED) { posts(status: $status) { id } }'
		);

		expect(result.data).toEqual({ posts: [{ id: '1' }, { id: '3' }] });
	});

	it('resolves __typename', async () => {
		expect(await run('{ me { __typename } }')).toMatchObject({
			data: { me: { __typename: 'User' } },
		});
	});

	it('reports the cost of what it ran', async () => {
		const result = await run('{ hello }');

		expect(result.extensions.cost).toBe(1);
	});

	it('awaits promises from resolvers', async () => {
		const result = await execute({
			request: '{ hello }',
			catalog,
			resolvers: { Query: { hello: () => Promise.resolve('async world') } },
		});

		expect(result.data).toEqual({ hello: 'async world' });
	});
});

describe('fragments and abstract types', () => {
	it('spreads named and inline fragments', async () => {
		const result = await run(
			'{ me { ...UserCard ... on User { age } } } fragment UserCard on User { name }'
		);

		expect(result.data).toEqual({ me: { name: 'Ada', age: 36 } });
	});

	it('resolves an interface through __typename on the value', async () => {
		const result = await run('{ node(id: "x") { id ... on User { name } } }');

		expect(result.data).toEqual({ node: { id: 'x', name: 'Ada' } });
	});

	it('resolves a union member', async () => {
		expect(await run('{ media { ... on Photo { url } } }')).toMatchObject({
			data: { media: { url: 'https://example.com/a.png' } },
		});
	});

	it('honours @include and @skip', async () => {
		const result = await run(
			'query A($yes: Boolean!, $no: Boolean!) { hello @include(if: $yes) me @skip(if: $no) { id } }',
			{ variables: { yes: true, no: true } }
		);

		expect(result.data).toEqual({ hello: 'world' });
	});
});

describe('variables', () => {
	it('coerces and checks variables before running', async () => {
		const result = await execute({
			request: 'query A($id: ID!) { node(id: $id) { id } }',
			catalog,
			resolvers,
			variables: {},
		});

		expect(result.data).toBeNull();
		expect(result.errors?.[0]?.message).toMatch(
			/Variable "\$id" of required type/
		);
	});

	it('applies a variable default', async () => {
		const result = await run(
			'query A($status: Status = DRAFT) { posts(status: $status) { id } }'
		);

		expect(result.data).toEqual({ posts: [{ id: '2' }] });
	});

	it('rejects a variable value the type does not accept', async () => {
		const result = await run(
			'query A($status: Status!) { posts(status: $status) { id } }',
			{
				variables: { status: 'NOPE' },
			}
		);

		expect(result.errors?.[0]?.message).toMatch(/Status/);
	});
});

describe('nullability', () => {
	it('nulls a nullable field that fails, and reports the error', async () => {
		const result = await run('{ maybeBoom hello }');

		expect(result.data).toEqual({ maybeBoom: null, hello: 'world' });
		expect(result.errors).toHaveLength(1);
		expect(result.errors?.[0]?.path).toEqual(['maybeBoom']);
	});

	it('propagates a non-null failure to the nearest nullable parent', async () => {
		const result = await run('{ boom }');

		expect(result.data).toBeNull();
		expect(result.errors?.[0]?.message).toMatch(/boom failed/);
	});

	it('reports a resolver that returns null for a non-null field', async () => {
		const result = await execute({
			request: '{ hello }',
			catalog,
			resolvers: { Query: { hello: () => null } },
		});

		expect(result.data).toBeNull();
		expect(result.errors?.[0]?.message).toMatch(/non-null field "hello"/i);
	});

	it('keeps an explicit null for an optional field', async () => {
		const result = await execute({
			request: '{ me { nickname } }',
			catalog,
			resolvers: { Query: { me: () => ({ nickname: null }) } },
		});

		expect(result.data).toEqual({ me: { nickname: null } });
	});
});

describe('error policy', () => {
	it('returns data and errors by default', async () => {
		const result = await run('{ maybeBoom hello }');

		expect(result.data).not.toBeNull();
		expect(result.errors).toHaveLength(1);
	});

	it('stops at the first error when asked to fail fast', async () => {
		const result = await run('{ maybeBoom hello }', {
			errorPolicy: 'failFast',
		});

		expect(result.data).toBeNull();
		expect(result.errors).toHaveLength(1);
	});

	it('suppresses field errors when asked to ignore them', async () => {
		const result = await run('{ maybeBoom hello }', { errorPolicy: 'ignore' });

		expect(result.data).toEqual({ maybeBoom: null, hello: 'world' });
		expect(result.errors).toBeUndefined();
	});
});

describe('mutations', () => {
	it('runs a mutation', async () => {
		const result = await run(
			'mutation M($input: CreatePostInput!) { createPost(input: $input) { id title } }',
			{ variables: { input: { title: 'new' } } }
		);

		expect(result.data).toEqual({ createPost: { id: '9', title: 'new' } });
	});

	it('runs the fields of a transaction in order', async () => {
		order.length = 0;
		const result = await run('mutation { transaction { first second } }');

		expect(order).toEqual(['first', 'second']);
		expect(result.data).toEqual({
			transaction: { first: 'one', second: 'two' },
		});
	});

	it('runs root mutation fields one after another', async () => {
		const seen: string[] = [];
		const result = await execute({
			request: 'mutation { a: fail b: fail }',
			catalog,
			resolvers: {
				Mutation: {
					fail: () => {
						seen.push('called');
						throw new Error('mutation failed');
					},
				},
			},
		});

		expect(seen).toHaveLength(2);
		expect(result.data).toBeNull();
	});
});

describe('live operations', () => {
	it('runs a live operation as a single snapshot', async () => {
		expect(await run('live L { ticker }')).toMatchObject({
			data: { ticker: 'tick' },
		});
	});
});

describe('pipelines', () => {
	it('filters, sorts, and takes', async () => {
		const result = await run(
			'{ posts | filter status == PUBLISHED | sort title desc | take 1 { title } }'
		);

		expect(result.data).toEqual({ posts: [{ title: 'gamma' }] });
	});

	it('filters on a nested path and combines conditions', async () => {
		const result = await run(
			'{ posts | filter rank >= 2 and author.name == "Ada" { id } }'
		);

		expect(result.data).toEqual({ posts: [{ id: '1' }] });
	});

	it('negates a condition', async () => {
		const result = await run(
			'{ posts | filter not (status == PUBLISHED) { id } }'
		);

		expect(result.data).toEqual({ posts: [{ id: '2' }] });
	});

	it('drops duplicate rows', async () => {
		const result = await run('{ numbers | unique }');

		expect(result.data).toEqual({ numbers: [3, 1, 2] });
	});

	it('skips rows', async () => {
		const result = await run('{ posts | sort rank asc | skip 1 { id } }');

		expect(result.data).toEqual({ posts: [{ id: '1' }, { id: '3' }] });
	});

	it('compares against a variable', async () => {
		const result = await run(
			'query A($status: Status!) { posts | filter status == $status { id } }',
			{ variables: { status: 'DRAFT' } }
		);

		expect(result.data).toEqual({ posts: [{ id: '2' }] });
	});
});

describe('pagination', () => {
	it('returns the standard page shape', async () => {
		const result = await run(
			'{ posts | sort rank asc | page first: 2 { id } }'
		);
		const page = (result.data as { posts: Record<string, unknown> }).posts;

		expect(page).toMatchObject({
			items: [{ id: '2' }, { id: '1' }],
			totalCount: 3,
		});
		expect(page.pageInfo).toMatchObject({
			hasNextPage: true,
			hasPreviousPage: false,
		});
	});

	it('walks forward with the cursor it handed out', async () => {
		const first = await run('{ posts | sort rank asc | page first: 2 { id } }');
		const cursor = (
			first.data as { posts: { pageInfo: { endCursor: string } } }
		).posts.pageInfo.endCursor;

		const second = await run(
			'query A($after: String!) { posts | sort rank asc | page first: 2 after: $after { id } }',
			{ variables: { after: cursor } }
		);
		const page = (second.data as { posts: Record<string, unknown> }).posts;

		expect(page.items).toEqual([{ id: '3' }]);
		expect(page.pageInfo).toMatchObject({
			hasNextPage: false,
			hasPreviousPage: true,
		});
	});

	it('walks backward with last and before', async () => {
		const result = await run('{ posts | sort rank asc | page last: 2 { id } }');
		const page = (result.data as { posts: Record<string, unknown> }).posts;

		expect(page.items).toEqual([{ id: '1' }, { id: '3' }]);
		expect(page.pageInfo).toMatchObject({
			hasPreviousPage: true,
			hasNextPage: false,
		});
	});

	it('reports a cursor it did not hand out', async () => {
		const result = await run(
			'{ posts | page first: 1 after: "nonsense" { id } }'
		);

		expect(result.errors?.[0]?.message).toMatch(/cursor/i);
	});

	it('reports a cursor that decodes but came from somewhere else', async () => {
		// Decodes to a perfectly good offset once the prefix is dropped, so only
		// checking the prefix keeps it out.
		const foreign = Buffer.from('xxxx7', 'utf8').toString('base64');
		const result = await run(
			'query A($after: String!) { posts | page first: 1 after: $after { id } }',
			{ variables: { after: foreign } }
		);

		expect(result.errors?.[0]?.message).toMatch(/did not hand out/i);
	});
});

describe('validation before execution', () => {
	it('refuses to run an invalid request', async () => {
		const result = await run('{ nope }');

		expect(result.data).toBeNull();
		expect(result.errors?.[0]?.message).toMatch(/Cannot query field "nope"/);
	});

	it('refuses a request over its cost limit', async () => {
		const result = await run('{ posts | page first: 50 { title } }', {
			limits: { maxCost: 10 },
		});

		expect(result.errors?.[0]?.message).toMatch(/cost/i);
	});

	it('can skip validation for a request already checked', async () => {
		const result = await run('{ hello }', { validate: false });

		expect(result.data).toEqual({ hello: 'world' });
	});
});
