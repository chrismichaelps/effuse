/**
 * MIT License
 *
 * Copyright (c) 2025 Chris M. Perez
 *
 * A context is whatever a server passes, and a response is whatever the request
 * asked for. Every place that reads either should read it as itself. Nothing in
 * here casts, which is the point: if a type stopped flowing, this file would
 * stop compiling.
 */

import { describe, expect, it } from 'vitest';
import {
	buildCatalog,
	createNexClient,
	createNexHandler,
	execute,
	subscribe,
	type Authorize,
	type ExecuteOptions,
	type Resolvers,
} from '../index.js';

interface Session {
	readonly userId: string;
	readonly roles: readonly string[];
}

const catalog = buildCatalog(`
	schema { query: Query live: Live }
	type Query { me: String! secret: String @auth(requires: "member") }
	type Live { ticks: Int! }
`);

describe('a context that keeps its type', () => {
	it('reaches a resolver as itself', async () => {
		const resolvers: Resolvers<Session> = {
			Query: {
				// `context` is Session here, with no cast in sight.
				me: (_source, _args, context) => context.userId,
			},
		};

		const result = await execute({
			request: '{ me }',
			catalog,
			resolvers,
			context: { userId: 'ada', roles: ['member'] },
		});

		expect(result.data).toEqual({ me: 'ada' });
	});

	it('reaches the authorizer as itself', async () => {
		const authorize: Authorize<Session> = ({ requires, context }) =>
			context.roles.includes(requires ?? '');

		const allowed = await execute({
			request: '{ secret }',
			catalog,
			resolvers: { Query: { secret: () => 'members only' } },
			context: { userId: 'ada', roles: ['member'] },
			authorize,
		});
		const refused = await execute({
			request: '{ secret }',
			catalog,
			resolvers: { Query: { secret: () => 'members only' } },
			context: { userId: 'bo', roles: [] },
			authorize,
		});

		expect(allowed.data).toEqual({ secret: 'members only' });
		expect(refused.data).toEqual({ secret: null });
	});

	it('is inferred from what was passed, without being written out', async () => {
		const result = await execute({
			request: '{ me }',
			catalog,
			resolvers: {
				Query: {
					me: (_source, _args, context: Session) => context.userId,
				},
			},
			context: { userId: 'grace', roles: [] },
		});

		expect(result.data).toEqual({ me: 'grace' });
	});

	it('reaches a live source as itself', async () => {
		const snapshots: unknown[] = [];

		for await (const snapshot of subscribe<Session>({
			request: 'live L { ticks }',
			catalog,
			context: { userId: 'ada', roles: [] },
			sources: {
				Live: {
					ticks: async function* (_args, context) {
						yield context.userId.length;
					},
				},
			},
		})) {
			snapshots.push(snapshot.data);
		}

		expect(snapshots).toEqual([{ ticks: 3 }]);
	});

	it('reaches a handler mounted on a server as itself', async () => {
		const handler = createNexHandler<Session>({
			catalog,
			resolvers: { Query: { me: (_source, _args, context) => context.userId } },
			context: { userId: 'linus', roles: [] },
		});

		const response = await handler(
			new Request('https://example.com/nex', {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({ query: '{ me }' }),
			})
		);

		expect(await response.json()).toMatchObject({ data: { me: 'linus' } });
	});

	it('still works when a server has no context to give', async () => {
		const options: ExecuteOptions = {
			request: '{ me }',
			catalog,
			resolvers: { Query: { me: () => 'anonymous' } },
		};

		expect((await execute(options)).data).toEqual({ me: 'anonymous' });
	});
});

/** What `generateTypes` writes for the request below. */
interface FeedData extends Record<string, unknown> {
	readonly posts: {
		readonly items: readonly { readonly title: string }[];
		readonly totalCount: number;
	};
}

describe('a response that keeps its shape', () => {
	it('is read without casting anything back', async () => {
		const typed = buildCatalog(`
			type Query { posts: [Post!]! @connection }
			type Post { id: ID! title: String! }
		`);

		const result = await execute<FeedData>({
			request: '{ posts | page first: 2 { title } }',
			catalog: typed,
			resolvers: {
				Query: {
					posts: () => [
						{ id: '1', title: 'first' },
						{ id: '2', title: 'second' },
					],
				},
			},
		});

		// `data` is FeedData | null, so this reads without a cast.
		expect(result.data?.posts.items[0]?.title).toBe('first');
		expect(result.data?.posts.totalCount).toBe(2);
	});

	it('reads the same way through a client', async () => {
		const answer = {
			data: { posts: { items: [{ title: 'first' }], totalCount: 1 } },
			extensions: { cost: 1 },
		};
		const nex = createNexClient({
			endpoint: '/nex',
			fetch: (async () =>
				new Response(JSON.stringify(answer), {
					status: 200,
					headers: { 'content-type': 'application/json' },
				})) as unknown as typeof fetch,
		});

		const result = await nex.request<FeedData>(
			'{ posts | page first: 1 { title } }'
		);

		expect(result.data?.posts.items[0]?.title).toBe('first');
	});
});
