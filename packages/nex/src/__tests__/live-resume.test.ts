/**
 * MIT License
 *
 * Copyright (c) 2025 Chris M. Perez
 */

import { describe, expect, it } from 'vitest';
import { buildCatalog, createNexHandler, toEventStream } from '../index.js';
import type { ExecutionResult } from '../index.js';

const catalog = buildCatalog(`
	type Query { hello: String! }
	type Live { beat: Int! }
	schema { query: Query, live: Live }
`);

const framesOf = async (
	snapshots: AsyncIterable<ExecutionResult>,
	options?: Parameters<typeof toEventStream>[1]
): Promise<string> => {
	let out = '';
	for await (const frame of toEventStream(snapshots, options)) out += frame;
	return out;
};

const snapshots = async function* (
	count: number
): AsyncGenerator<ExecutionResult> {
	for (let index = 1; index <= count; index += 1) {
		yield { data: { beat: index }, extensions: { cost: 1 } };
	}
};

describe('an event a client can come back to', () => {
	it('numbers each snapshot it sends', async () => {
		const frames = await framesOf(snapshots(2));

		expect(frames).toContain('id: 1\n');
		expect(frames).toContain('id: 2\n');
	});

	it('numbers from where a client left off', async () => {
		const frames = await framesOf(snapshots(2), { startingId: 7 });

		expect(frames).toContain('id: 8\n');
		expect(frames).toContain('id: 9\n');
		expect(frames).not.toContain('id: 1\n');
	});

	it('still ends the stream so a drop can be told apart', async () => {
		const frames = await framesOf(snapshots(1));

		expect(frames).toContain('event: complete');
	});

	it('keeps the snapshot itself unchanged', async () => {
		const frames = await framesOf(snapshots(1));

		expect(frames).toContain(
			'data: {"data":{"beat":1},"extensions":{"cost":1}}'
		);
	});
});

describe('a connection nothing is coming down', () => {
	it('says it is still there', async () => {
		const quiet = async function* (): AsyncGenerator<ExecutionResult> {
			await new Promise((resolve) => setTimeout(resolve, 25));
			yield { data: { beat: 1 }, extensions: { cost: 1 } };
		};

		const frames = await framesOf(quiet(), { keepAliveMs: 5 });

		// A proxy closes a connection it has seen nothing on, and a comment
		// costs one line and keeps it open.
		expect(frames).toMatch(/^: /m);
		expect(frames).toContain('"beat":1');
	});

	it('says nothing when it was not asked to', async () => {
		const quiet = async function* (): AsyncGenerator<ExecutionResult> {
			await new Promise((resolve) => setTimeout(resolve, 20));
			yield { data: { beat: 1 }, extensions: { cost: 1 } };
		};

		const frames = await framesOf(quiet());

		expect(frames).not.toMatch(/^: /m);
	});

	it('stops saying it once the stream is over', async () => {
		const frames = await framesOf(snapshots(1), { keepAliveMs: 5 });

		expect(frames.endsWith('event: complete\ndata: {}\n\n')).toBe(true);
	});
});

describe('a client that came back', () => {
	it('tells the source where it got to', async () => {
		const seen: (number | undefined)[] = [];

		const handler = createNexHandler({
			catalog,
			sources: {
				Live: {
					beat: async function* (_args, _context, info) {
						seen.push(info.resumeFrom);
						yield 1;
					},
				},
			},
		});

		await handler(
			new Request('https://example.com/nex', {
				method: 'POST',
				headers: {
					'content-type': 'application/json',
					'last-event-id': '12',
				},
				body: JSON.stringify({ query: 'live L { beat }' }),
			})
		).then((response) => response.text());

		expect(seen).toEqual([12]);
	});

	it('says nothing when the client is starting fresh', async () => {
		const seen: (number | undefined)[] = [];

		const handler = createNexHandler({
			catalog,
			sources: {
				Live: {
					beat: async function* (_args, _context, info) {
						seen.push(info.resumeFrom);
						yield 1;
					},
				},
			},
		});

		await handler(
			new Request('https://example.com/nex', {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({ query: 'live L { beat }' }),
			})
		).then((response) => response.text());

		expect(seen).toEqual([undefined]);
	});

	it('ignores a resume point that is not a number', async () => {
		const seen: (number | undefined)[] = [];

		const handler = createNexHandler({
			catalog,
			sources: {
				Live: {
					beat: async function* (_args, _context, info) {
						seen.push(info.resumeFrom);
						yield 1;
					},
				},
			},
		});

		await handler(
			new Request('https://example.com/nex', {
				method: 'POST',
				headers: {
					'content-type': 'application/json',
					'last-event-id': 'nonsense',
				},
				body: JSON.stringify({ query: 'live L { beat }' }),
			})
		).then((response) => response.text());

		expect(seen).toEqual([undefined]);
	});

	it('carries on numbering from where the client left off', async () => {
		const handler = createNexHandler({
			catalog,
			sources: {
				Live: {
					beat: async function* () {
						yield 1;
					},
				},
			},
		});

		const response = await handler(
			new Request('https://example.com/nex', {
				method: 'POST',
				headers: {
					'content-type': 'application/json',
					'last-event-id': '4',
				},
				body: JSON.stringify({ query: 'live L { beat }' }),
			})
		);

		expect(await response.text()).toContain('id: 5\n');
	});
});
