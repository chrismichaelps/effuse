/**
 * MIT License
 *
 * Copyright (c) 2025 Chris M. Perez
 */

import { describe, expect, it } from 'vitest';
import { buildCatalog, createNexHandler } from '../index.js';

const catalog = buildCatalog(`
	type Query { hello: String! }
	type Live { beat: Int! }
	schema { query: Query, live: Live }
`);

const handler = createNexHandler({
	catalog,
	resolvers: { Query: { hello: () => 'hi' } },
	sources: {
		Live: {
			beat: async function* () {
				yield 1;
			},
		},
	},
});

const post = (query: string, headers: Record<string, string> = {}) =>
	handler(
		new Request('https://example.com/nex', {
			method: 'POST',
			headers: { 'content-type': 'application/json', ...headers },
			body: JSON.stringify({ query }),
		})
	);

const get = (query: string, headers: Record<string, string> = {}) =>
	handler(
		new Request(`https://example.com/nex?query=${encodeURIComponent(query)}`, {
			headers,
		})
	);

describe('what a caller says it can read', () => {
	it('answers a caller that asks for anything', async () => {
		const response = await post('{ hello }', { accept: '*/*' });

		expect(response.status).toBe(200);
		expect(response.headers.get('content-type')).toMatch(/application\/json/);
	});

	it('answers a caller that asks for JSON', async () => {
		expect(
			(await post('{ hello }', { accept: 'application/json' })).status
		).toBe(200);
	});

	it('answers a caller that says nothing', async () => {
		expect((await post('{ hello }')).status).toBe(200);
	});

	it('takes a whole family as an answer', async () => {
		expect((await post('{ hello }', { accept: 'application/*' })).status).toBe(
			200
		);
	});

	it('reads past the parameters on a media type', async () => {
		const response = await post('{ hello }', {
			accept: 'application/json; q=0.9, text/plain; q=0.1',
		});

		expect(response.status).toBe(200);
	});

	it('refuses a caller that cannot read what we would send', async () => {
		const response = await post('{ hello }', { accept: 'text/html' });

		expect(response.status).toBe(406);
		expect(await response.json()).toMatchObject({
			errors: [{ message: expect.stringMatching(/application\/json/) }],
		});
	});

	it('honours a caller ruling a type out', async () => {
		// A weight of zero is the one weight that changes an answer rather than
		// ordering several: the caller is saying it cannot read this at all.
		expect(
			(await post('{ hello }', { accept: 'application/json;q=0' })).status
		).toBe(406);
		expect((await post('{ hello }', { accept: '*/*;q=0' })).status).toBe(406);
	});

	it('takes the type it can read when another was ruled out', async () => {
		const response = await post('{ hello }', {
			accept: 'text/html;q=0, application/json',
		});

		expect(response.status).toBe(200);
	});

	it('refuses a caller that only wants a stream for a plain query', async () => {
		expect(
			(await post('{ hello }', { accept: 'text/event-stream' })).status
		).toBe(406);
	});

	it('refuses a caller that cannot read a stream for a live operation', async () => {
		const response = await post('live L { beat }', {
			accept: 'application/json',
		});

		expect(response.status).toBe(406);
		expect(await response.json()).toMatchObject({
			errors: [{ message: expect.stringMatching(/text\/event-stream/) }],
		});
	});

	it('streams to a caller that asked for a stream', async () => {
		const response = await post('live L { beat }', {
			accept: 'text/event-stream',
		});

		expect(response.status).toBe(200);
		expect(response.headers.get('content-type')).toMatch(/text\/event-stream/);
	});

	it('applies the same rule to a request sent with GET', async () => {
		expect((await get('{ hello }', { accept: 'text/html' })).status).toBe(406);
		expect((await get('{ hello }', { accept: '*/*' })).status).toBe(200);
	});

	it('says what it would have sent, so a caller can fix it', async () => {
		const response = await post('{ hello }', { accept: 'text/html' });

		expect(response.headers.get('content-type')).toMatch(/application\/json/);
	});
});

describe('what a caller sends alongside a request', () => {
	it('takes a map of extensions', async () => {
		const response = await handler(
			new Request('https://example.com/nex', {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({
					query: '{ hello }',
					extensions: { anything: true },
				}),
			})
		);

		expect(response.status).toBe(200);
	});

	it('refuses extensions that are not a map', async () => {
		const response = await handler(
			new Request('https://example.com/nex', {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({ query: '{ hello }', extensions: 'nope' }),
			})
		);

		expect(response.status).toBe(400);
		expect(await response.json()).toMatchObject({
			errors: [
				{ message: expect.stringMatching(/"extensions" must be an object/) },
			],
		});
	});

	it('runs under the trace the caller named', async () => {
		const response = await handler(
			new Request('https://example.com/nex', {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({
					query: '{ hello }',
					extensions: { traceId: 'from-the-caller' },
				}),
			})
		);

		expect(await response.json()).toMatchObject({
			extensions: { traceId: 'from-the-caller' },
		});
	});

	it('names the run itself when the caller did not', async () => {
		const body = (await (await post('{ hello }')).json()) as {
			extensions: { traceId?: string };
		};

		expect(body.extensions.traceId).toEqual(expect.any(String));
		expect(body.extensions.traceId).not.toBe('');
	});

	it('ignores a trace that is not a name', async () => {
		const response = await handler(
			new Request('https://example.com/nex', {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({
					query: '{ hello }',
					extensions: { traceId: 42 },
				}),
			})
		);

		const body = (await response.json()) as {
			extensions: { traceId?: string };
		};

		expect(response.status).toBe(200);
		expect(body.extensions.traceId).toEqual(expect.any(String));
	});

	it('reads extensions off a request sent with GET', async () => {
		const response = await handler(
			new Request(
				`https://example.com/nex?query=${encodeURIComponent('{ hello }')}&extensions=${encodeURIComponent(
					JSON.stringify({ traceId: 'from-a-link' })
				)}`
			)
		);

		expect(await response.json()).toMatchObject({
			extensions: { traceId: 'from-a-link' },
		});
	});

	it('refuses extensions that are not JSON on GET', async () => {
		const response = await handler(
			new Request(
				`https://example.com/nex?query=${encodeURIComponent('{ hello }')}&extensions=not-json`
			)
		);

		expect(response.status).toBe(400);
	});
});
