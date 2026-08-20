/**
 * MIT License
 *
 * Copyright (c) 2025 Chris M. Perez
 */

import { describe, expect, it } from 'vitest';
import { buildCatalog, createLoader, createNexHandler } from '../index.js';

const catalog = buildCatalog(`
	type Query { who: String! seen: [String!]! }
	type Live { tick: String! }
	schema { query: Query, live: Live }
`);

interface Session {
	readonly userId: string;
	readonly names: { readonly load: (id: string) => Promise<string> };
}

const ask = (
	handler: (request: Request) => Promise<Response>,
	query: string,
	headers: Record<string, string> = {}
) =>
	handler(
		new Request('https://example.com/nex', {
			method: 'POST',
			headers: { 'content-type': 'application/json', ...headers },
			body: JSON.stringify({ query }),
		})
	);

describe('the context a request is given', () => {
	it('is built again for every request', async () => {
		let built = 0;
		const handler = createNexHandler({
			catalog,
			createContext: () => ({ userId: String((built += 1)) }),
			resolvers: {
				Query: { who: (_source, _args, context) => context.userId },
			},
		});

		const first = await (await ask(handler, '{ who }')).json();
		const second = await (await ask(handler, '{ who }')).json();

		expect(first).toMatchObject({ data: { who: '1' } });
		expect(second).toMatchObject({ data: { who: '2' } });
	});

	it('reads what the request carried', async () => {
		const handler = createNexHandler({
			catalog,
			createContext: (request) => ({
				userId: request.headers.get('x-user') ?? 'nobody',
			}),
			resolvers: {
				Query: { who: (_source, _args, context) => context.userId },
			},
		});

		const answer = await ask(handler, '{ who }', { 'x-user': 'ada' });

		expect(await answer.json()).toMatchObject({ data: { who: 'ada' } });
	});

	it('waits for a context that has to be looked up', async () => {
		const handler = createNexHandler({
			catalog,
			createContext: async () => {
				await Promise.resolve();
				return { userId: 'ada' };
			},
			resolvers: {
				Query: { who: (_source, _args, context) => context.userId },
			},
		});

		expect(await (await ask(handler, '{ who }')).json()).toMatchObject({
			data: { who: 'ada' },
		});
	});

	it('never lets one request see what another has loaded', async () => {
		const asked: string[][] = [];
		const handler = createNexHandler<Session>({
			catalog,
			createContext: (request) => ({
				userId: request.headers.get('x-user') ?? 'nobody',
				names: createLoader<string, string>({
					load: async (ids) => {
						asked.push([...ids]);
						return ids.map((id) => `${id} of ${request.headers.get('x-user')}`);
					},
				}),
			}),
			resolvers: {
				Query: {
					seen: async (_source, _args, context) => [
						await context.names.load('a'),
					],
				},
			},
		});

		const first = await (
			await ask(handler, '{ seen }', { 'x-user': 'ada' })
		).json();
		const second = await (
			await ask(handler, '{ seen }', { 'x-user': 'grace' })
		).json();

		// A loader remembers what its own request has seen and nothing else.
		expect(first).toMatchObject({ data: { seen: ['a of ada'] } });
		expect(second).toMatchObject({ data: { seen: ['a of grace'] } });
		expect(asked).toEqual([['a'], ['a']]);
	});

	it('says so when a context cannot be built', async () => {
		const handler = createNexHandler({
			catalog,
			createContext: () => {
				throw new Error('the session store is down');
			},
			resolvers: { Query: { who: () => 'ada' } },
		});

		const answer = await ask(handler, '{ who }');
		const body = (await answer.json()) as { errors?: { message: string }[] };

		expect(answer.status).toBe(500);
		expect(body.errors?.[0]?.message).toMatch(/the session store is down/);
	});

	it('rewrites the failure the way the server asked', async () => {
		const handler = createNexHandler({
			catalog,
			createContext: () => {
				throw new Error('postgres://user:hunter2@db');
			},
			formatError: () =>
				new (class extends Error {
					override message = 'Something went wrong';
				})() as never,
			resolvers: { Query: { who: () => 'ada' } },
		});

		const body = (await (await ask(handler, '{ who }')).json()) as {
			errors?: { message: string }[];
		};

		expect(body.errors?.[0]?.message).toBe('Something went wrong');
	});

	it('still takes a context that is just a value', async () => {
		const handler = createNexHandler({
			catalog,
			context: { userId: 'ada' },
			resolvers: {
				Query: { who: (_source, _args, context) => context.userId },
			},
		});

		expect(await (await ask(handler, '{ who }')).json()).toMatchObject({
			data: { who: 'ada' },
		});
	});

	it('prefers the one built for the request', async () => {
		const handler = createNexHandler({
			catalog,
			context: { userId: 'shared' },
			createContext: () => ({ userId: 'mine' }),
			resolvers: {
				Query: { who: (_source, _args, context) => context.userId },
			},
		});

		expect(await (await ask(handler, '{ who }')).json()).toMatchObject({
			data: { who: 'mine' },
		});
	});

	it('gives a live operation one too', async () => {
		const handler = createNexHandler({
			catalog,
			createContext: (request) => ({
				userId: request.headers.get('x-user') ?? 'nobody',
			}),
			sources: {
				Live: {
					tick: async function* () {
						yield 'now';
					},
				},
			},
			resolvers: {
				Live: { tick: (_source, _args, context) => context.userId },
			},
		});

		const answer = await ask(handler, 'live L { tick }', { 'x-user': 'ada' });
		const frames = await answer.text();

		expect(answer.headers.get('content-type')).toMatch(/event-stream/);
		expect(frames).toContain('"tick":"ada"');
	});
});
