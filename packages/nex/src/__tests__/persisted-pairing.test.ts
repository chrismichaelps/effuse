/**
 * MIT License
 *
 * Copyright (c) 2025 Chris M. Perez
 */

import { describe, expect, it } from 'vitest';
import {
	buildCatalog,
	createNexClient,
	createNexHandler,
	createOperationStore,
	requestKey,
} from '../index.js';

const catalog = buildCatalog(`
	type Query { hello: String! greet(name: String!): String! }
	schema { query: Query }
`);

const FEED = '{ hello }';
const GREET = 'query Greet($name: String!) { greet(name: $name) }';

/** A server that only runs what it already holds, and says what it was sent. */
const server = async (persistedOnly = true) => {
	const store = await createOperationStore.from([FEED, GREET]);
	const sent: Record<string, unknown>[] = [];

	const handler = createNexHandler({
		catalog,
		operations: store,
		persistedOnly,
		resolvers: {
			Query: {
				hello: () => 'world',
				greet: (_source, args) => `hello ${String(args.name)}`,
			},
		},
	});

	const fetchImpl = (async (url: string, init: RequestInit) => {
		sent.push(JSON.parse(String(init.body)) as Record<string, unknown>);
		return handler(new Request(url, init));
	}) as unknown as typeof fetch;

	return { store, sent, fetchImpl };
};

describe('a client and a server that agree ahead of time', () => {
	it('sends the name rather than the request', async () => {
		const { store, sent, fetchImpl } = await server();
		const nex = createNexClient({
			endpoint: 'https://example.com/nex',
			cache: false,
			fetch: fetchImpl,
			operations: store,
		});

		const result = await nex.request(FEED);

		expect(result.errors).toBeUndefined();
		expect(result.data).toEqual({ hello: 'world' });
		expect(sent[0]).toHaveProperty('id');
		expect(sent[0]).not.toHaveProperty('query');
	});

	it('names it the same way the server did', async () => {
		const { store, sent, fetchImpl } = await server();
		const nex = createNexClient({
			endpoint: 'https://example.com/nex',
			cache: false,
			fetch: fetchImpl,
			operations: store,
		});

		await nex.request(FEED);

		// Both sides work the name out themselves and never exchange it, so
		// they have to arrive at the same one or nothing a client sends is
		// anything the server knows.
		expect(sent[0]?.id).toBe(await requestKey(FEED));
	});

	it('carries the variables the request takes', async () => {
		const { store, sent, fetchImpl } = await server();
		const nex = createNexClient({
			endpoint: 'https://example.com/nex',
			cache: false,
			fetch: fetchImpl,
			operations: store,
		});

		const result = await nex.request(GREET, { variables: { name: 'Ada' } });

		expect(result.data).toEqual({ greet: 'hello Ada' });
		expect(sent[0]).toMatchObject({ variables: { name: 'Ada' } });
	});

	it('sends the request itself when the server does not know it', async () => {
		const { store, sent, fetchImpl } = await server(false);
		const nex = createNexClient({
			endpoint: 'https://example.com/nex',
			cache: false,
			fetch: fetchImpl,
			operations: store,
		});

		const result = await nex.request('{ greet(name: "Grace") }');

		expect(result.data).toEqual({ greet: 'hello Grace' });
		expect(sent[0]).toHaveProperty('query');
	});

	it('is refused by a server that only runs what it knows', async () => {
		const { store, fetchImpl } = await server();
		const nex = createNexClient({
			endpoint: 'https://example.com/nex',
			cache: false,
			fetch: fetchImpl,
			operations: store,
		});

		const result = await nex.request('{ greet(name: "Grace") }');

		expect(result.errors?.[0]?.message).toMatch(
			/only runs operations it knows/i
		);
	});

	it('agrees however the request was spelled', async () => {
		const { store, sent, fetchImpl } = await server();
		const nex = createNexClient({
			endpoint: 'https://example.com/nex',
			cache: false,
			fetch: fetchImpl,
			operations: store,
		});

		const result = await nex.request('{   hello   }');

		// The name is worked out from what the request does rather than how it
		// was typed, so whitespace cannot make a client ask for something the
		// server has never heard of.
		expect(result.data).toEqual({ hello: 'world' });
		expect(sent[0]).toHaveProperty('id');
	});

	it('watches a live operation it agreed on too', async () => {
		const live = buildCatalog(`
			type Query { hello: String! }
			type Live { beat(from: Int!): Int! }
			schema { query: Query, live: Live }
		`);
		const WATCH = 'live Watch($from: Int!) { beat(from: $from) }';
		const store = await createOperationStore.from([WATCH]);

		const handler = createNexHandler({
			catalog: live,
			operations: store,
			persistedOnly: true,
			sources: {
				Live: {
					// The variables have to reach here by name too, or a live
					// operation sent by name watches the wrong thing.
					beat: async function* (args) {
						yield Number(args.from);
					},
				},
			},
		});

		const nex = createNexClient({
			endpoint: 'https://example.com/nex',
			cache: false,
			operations: store,
			fetch: ((url: string, init: RequestInit) =>
				handler(new Request(url, init))) as unknown as typeof fetch,
		});

		const seen: unknown[] = [];
		for await (const snapshot of nex.subscribe(WATCH, {
			variables: { from: 7 },
		})) {
			seen.push(snapshot.data);
		}

		expect(seen).toEqual([{ beat: 7 }]);
	});
});
