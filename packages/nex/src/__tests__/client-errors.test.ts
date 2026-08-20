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
	NexErrorCode,
	NexExecutionError,
} from '../index.js';

const catalog = buildCatalog(`
	type Query { hello: String! broken: String? }
	schema { query: Query }
`);

const handler = createNexHandler({
	catalog,
	resolvers: {
		Query: {
			hello: () => 'hi',
			broken: () => {
				throw new Error('the source is down');
			},
		},
	},
});

const client = () =>
	createNexClient({
		endpoint: 'http://render/nex',
		cache: false,
		fetch: ((url: string, init: RequestInit) =>
			handler(new Request(url, init))) as unknown as typeof fetch,
	});

describe('what a client hands back when something failed', () => {
	it('hands back errors that are errors', async () => {
		const result = await client().request('{ broken }');
		const [error] = result.errors ?? [];

		// They arrive as JSON and were being handed on as whatever JSON.parse
		// produced, which the types called an error and nothing else did.
		expect(error).toBeInstanceOf(NexExecutionError);
		expect(error).toBeInstanceOf(Error);
	});

	it('keeps what the server said about it', async () => {
		const result = await client().request('{ broken }');
		const [error] = result.errors ?? [];

		expect(error?.message).toBe('the source is down');
		expect(error?.path).toEqual(['broken']);
		// The code the server chose, not a default put on at this end.
		expect(error?.code).toBe(NexErrorCode.RESOLVER);
	});

	it('can be told apart without instanceof', async () => {
		const result = await client().request('{ broken }');

		expect(result.errors?.[0]?._tag).toBe('NexExecutionError');
	});

	it('throws a real error when thrown', async () => {
		const result = await client().request('{ broken }');

		expect(() => {
			throw result.errors?.[0];
		}).toThrow(/the source is down/);
	});

	it('reads a request problem the same way', async () => {
		const result = await client().request('{ nope }');
		const [error] = result.errors ?? [];

		expect(error).toBeInstanceOf(NexExecutionError);
		expect(error?.message).toMatch(/Cannot query field "nope"/);
	});

	it('leaves an answer that worked alone', async () => {
		const result = await client().request('{ hello }');

		expect(result.errors).toBeUndefined();
		expect(result.data).toEqual({ hello: 'hi' });
	});

	it('survives a server that sent nonsense for an error', async () => {
		const nonsense = createNexClient({
			endpoint: '/nex',
			cache: false,
			fetch: (async () =>
				new Response(
					JSON.stringify({ data: null, errors: ['just a string', null] }),
					{ headers: { 'content-type': 'application/json' } }
				)) as unknown as typeof fetch,
		});

		const result = await nonsense.request('{ hello }');

		expect(result.errors?.[0]).toBeInstanceOf(NexExecutionError);
		expect(result.errors).toHaveLength(2);
	});

	it('reads the errors of every answer in a batch', async () => {
		const batched = createNexClient({
			endpoint: 'http://render/nex',
			cache: false,
			batch: true,
			fetch: ((url: string, init: RequestInit) =>
				handler(new Request(url, init))) as unknown as typeof fetch,
		});

		const [first, second] = await Promise.all([
			batched.request('{ broken }'),
			batched.request('{ nope }'),
		]);

		expect(first.errors?.[0]).toBeInstanceOf(NexExecutionError);
		expect(second.errors?.[0]).toBeInstanceOf(NexExecutionError);
	});
});
