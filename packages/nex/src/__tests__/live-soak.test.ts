/**
 * MIT License
 *
 * Copyright (c) 2025 Chris M. Perez
 */

import { describe, expect, it } from 'vitest';
import {
	buildCatalog,
	createNexHandler,
	nexLive,
	createNexClient,
} from '../index.js';
import type { ExecutionResult } from '../index.js';

const catalog = buildCatalog(`
	type Query { hello: String! }
	type Beat { count: Int! label: String! }
	type Live { beat: Beat! }
	schema { query: Query, live: Live }
`);

/**
 * Text that does not fit in one byte per character.
 *
 * Chunks are cut without regard for characters, so a name like this is
 * eventually split part way through one - which is the case a decoder that
 * does not hold its state gets wrong, and nothing here would have noticed
 * with plain ASCII.
 */
const LABEL = 'ある日 — café ☕ naïve';

/** How many events one connection carries here. */
const EVENTS = 2_000;

/**
 * Cut a stream into pieces that pay no attention to where frames end.
 *
 * A network does not deliver one frame per chunk, and a long connection is
 * where that stops being theoretical: it splits mid-frame, mid-line, and part
 * way through a multi-byte character. Reading it back is the parser's whole
 * job, so the soak has to actually give it that.
 */
const shredded = (
	body: ReadableStream<Uint8Array>
): ReadableStream<Uint8Array> => {
	const reader = body.getReader();
	let held: Uint8Array<ArrayBuffer> = new Uint8Array(0);
	let cut = 1;

	return new ReadableStream<Uint8Array>({
		pull: async (controller) => {
			while (held.length === 0) {
				const next = await reader.read();
				if (next.done === true) {
					controller.close();
					return;
				}
				held = next.value as Uint8Array<ArrayBuffer>;
			}

			// Sizes that keep changing, so a frame is split in a different
			// place every time rather than always at the same offset.
			cut = (cut % 7) + 1;
			const size = Math.min(cut, held.length);
			controller.enqueue(held.slice(0, size));
			held = held.slice(size);
		},
		cancel: async () => {
			await reader.cancel().catch(() => undefined);
		},
	});
};

/** A fetch that answers from the handler, then shreds what it answered. */
const overTheWire = (count: number) =>
	(async (url: string, init: RequestInit) => {
		const answer = await handler(count)(new Request(url, init));
		return new Response(answer.body === null ? null : shredded(answer.body), {
			headers: answer.headers,
			status: answer.status,
		});
	}) as unknown as typeof fetch;

const handler = (count: number) =>
	createNexHandler({
		catalog,
		sources: {
			Live: {
				beat: async function* () {
					for (let index = 1; index <= count; index += 1) {
						yield { count: index, label: LABEL };
						// Give the loop back to the event loop the way a real
						// source does, or nothing else ever runs.
						if (index % 100 === 0) await Promise.resolve();
					}
				},
			},
		},
	});

describe('a live connection that runs for a long time', () => {
	it('carries every event without losing one', async () => {
		const nex = createNexClient({
			endpoint: 'https://example.com/nex',
			cache: false,
			fetch: overTheWire(EVENTS),
		});

		let seen = 0;
		let last = 0;
		for await (const snapshot of nex.subscribe(
			'live L { beat { count label } }'
		)) {
			const read = (
				snapshot.data as { beat: { count: number; label: string } } | null
			)?.beat;
			if (read === undefined) continue;

			// Split across chunks and put back together as it was written.
			expect(read.label).toBe(LABEL);

			// Every event, in order, exactly once: a frame lost to buffering
			// or a boundary would show up as a gap here rather than as a
			// number that happens to be smaller.
			expect(read.count).toBe(last + 1);
			last = read.count;
			seen += 1;
		}

		expect(seen).toBe(EVENTS);
	}, 30_000);

	it('holds nothing per event once the last listener goes', async () => {
		const nex = createNexClient({
			endpoint: 'https://example.com/nex',
			cache: false,
			fetch: overTheWire(EVENTS),
		});

		const live = nexLive(nex, 'live L { beat { count label } }');

		let seen = 0;
		await new Promise<void>((resolve) => {
			const stop = live.subscribe((snapshot: ExecutionResult) => {
				seen += 1;
				if (
					(snapshot.data as { beat: { count: number } }).beat.count === EVENTS
				) {
					stop();
					resolve();
				}
			});
		});

		live.stop();

		// What a shared source keeps is one snapshot and its listeners, not a
		// record of everything it has ever carried.
		expect(seen).toBe(EVENTS);
		expect(live.snapshot()).toBeUndefined();
	}, 30_000);

	it('keeps one snapshot rather than a record of them all', async () => {
		const nex = createNexClient({
			endpoint: 'https://example.com/nex',
			cache: false,
			fetch: overTheWire(EVENTS),
		});

		const live = nexLive(nex, 'live L { beat { count label } }');
		let seen = 0;

		await new Promise<void>((resolve) => {
			const stop = live.subscribe((snapshot: ExecutionResult) => {
				seen += 1;
				if (
					(snapshot.data as { beat: { count: number } }).beat.count === EVENTS
				) {
					stop();
					resolve();
				}
			});
		});

		// Two thousand events in, what it holds is the last one.
		expect(seen).toBe(EVENTS);
		expect(live.snapshot()?.data).toEqual({
			beat: { count: EVENTS, label: LABEL },
		});

		live.stop();
		expect(live.snapshot()).toBeUndefined();
	}, 30_000);
});
