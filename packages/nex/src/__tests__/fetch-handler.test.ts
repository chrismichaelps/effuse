/**
 * MIT License
 *
 * Copyright (c) 2025 Chris M. Perez
 */

import { describe, expect, it } from 'vitest';
import type { FetchHandler } from '@effuse/server';
import { buildCatalog, createNexHandler } from '../index.js';
import type { LiveSources, Resolvers } from '../index.js';

/**
 * The contract `@effuse/server` binds a handler to. Written out rather than
 * imported so the language package stays free of a dependency on the server.
 */

const catalog = buildCatalog(`
	schema { query: Query mutation: Mutation live: Live }
	type Query { hello: String! echo(text: String!): String! }
	type Mutation { touch: Boolean! }
	type Live { ticks: Int! }
`);

const resolvers: Resolvers = {
	Query: {
		hello: () => 'world',
		echo: (_source, args) => String(args.text),
	},
	Mutation: { touch: () => true },
};

const sources: LiveSources = {
	Live: {
		ticks: async function* () {
			yield 1;
			yield 2;
		},
	},
};

const handler = createNexHandler({ catalog, resolvers, sources });

const post = (body: unknown, headers: Record<string, string> = {}) =>
	handler(
		new Request('https://example.com/nex', {
			method: 'POST',
			headers: { 'content-type': 'application/json', ...headers },
			body: JSON.stringify(body),
		})
	);

describe('what a server mounts', () => {
	it('is the handler shape the ecosystem binds', () => {
		// The real type, not a copy of it: a handler that stopped fitting what
		// a server mounts would otherwise still pass here.
		const mounted: FetchHandler = handler;

		expect(typeof mounted).toBe('function');
	});

	it('answers a request with a real response', async () => {
		const response = await post({ query: '{ hello }' });

		expect(response).toBeInstanceOf(Response);
		expect(response.status).toBe(200);
		expect(response.headers.get('content-type')).toBe(
			'application/json; charset=utf-8'
		);
		expect(await response.json()).toMatchObject({ data: { hello: 'world' } });
	});

	it('reads variables and the operation name from the body', async () => {
		const response = await post({
			query: 'query A($text: String!) { echo(text: $text) }',
			variables: { text: 'hi' },
			operationName: 'A',
		});

		expect(await response.json()).toMatchObject({ data: { echo: 'hi' } });
	});

	it('runs a safe query sent with GET', async () => {
		const response = await handler(
			new Request(
				`https://example.com/nex?query=${encodeURIComponent('{ hello }')}`
			)
		);

		expect(await response.json()).toMatchObject({ data: { hello: 'world' } });
	});

	it('refuses a mutation sent with GET, and says what would work', async () => {
		const response = await handler(
			new Request(
				`https://example.com/nex?query=${encodeURIComponent('mutation { touch }')}`
			)
		);

		expect(response.status).toBe(405);
		expect(response.headers.get('allow')).toBe('POST');
	});

	it('answers a request that does not agree with the catalog with 400', async () => {
		const response = await post({ query: '{ nope }' });

		expect(response.status).toBe(400);
	});

	it('answers a batch with a batch', async () => {
		const response = await post([
			{ query: '{ hello }' },
			{ query: '{ hello }' },
		]);

		expect(await response.json()).toHaveLength(2);
	});
});

describe('a live operation over the wire', () => {
	it('answers with a streaming response', async () => {
		const response = await post({ query: 'live L { ticks }' });

		expect(response.headers.get('content-type')).toBe('text/event-stream');
		expect(response.body).toBeInstanceOf(ReadableStream);
	});

	it('streams a frame per snapshot, then says it is done', async () => {
		const response = await post({ query: 'live L { ticks }' });
		const text = await response.text();

		expect(text).toContain('event: next\ndata: {"data":{"ticks":1}');
		expect(text).toContain('event: next\ndata: {"data":{"ticks":2}');
		expect(text.endsWith('event: complete\ndata: {}\n\n')).toBe(true);
	});

	it('stops producing when the caller goes away', async () => {
		const produced: number[] = [];
		const endless = createNexHandler({
			catalog,
			sources: {
				Live: {
					ticks: async function* () {
						for (let tick = 1; ; tick += 1) {
							await Promise.resolve();
							produced.push(tick);
							yield tick;
						}
					},
				},
			},
		});

		const controller = new AbortController();
		const response = await endless(
			new Request('https://example.com/nex', {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({ query: 'live L { ticks }' }),
				signal: controller.signal,
			})
		);

		const reader = response.body?.getReader();
		await reader?.read();
		controller.abort();
		await reader?.cancel().catch(() => undefined);
		const seen = produced.length;

		await new Promise((resolve) => setTimeout(resolve, 20));
		expect(produced.length).toBeLessThanOrEqual(seen + 1);
	});
});

describe('what a server may say about the endpoint', () => {
	it('answers anything but GET and POST with 405', async () => {
		const response = await handler(
			new Request('https://example.com/nex', { method: 'DELETE' })
		);

		expect(response.status).toBe(405);
		expect(response.headers.get('allow')).toBe('GET, POST');
	});

	it('answers a body that is not JSON with 400', async () => {
		const response = await handler(
			new Request('https://example.com/nex', {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: '{ not json',
			})
		);

		expect(response.status).toBe(400);
	});

	it('answers a content type it cannot read with 415', async () => {
		const response = await post(
			{ query: '{ hello }' },
			{ 'content-type': 'text/plain' }
		);

		expect(response.status).toBe(415);
	});
});
