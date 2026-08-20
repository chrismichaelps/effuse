/**
 * MIT License
 *
 * Copyright (c) 2025 Chris M. Perez
 */

import { describe, expect, it, vi } from 'vitest';
import { buildCatalog, createNexClient, createNexHandler } from '../index.js';

const catalog = buildCatalog(`
	type Query { hello: String! echo(text: String!): String! }
	schema { query: Query }
`);

const handler = createNexHandler({
	catalog,
	resolvers: {
		Query: {
			hello: () => 'world',
			echo: (_source, args) => String(args.text),
		},
	},
});

/** A fetch that answers from the real handler, counting the round trips. */
const countingFetch = () => {
	const calls: unknown[] = [];
	const fetchImpl = async (_url: string, init: RequestInit) => {
		calls.push(JSON.parse(String(init.body)));
		return handler(
			new Request('https://example.com/nex', {
				method: 'POST',
				headers: init.headers as HeadersInit,
				body: init.body as BodyInit,
			})
		);
	};

	return { calls, fetchImpl: fetchImpl as unknown as typeof fetch };
};

describe('sending several requests at once', () => {
	it('sends one round trip for requests made together', async () => {
		const { calls, fetchImpl } = countingFetch();
		const nex = createNexClient({
			endpoint: '/nex',
			fetch: fetchImpl,
			cache: false,
			batch: true,
		});

		const [first, second] = await Promise.all([
			nex.request('{ hello }'),
			nex.request('query E($text: String!) { echo(text: $text) }', {
				variables: { text: 'two' },
			}),
		]);

		expect(calls).toHaveLength(1);
		expect(Array.isArray(calls[0])).toBe(true);
		expect(first.data).toEqual({ hello: 'world' });
		expect(second.data).toEqual({ echo: 'two' });
	});

	it('gives each caller its own answer, in the right order', async () => {
		const { fetchImpl } = countingFetch();
		const nex = createNexClient({
			endpoint: '/nex',
			fetch: fetchImpl,
			cache: false,
			batch: true,
		});

		const answers = await Promise.all(
			['one', 'two', 'three'].map((text) =>
				nex.request('query E($text: String!) { echo(text: $text) }', {
					variables: { text },
				})
			)
		);

		expect(answers.map((answer) => answer.data)).toEqual([
			{ echo: 'one' },
			{ echo: 'two' },
			{ echo: 'three' },
		]);
	});

	it('keeps a batch to the size it was given', async () => {
		const { calls, fetchImpl } = countingFetch();
		const nex = createNexClient({
			endpoint: '/nex',
			fetch: fetchImpl,
			cache: false,
			batch: { size: 2 },
		});

		await Promise.all(
			['a', 'b', 'c'].map((text) =>
				nex.request('query E($text: String!) { echo(text: $text) }', {
					variables: { text },
				})
			)
		);

		// Two travel together as soon as the batch is full; the one left over
		// goes on its own, which is how a lone request is always sent.
		expect(calls).toHaveLength(2);
		expect((calls[0] as unknown[]).length).toBe(2);
		expect(Array.isArray(calls[1])).toBe(false);
	});

	it('sends batches in the order they were formed', async () => {
		const { calls, fetchImpl } = countingFetch();
		const nex = createNexClient({
			endpoint: '/nex',
			fetch: fetchImpl,
			cache: false,
			batch: { size: 2 },
		});

		// Working out what to send costs a turn of the event loop, so a later
		// batch that finishes that work sooner must still wait its turn.
		await Promise.all(
			['a', 'b', 'c', 'd', 'e'].map((text) =>
				nex.request('query E($text: String!) { echo(text: $text) }', {
					variables: { text },
				})
			)
		);

		const sent = calls.map((call) =>
			(Array.isArray(call) ? call : [call]).map(
				(one) => (one as { variables: { text: string } }).variables.text
			)
		);

		expect(sent).toEqual([['a', 'b'], ['c', 'd'], ['e']]);
	});

	it('does not strand the batches behind one that could not be prepared', async () => {
		const { calls, fetchImpl } = countingFetch();
		const nex = createNexClient({
			endpoint: '/nex',
			fetch: fetchImpl,
			cache: false,
			batch: { size: 1 },
		});

		// A runtime without a usable digest - an insecure browsing context, an
		// old engine - fails a request while it is being prepared, before
		// anything is sent. What is queued behind it must still go.
		const digest = crypto.subtle.digest;
		let broken = true;
		vi.spyOn(crypto.subtle, 'digest').mockImplementation(async (...args) => {
			if (broken) {
				broken = false;
				throw new Error('no digest here');
			}
			return digest.apply(crypto.subtle, args as Parameters<typeof digest>);
		});

		const [first, second] = await Promise.all([
			nex.request('{ hello }'),
			nex.request('{ goodbye }'),
		]);

		vi.restoreAllMocks();

		expect(first.errors?.[0]?.message).toMatch(/never reached/);
		expect(second.data).toBeDefined();
		expect(calls).toHaveLength(1);
	});

	it('sends one request on its own as one request', async () => {
		const { calls, fetchImpl } = countingFetch();
		const nex = createNexClient({
			endpoint: '/nex',
			fetch: fetchImpl,
			cache: false,
			batch: true,
		});

		await nex.request('{ hello }');

		expect(Array.isArray(calls[0])).toBe(false);
		expect(calls[0]).toMatchObject({ query: '{ hello }' });
	});

	it('does not batch unless it was asked to', async () => {
		const { calls, fetchImpl } = countingFetch();
		const nex = createNexClient({
			endpoint: '/nex',
			fetch: fetchImpl,
			cache: false,
		});

		// Two different requests, so in-flight sharing cannot be what joins
		// them: without batching each one is its own round trip.
		await Promise.all([
			nex.request('query E($text: String!) { echo(text: $text) }', {
				variables: { text: 'one' },
			}),
			nex.request('query E($text: String!) { echo(text: $text) }', {
				variables: { text: 'two' },
			}),
		]);

		expect(calls).toHaveLength(2);
	});

	it('carries a failure to the caller it belongs to', async () => {
		const { fetchImpl } = countingFetch();
		const nex = createNexClient({
			endpoint: '/nex',
			fetch: fetchImpl,
			cache: false,
			batch: true,
		});

		const [good, bad] = await Promise.all([
			nex.request('{ hello }'),
			nex.request('{ nope }'),
		]);

		expect(good.data).toEqual({ hello: 'world' });
		expect(bad.data).toBeNull();
		expect(bad.errors?.[0]?.message).toMatch(/Cannot query field "nope"/);
	});

	it('answers every caller when the round trip itself fails', async () => {
		const nex = createNexClient({
			endpoint: '/nex',
			cache: false,
			batch: true,
			fetch: (async () => {
				throw new Error('offline');
			}) as unknown as typeof fetch,
		});

		const answers = await Promise.all([
			nex.request('{ hello }'),
			nex.request('{ hello }', { variables: { differs: true } }),
		]);

		expect(answers).toHaveLength(2);
		for (const answer of answers) {
			expect(answer.errors?.[0]?.message).toContain('offline');
		}
	});

	it('never batches a live operation', async () => {
		const { calls, fetchImpl } = countingFetch();
		const nex = createNexClient({
			endpoint: '/nex',
			fetch: fetchImpl,
			cache: false,
			batch: true,
		});

		await nex.request('{ hello }');
		expect(calls).toHaveLength(1);

		const stream = nex.subscribe('live L { ticks }');
		await stream.next().catch(() => undefined);

		expect(Array.isArray(calls.at(-1))).toBe(false);
	});
});

describe('a batch that a server refuses', () => {
	it('tells every caller what the server said', async () => {
		const small = createNexHandler({ catalog, maxBatchSize: 1 });
		const nex = createNexClient({
			endpoint: '/nex',
			cache: false,
			batch: true,
			fetch: (async (_url: string, init: RequestInit) =>
				small(
					new Request('https://example.com/nex', {
						method: 'POST',
						headers: init.headers as HeadersInit,
						body: init.body as BodyInit,
					})
				)) as unknown as typeof fetch,
		});

		const answers = await Promise.all([
			nex.request('{ hello }'),
			nex.request('{ hello }', { variables: { differs: true } }),
		]);

		for (const answer of answers) {
			expect(answer.errors?.[0]?.message).toMatch(/batch/i);
		}
	});
});
