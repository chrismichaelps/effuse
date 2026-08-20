/**
 * MIT License
 *
 * Copyright (c) 2025 Chris M. Perez
 */

import { describe, expect, it } from 'vitest';
import {
	type LiveSources,
	type Resolvers,
	buildCatalog,
	toEventStream,
} from '../index.js';
import {
	handleProtocolRequest,
	type HttpResponse,
} from '../transport/index.js';

const catalog = buildCatalog(`
	schema { query: Query mutation: Mutation live: Live }
	type Query { hello: String! echo(text: String!): String! slow: String! }
	type Mutation { touch: Boolean! }
	type Live { ticks: Int! }
`);

const resolvers: Resolvers = {
	Query: {
		hello: () => 'world',
		echo: (_source, args) => String(args.text),
		slow: () => 'done',
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

const post = (body: unknown, headers: Record<string, string> = {}) =>
	handleProtocolRequest(
		{
			method: 'POST',
			url: '/nex',
			headers: { 'content-type': 'application/json', ...headers },
			body: typeof body === 'string' ? body : JSON.stringify(body),
		},
		{ catalog, resolvers, sources }
	);

const get = (query: string) =>
	handleProtocolRequest(
		{ method: 'GET', url: `/nex?${query}`, headers: {} },
		{ catalog, resolvers, sources }
	);

const jsonOf = (response: HttpResponse): unknown =>
	JSON.parse(typeof response.body === 'string' ? response.body : '');

describe('POST', () => {
	it('runs a request and answers with the response shape', async () => {
		const response = await post({ query: '{ hello }' });

		expect(response.status).toBe(200);
		expect(response.headers['content-type']).toBe(
			'application/json; charset=utf-8'
		);
		expect(jsonOf(response)).toMatchObject({ data: { hello: 'world' } });
	});

	it('passes variables and the operation name through', async () => {
		const response = await post({
			query: 'query A($text: String!) { echo(text: $text) } query B { hello }',
			variables: { text: 'hi' },
			operationName: 'A',
		});

		expect(jsonOf(response)).toMatchObject({ data: { echo: 'hi' } });
	});

	it('accepts a mutation', async () => {
		expect(jsonOf(await post({ query: 'mutation { touch }' }))).toMatchObject({
			data: { touch: true },
		});
	});

	it('rejects a body that is not JSON', async () => {
		const response = await post('{ not json');

		expect(response.status).toBe(400);
		expect(jsonOf(response)).toMatchObject({
			errors: [{ message: expect.stringMatching(/JSON/i) }],
		});
	});

	it('rejects a body with no query in it', async () => {
		const response = await post({ variables: {} });

		expect(response.status).toBe(400);
		expect(jsonOf(response)).toMatchObject({
			errors: [{ message: expect.stringMatching(/"query"/) }],
		});
	});

	it('rejects a content type it cannot read', async () => {
		const response = await post(
			{ query: '{ hello }' },
			{ 'content-type': 'text/plain' }
		);

		expect(response.status).toBe(415);
	});

	it('answers 400 when the request does not agree with the catalog', async () => {
		const response = await post({ query: '{ nope }' });

		expect(response.status).toBe(400);
		expect(jsonOf(response)).toMatchObject({
			errors: [{ message: expect.stringMatching(/Cannot query field "nope"/) }],
		});
	});

	it('answers 400 when a required variable was not supplied', async () => {
		const response = await post({
			query: 'query A($text: String!) { echo(text: $text) }',
		});

		expect(response.status).toBe(400);
		expect(jsonOf(response)).toMatchObject({
			errors: [{ message: expect.stringMatching(/\$text/) }],
		});
	});

	it('answers 200 when a field failed but the rest resolved', async () => {
		const response = await handleProtocolRequest(
			{
				method: 'POST',
				url: '/nex',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({ query: '{ hello }' }),
			},
			{
				catalog,
				resolvers: {
					Query: {
						hello: () => {
							throw new Error('resolver failed');
						},
					},
				},
			}
		);

		expect(response.status).toBe(200);
		expect(jsonOf(response)).toMatchObject({
			errors: [{ message: 'resolver failed' }],
		});
	});
});

describe('GET', () => {
	it('runs a safe query from the query string', async () => {
		const response = await get('query=%7B%20hello%20%7D');

		expect(response.status).toBe(200);
		expect(jsonOf(response)).toMatchObject({ data: { hello: 'world' } });
	});

	it('reads variables from the query string', async () => {
		const response = await get(
			`query=${encodeURIComponent('query A($text: String!) { echo(text: $text) }')}&variables=${encodeURIComponent('{"text":"hi"}')}`
		);

		expect(jsonOf(response)).toMatchObject({ data: { echo: 'hi' } });
	});

	it('refuses a mutation, and says what it will accept', async () => {
		const response = await get(
			`query=${encodeURIComponent('mutation { touch }')}`
		);

		expect(response.status).toBe(405);
		expect(response.headers.allow).toBe('POST');
	});

	it('rejects variables that are not JSON', async () => {
		const response = await get('query=%7B%20hello%20%7D&variables=nope');

		expect(response.status).toBe(400);
	});
});

describe('other methods', () => {
	it('refuses anything but GET and POST', async () => {
		const response = await handleProtocolRequest(
			{ method: 'DELETE', url: '/nex', headers: {} },
			{ catalog, resolvers }
		);

		expect(response.status).toBe(405);
		expect(response.headers.allow).toBe('GET, POST');
	});
});

describe('batching', () => {
	it('answers a list of requests with a list of results, in order', async () => {
		const response = await post([
			{ query: '{ hello }' },
			{
				query: 'query A($text: String!) { echo(text: $text) }',
				variables: { text: 'two' },
			},
		]);

		expect(response.status).toBe(200);
		expect(jsonOf(response)).toMatchObject([
			{ data: { hello: 'world' } },
			{ data: { echo: 'two' } },
		]);
	});

	it('keeps one failing request from spoiling the others', async () => {
		const response = await post([
			{ query: '{ nope }' },
			{ query: '{ hello }' },
		]);
		const results = jsonOf(response) as { data: unknown }[];

		expect(response.status).toBe(200);
		expect(results[0]).toMatchObject({ data: null });
		expect(results[1]).toMatchObject({ data: { hello: 'world' } });
	});

	it('refuses a batch larger than the limit', async () => {
		const response = await handleProtocolRequest(
			{
				method: 'POST',
				url: '/nex',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify([{ query: '{ hello }' }, { query: '{ hello }' }]),
			},
			{ catalog, resolvers, maxBatchSize: 1 }
		);

		expect(response.status).toBe(400);
		expect(jsonOf(response)).toMatchObject({
			errors: [{ message: expect.stringMatching(/batch/i) }],
		});
	});

	it('refuses an empty batch', async () => {
		expect((await post([])).status).toBe(400);
	});
});

describe('live operations over the wire', () => {
	it('answers with an event stream', async () => {
		const response = await post({ query: 'live L { ticks }' });

		expect(response.status).toBe(200);
		expect(response.headers['content-type']).toBe('text/event-stream');
		expect(response.headers['cache-control']).toBe('no-cache');
		expect(response.stream).toBeDefined();
	});

	it('frames each snapshot as one event', async () => {
		const response = await post({ query: 'live L { ticks }' });
		const frames: string[] = [];
		for await (const frame of response.stream ?? []) frames.push(frame);

		expect(frames).toHaveLength(3);
		expect(frames[0]).toMatch(/^event: next\ndata: \{"data":\{"ticks":1\}/);
		expect(frames.at(-1)).toBe('event: complete\ndata: {}\n\n');
	});

	it('frames a stream of results on its own', async () => {
		const stream = toEventStream(
			(async function* () {
				yield { data: { a: 1 }, extensions: { cost: 1 } };
			})()
		);
		const frames: string[] = [];
		for await (const frame of stream) frames.push(frame);

		expect(frames[0]).toContain('"data":{"a":1}');
		expect(frames).toHaveLength(2);
	});
});
