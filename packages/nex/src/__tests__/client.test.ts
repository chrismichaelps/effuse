/**
 * MIT License
 *
 * Copyright (c) 2025 Chris M. Perez
 */

import { describe, expect, it, vi } from 'vitest';
import {
	NexErrorCode,
	createNexClient,
	createOperationStore,
	requestKey,
} from '../index.js';
import type { ExecutionResult } from '../index.js';

const ok = (data: Record<string, unknown>): Response =>
	new Response(JSON.stringify({ data, extensions: { cost: 1 } }), {
		status: 200,
		headers: { 'content-type': 'application/json' },
	});

const client = (
	fetchImpl: typeof fetch,
	options: Record<string, unknown> = {}
) => createNexClient({ endpoint: '/nex', fetch: fetchImpl, ...options });

describe('sending a request', () => {
	it('posts it and hands back what came back', async () => {
		const fetchImpl = vi.fn(async () => ok({ hello: 'world' }));
		const result = await client(fetchImpl as unknown as typeof fetch).request(
			'{ hello }'
		);

		expect(result.data).toEqual({ hello: 'world' });
		expect(fetchImpl).toHaveBeenCalledTimes(1);

		const [url, init] = fetchImpl.mock.calls[0] as unknown as [
			string,
			RequestInit,
		];
		expect(url).toBe('/nex');
		expect(init.method).toBe('POST');
		expect(JSON.parse(String(init.body))).toMatchObject({ query: '{ hello }' });
	});

	it('carries variables and the operation name', async () => {
		const fetchImpl = vi.fn(async () => ok({ echo: 'hi' }));
		await client(fetchImpl as unknown as typeof fetch).request(
			'query A($text: String!) { echo(text: $text) }',
			{ variables: { text: 'hi' }, operationName: 'A' }
		);

		expect(
			JSON.parse(String((fetchImpl.mock.calls[0] as never[])[1]?.['body']))
		).toMatchObject({
			variables: { text: 'hi' },
			operationName: 'A',
		});
	});

	it('carries the headers it was given', async () => {
		const fetchImpl = vi.fn(async () => ok({ hello: 'world' }));
		await client(fetchImpl as unknown as typeof fetch, {
			headers: { authorization: 'Bearer token' },
		}).request('{ hello }');

		const init = (fetchImpl.mock.calls[0] as never[])[1] as RequestInit;
		expect(init.headers).toMatchObject({
			'content-type': 'application/json',
			authorization: 'Bearer token',
		});
	});

	it('sends a name when the server already holds the operation', async () => {
		const operations = createOperationStore();
		await operations.register('{ hello }');
		const fetchImpl = vi.fn(async () => ok({ hello: 'world' }));

		await client(fetchImpl as unknown as typeof fetch, { operations }).request(
			'{ hello }'
		);

		const body = JSON.parse(
			String((fetchImpl.mock.calls[0] as never[])[1]?.['body'])
		) as Record<string, unknown>;
		expect(body.id).toBe(await requestKey('{ hello }'));
		expect(body.query).toBeUndefined();
	});
});

describe('when the request does not arrive', () => {
	it('reports a transport failure as a result, not a throw', async () => {
		const fetchImpl = vi.fn(async () => {
			throw new Error('offline');
		});
		const result = await client(fetchImpl as unknown as typeof fetch).request(
			'{ hello }'
		);

		expect(result.data).toBeNull();
		expect(result.errors?.[0]?.message).toContain('offline');
		expect(result.errors?.[0]?.code).toBe(NexErrorCode.INTERNAL);
	});

	it('reports a response the server could not answer', async () => {
		const fetchImpl = vi.fn(async () => new Response('nope', { status: 500 }));
		const result = await client(fetchImpl as unknown as typeof fetch).request(
			'{ hello }'
		);

		expect(result.errors?.[0]?.message).toMatch(/500/);
	});

	it('reports a body that is not a response shape', async () => {
		const fetchImpl = vi.fn(
			async () =>
				new Response('<html>error</html>', {
					status: 200,
					headers: { 'content-type': 'text/html' },
				})
		);
		const result = await client(fetchImpl as unknown as typeof fetch).request(
			'{ hello }'
		);

		expect(result.errors?.[0]?.message).toMatch(/could not be read/i);
	});
});

