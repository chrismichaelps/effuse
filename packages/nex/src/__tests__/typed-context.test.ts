/**
 * MIT License
 *
 * Copyright (c) 2025 Chris M. Perez
 *
 * A context is whatever a server passes, and every place that reads it should
 * read it as itself. Nothing in here casts, which is the point: if the context
 * stopped flowing, this file would stop compiling.
 */

import { describe, expect, it } from 'vitest';
import {
	buildCatalog,
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
