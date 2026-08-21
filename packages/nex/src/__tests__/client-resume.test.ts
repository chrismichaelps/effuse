/**
 * MIT License
 *
 * Copyright (c) 2025 Chris M. Perez
 */

import { describe, expect, it } from 'vitest';
import { createNexClient, readEventStream } from '../index.js';
import type { ExecutionResult } from '../index.js';

const streamOf = (text: string): ReadableStream<Uint8Array> =>
	new ReadableStream({
		start: (controller) => {
			controller.enqueue(new TextEncoder().encode(text));
			controller.close();
		},
	});

const frame = (id: number, data: unknown) =>
	`id: ${String(id)}\nevent: next\ndata: ${JSON.stringify(data)}\n\n`;

const drain = async (
	stream: AsyncGenerator<ExecutionResult>,
	limit = 10
): Promise<ExecutionResult[]> => {
	const out: ExecutionResult[] = [];
	for await (const one of stream) {
		out.push(one);
		if (out.length === limit) break;
	}
	return out;
};

describe('reading the number an event carried', () => {
	it('hands back the id alongside the snapshot', async () => {
		const seen: (string | undefined)[] = [];
		const stream = readEventStream(
			streamOf(
				frame(1, { data: { beat: 1 } }) + frame(2, { data: { beat: 2 } })
			),
			{ onEventId: (id) => seen.push(id) }
		);

		await drain(stream);

		expect(seen).toEqual(['1', '2']);
	});

	it('says nothing for a frame that carried none', async () => {
		const seen: (string | undefined)[] = [];
		await drain(
			readEventStream(streamOf('event: next\ndata: {"data":{"beat":1}}\n\n'), {
				onEventId: (id) => seen.push(id),
			})
		);

		expect(seen).toEqual([]);
	});

	it('reads a stream the same as before when nobody is watching ids', async () => {
		const seen = await drain(
			readEventStream(streamOf(frame(1, { data: { beat: 1 } })))
		);

		expect(seen).toEqual([{ data: { beat: 1 } }]);
	});
});

describe('a live connection that dropped', () => {
	/** A server that ends the stream early the first time, then behaves. */
	const flaky = () => {
		const sent: (string | null)[] = [];
		let attempt = 0;

		const fetchImpl = (async (_url: string, init: RequestInit) => {
			attempt += 1;
			const headers = new Headers(init.headers);
			sent.push(headers.get('last-event-id'));

			const body =
				attempt === 1
					? frame(1, { data: { beat: 1 } })
					: frame(2, { data: { beat: 2 } }) + 'event: complete\ndata: {}\n\n';

			return new Response(streamOf(body), {
				headers: { 'content-type': 'text/event-stream' },
			});
		}) as unknown as typeof fetch;

		return { fetchImpl, sent, attempts: () => attempt };
	};

	it('is picked back up, saying where it got to', async () => {
		const server = flaky();
		const nex = createNexClient({
			endpoint: '/nex',
			cache: false,
			fetch: server.fetchImpl,
			live: { retries: 2, backoffMs: 0 },
		});

		const seen = await drain(nex.subscribe('live L { beat }'));

		expect(seen.map((one) => one.data)).toEqual([{ beat: 1 }, { beat: 2 }]);
		expect(server.sent).toEqual([null, '1']);
	});

	it('is left alone when the server said it was done', async () => {
		let attempts = 0;
		const fetchImpl = (async () => {
			attempts += 1;
			return new Response(
				streamOf(
					frame(1, { data: { beat: 1 } }) + 'event: complete\ndata: {}\n\n'
				),
				{ headers: { 'content-type': 'text/event-stream' } }
			);
		}) as unknown as typeof fetch;

		const nex = createNexClient({
			endpoint: '/nex',
			cache: false,
			fetch: fetchImpl,
			live: { retries: 2, backoffMs: 0 },
		});

		await drain(nex.subscribe('live L { beat }'));

		// An ending is not a drop: coming back would start it again.
		expect(attempts).toBe(1);
	});

	it('gives up after the tries it was given', async () => {
		let attempts = 0;
		const fetchImpl = (async () => {
			attempts += 1;
			return new Response(streamOf(frame(attempts, { data: { beat: 1 } })), {
				headers: { 'content-type': 'text/event-stream' },
			});
		}) as unknown as typeof fetch;

		const nex = createNexClient({
			endpoint: '/nex',
			cache: false,
			fetch: fetchImpl,
			live: { retries: 2, backoffMs: 0 },
		});

		await drain(nex.subscribe('live L { beat }'), 50);

		// One try, then the two it was allowed.
		expect(attempts).toBe(3);
	});

	it('stays down when it was not asked to come back', async () => {
		let attempts = 0;
		const fetchImpl = (async () => {
			attempts += 1;
			return new Response(streamOf(frame(1, { data: { beat: 1 } })), {
				headers: { 'content-type': 'text/event-stream' },
			});
		}) as unknown as typeof fetch;

		const nex = createNexClient({
			endpoint: '/nex',
			cache: false,
			fetch: fetchImpl,
		});

		await drain(nex.subscribe('live L { beat }'), 50);

		expect(attempts).toBe(1);
	});

	it('does not wait out a backoff the caller will never see', async () => {
		const controller = new AbortController();
		const fetchImpl = (async () => {
			controller.abort();
			return new Response(streamOf(frame(1, { data: { beat: 1 } })), {
				headers: { 'content-type': 'text/event-stream' },
			});
		}) as unknown as typeof fetch;

		const nex = createNexClient({
			endpoint: '/nex',
			cache: false,
			fetch: fetchImpl,
			live: { retries: 3, backoffMs: 3_000 },
		});

		const started = Date.now();
		await drain(
			nex.subscribe('live L { beat }', { signal: controller.signal }),
			50
		);

		expect(Date.now() - started).toBeLessThan(1_000);
	});

	it('does not come back once the caller has gone', async () => {
		const controller = new AbortController();
		let attempts = 0;
		const fetchImpl = (async () => {
			attempts += 1;
			controller.abort();
			return new Response(streamOf(frame(1, { data: { beat: 1 } })), {
				headers: { 'content-type': 'text/event-stream' },
			});
		}) as unknown as typeof fetch;

		const nex = createNexClient({
			endpoint: '/nex',
			cache: false,
			fetch: fetchImpl,
			live: { retries: 3, backoffMs: 0 },
		});

		await drain(
			nex.subscribe('live L { beat }', { signal: controller.signal }),
			50
		);

		expect(attempts).toBe(1);
	});
});
