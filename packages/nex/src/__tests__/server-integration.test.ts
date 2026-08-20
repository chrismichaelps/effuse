/**
 * MIT License
 *
 * Copyright (c) 2025 Chris M. Perez
 */

import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createNodeServer, type FetchHandler } from '@effuse/server';
import {
	buildCatalog,
	createCostBudget,
	createLoader,
	createNexHandler,
	refFor,
} from '../index.js';

const catalog = buildCatalog(`
	type Person @identity { id: ID! name: String! }
	type Query { me: Person! costly: String! @cost(value: 100) }
	type Live { tick: Int! }
	schema { query: Query, live: Live }
`);

interface Session {
	readonly caller: string;
	readonly people: { readonly load: (id: string) => Promise<string> };
}

const budget = createCostBudget({ capacity: 150, refillPerSecond: 0 });

const handler = createNexHandler<Session>({
	catalog,
	budget: {
		budget,
		callerFor: (request) => request.headers.get('x-caller') ?? 'anonymous',
	},
	createContext: (request) => ({
		caller: request.headers.get('x-caller') ?? 'anonymous',
		people: createLoader<string, string>({
			load: async (ids) => ids.map((id) => `person ${id}`),
		}),
	}),
	resolvers: {
		Query: {
			me: (_source, _args, context) => ({ id: '1', name: context.caller }),
			costly: () => 'expensive',
		},
	},
	sources: {
		Live: {
			tick: async function* () {
				yield 1;
				yield 2;
			},
		},
	},
});

let origin = '';
let server: Awaited<ReturnType<typeof createNodeServer>> | undefined;

beforeAll(async () => {
	// The handler is bound with no adapter of its own: whatever the ecosystem
	// does for any other route is what it does for this one.
	const mounted: FetchHandler = handler;
	server = createNodeServer(mounted);

	const address = await server.listen({ port: 0 });
	origin = `http://127.0.0.1:${String(address.port)}`;
});

afterAll(async () => {
	await server?.close();
});

const post = (body: unknown, headers: Record<string, string> = {}) =>
	fetch(`${origin}/nex`, {
		method: 'POST',
		headers: { 'content-type': 'application/json', ...headers },
		body: JSON.stringify(body),
	});

describe('served by the ecosystem, over a socket', () => {
	it('answers a request', async () => {
		const response = await post(
			{ query: '{ me { name } }' },
			{
				'x-caller': 'ada',
			}
		);

		expect(response.status).toBe(200);
		expect(await response.json()).toMatchObject({
			data: { me: { name: 'ada' } },
		});
	});

	it('builds the context from the request that arrived', async () => {
		const first = await (
			await post({ query: '{ me { name } }' }, { 'x-caller': 'ada' })
		).json();
		const second = await (
			await post({ query: '{ me { name } }' }, { 'x-caller': 'grace' })
		).json();

		expect(first).toMatchObject({ data: { me: { name: 'ada' } } });
		expect(second).toMatchObject({ data: { me: { name: 'grace' } } });
	});

	it('hands out a reference a client can cache by', async () => {
		const body = (await (
			await post({ query: '{ me { __ref name } }' }, { 'x-caller': 'ada' })
		).json()) as { data: { me: { __ref: string } } };

		expect(body.data.me.__ref).toBe(refFor('Person', '1'));
	});

	it('answers a safe query sent with GET', async () => {
		const response = await fetch(
			`${origin}/nex?query=${encodeURIComponent('{ me { name } }')}`
		);

		expect(response.status).toBe(200);
	});

	it('streams a live operation as events', async () => {
		const response = await post({ query: 'live L { tick }' });

		expect(response.headers.get('content-type')).toMatch(/text\/event-stream/);

		const frames = await response.text();
		expect(frames).toContain('"tick":1');
		expect(frames).toContain('"tick":2');
	});

	it('refuses a caller who has spent what they had', async () => {
		const spender = { 'x-caller': 'spender' };

		expect((await post({ query: '{ costly }' }, spender)).status).toBe(200);
		const refused = await post({ query: '{ costly }' }, spender);

		expect(refused.status).toBe(429);
		expect(await refused.json()).toMatchObject({
			errors: [{ extensions: { code: 'OVER_BUDGET' } }],
		});
	});

	it('leaves the runtime to answer a route it does not serve', async () => {
		// Nothing here listens or routes: the handler answers requests, and
		// what reaches it is the runtime's business.
		const response = await post({ query: '{ nonsense }' });

		expect(response.status).toBe(400);
	});
});