describe('asking for the same thing twice', () => {
	it('sends one request while another is in flight', async () => {
		// The deferred exists before either call, so resolving it does not race
		// the client working out the request's key.
		let answer: (value: Response) => void = () => undefined;
		const pending = new Promise<Response>((resolve) => {
			answer = resolve;
		});
		const fetchImpl = vi.fn(async () => pending);
		// With nothing kept, sharing the request in flight is the only thing
		// that can stop a second one going out.
		const nex = client(fetchImpl as unknown as typeof fetch, { cache: false });

		const first = nex.request('{ hello }');
		const second = nex.request('{ hello }');

		// Both calls have to be in flight before the answer arrives; otherwise
		// the first would have finished and the second would rightly ask again.
		await new Promise((resolve) => setTimeout(resolve, 0));
		answer(ok({ hello: 'world' }));

		expect(await first).toEqual(await second);
		expect(fetchImpl).toHaveBeenCalledTimes(1);
	});

	it('answers from what it already has', async () => {
		const fetchImpl = vi.fn(async () => ok({ hello: 'world' }));
		const nex = client(fetchImpl as unknown as typeof fetch);

		await nex.request('{ hello }');
		const again = await nex.request('{ hello }');

		expect(again.data).toEqual({ hello: 'world' });
		expect(fetchImpl).toHaveBeenCalledTimes(1);
	});

	it('asks again when told to', async () => {
		const fetchImpl = vi.fn(async () => ok({ hello: 'world' }));
		const nex = client(fetchImpl as unknown as typeof fetch);

		await nex.request('{ hello }');
		await nex.request('{ hello }', { refresh: true });

		expect(fetchImpl).toHaveBeenCalledTimes(2);
	});

	it('keeps nothing when asked not to', async () => {
		const fetchImpl = vi.fn(async () => ok({ hello: 'world' }));
		const nex = client(fetchImpl as unknown as typeof fetch, { cache: false });

		await nex.request('{ hello }');
		await nex.request('{ hello }');

		expect(fetchImpl).toHaveBeenCalledTimes(2);
	});

	it('never keeps a request that failed', async () => {
		const fetchImpl = vi
			.fn()
			.mockResolvedValueOnce(new Response('nope', { status: 500 }))
			.mockResolvedValueOnce(ok({ hello: 'world' }));
		const nex = client(fetchImpl as unknown as typeof fetch);

		await nex.request('{ hello }');
		const second = await nex.request('{ hello }');

		expect(second.data).toEqual({ hello: 'world' });
		expect(fetchImpl).toHaveBeenCalledTimes(2);
	});
});

describe('handing a render to the browser', () => {
	it('carries what the server resolved into the client', async () => {
		const server = client(
			vi.fn(async () =>
				ok({ hello: 'from the server' })
			) as unknown as typeof fetch
		);
		await server.prefetch('{ hello }');

		const browserFetch = vi.fn(async () => ok({ hello: 'from the browser' }));
		const browser = client(browserFetch as unknown as typeof fetch);
		browser.hydrate(server.dehydrate());

		const result = await browser.request('{ hello }');

		expect(result.data).toEqual({ hello: 'from the server' });
		expect(browserFetch).not.toHaveBeenCalled();
	});

	it('carries a payload that survives JSON', async () => {
		const server = client(
			vi.fn(async () => ok({ hello: 'world' })) as unknown as typeof fetch
		);
		await server.prefetch('{ hello }');

		const payload = JSON.parse(
			JSON.stringify(server.dehydrate())
		) as ReturnType<typeof server.dehydrate>;
		const browser = client(vi.fn() as unknown as typeof fetch);
		browser.hydrate(payload);

		expect((await browser.request('{ hello }')).data).toEqual({
			hello: 'world',
		});
	});

	it('keys what it carries by what the request does', async () => {
		const server = client(
			vi.fn(async () => ok({ hello: 'world' })) as unknown as typeof fetch
		);
		await server.prefetch('{ hello }');

		expect(server.dehydrate().results[0]?.key).toBe(
			await requestKey('{ hello }')
		);
	});

	it('forgets everything when asked', async () => {
		const fetchImpl = vi.fn(async () => ok({ hello: 'world' }));
		const nex = client(fetchImpl as unknown as typeof fetch);

		await nex.request('{ hello }');
		nex.clear();
		await nex.request('{ hello }');

		expect(fetchImpl).toHaveBeenCalledTimes(2);
	});
});

describe('watching a live operation', () => {
	const eventStream = (frames: readonly string[]): Response =>
		new Response(
			new ReadableStream<Uint8Array>({
				start: (controller) => {
					for (const frame of frames) {
						controller.enqueue(new TextEncoder().encode(frame));
					}
					controller.close();
				},
			}),
			{ status: 200, headers: { 'content-type': 'text/event-stream' } }
		);

	it('reads each snapshot the server sent', async () => {
		const fetchImpl = vi.fn(async () =>
			eventStream([
				'event: next\ndata: {"data":{"ticks":1},"extensions":{"cost":1}}\n\n',
				'event: next\ndata: {"data":{"ticks":2},"extensions":{"cost":1}}\n\n',
				'event: complete\ndata: {}\n\n',
			])
		);
		const results: ExecutionResult[] = [];

		for await (const snapshot of client(
			fetchImpl as unknown as typeof fetch
		).subscribe('live L { ticks }')) {
			results.push(snapshot);
		}

		expect(results.map((result) => result.data)).toEqual([
			{ ticks: 1 },
			{ ticks: 2 },
		]);
	});

	it('reads a frame split across chunks', async () => {
		const fetchImpl = vi.fn(async () =>
			eventStream([
				'event: next\ndata: {"data":{"ti',
				'cks":1},"extensions":{"cost":1}}\n\n',
				'event: complete\ndata: {}\n\n',
			])
		);
		const results: ExecutionResult[] = [];

		for await (const snapshot of client(
			fetchImpl as unknown as typeof fetch
		).subscribe('live L { ticks }')) {
			results.push(snapshot);
		}

		expect(results).toHaveLength(1);
		expect(results[0]?.data).toEqual({ ticks: 1 });
	});
});
