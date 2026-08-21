/**
 * MIT License
 *
 * Copyright (c) 2025 Chris M. Perez
 */

import { describe, expect, it, vi } from 'vitest';
import { createNexClient, nexLive } from '../index.js';

/**
 * Wait for something to become true, rather than for a tick.
 *
 * A snapshot arrives after a fetch, a generator, a reader, and a decoder have
 * each had a turn, and how many turns that is depends on what else the
 * machine is doing - so waiting a fixed amount is waiting the wrong amount.
 */
const until = async (holds: () => boolean, what: string): Promise<void> => {
	for (let attempt = 0; attempt < 400; attempt += 1) {
		if (holds()) return;
		await new Promise((resolve) => setTimeout(resolve, 5));
	}
	throw new Error(`timed out waiting for ${what}`);
};

/** Let everything already queued run, for the cases that assert nothing. */
const settle = async (): Promise<void> => {
	for (let turn = 0; turn < 20; turn += 1) {
		await new Promise((resolve) => setTimeout(resolve, 1));
	}
};

/**
 * A server that streams what it is told, counting connections.
 *
 * It holds the stream open afterwards, the way a live operation does: one
 * that closes itself has nothing left to cancel, and cancelling is the whole
 * question here.
 */
const server = (frames: string[], { staysOpen = true } = {}) => {
	let opened = 0;
	const signals: AbortSignal[] = [];

	const fetchImpl = (async (_url: string, init: RequestInit) => {
		opened += 1;
		if (init.signal) signals.push(init.signal);

		return new Response(
			new ReadableStream({
				start: (controller) => {
					for (const frame of frames) {
						controller.enqueue(new TextEncoder().encode(frame));
					}
					if (!staysOpen) controller.close();

					// Real fetch tears the body down when the signal fires, and
					// on a stream the server is holding open that is the only
					// thing that ends a read already waiting on it.
					init.signal?.addEventListener('abort', () => {
						try {
							controller.error(new Error('aborted'));
						} catch {
							// Already finished.
						}
					});
				},
				cancel: () => undefined,
			}),
			{ headers: { 'content-type': 'text/event-stream' } }
		);
	}) as unknown as typeof fetch;

	// A connection is released by the request being called off, which is what
	// tears the body down; counting the stream's own cancel would miss it,
	// since an aborted stream is never cancelled by its reader.
	return {
		fetchImpl,
		opened: () => opened,
		released: () => signals.filter((one) => one.aborted).length,
	};
};

const beat = (n: number) =>
	`id: ${String(n)}\nevent: next\ndata: ${JSON.stringify({ data: { beat: n }, extensions: { cost: 1 } })}\n\n`;

const clientFor = (fetchImpl: typeof fetch) =>
	createNexClient({ endpoint: '/nex', cache: false, fetch: fetchImpl });

describe('a live operation something can watch', () => {
	it('hands each snapshot to whoever is listening', async () => {
		const s = server([beat(1), beat(2)]);
		const live = nexLive(clientFor(s.fetchImpl), 'live L { beat }');

		const seen: unknown[] = [];
		live.subscribe((snapshot) => seen.push(snapshot.data));
		await until(() => seen.length === 2, 'both snapshots');

		expect(seen).toEqual([{ beat: 1 }, { beat: 2 }]);
	});

	it('holds the last snapshot for whoever asks', async () => {
		const s = server([beat(1), beat(2)]);
		const live = nexLive(clientFor(s.fetchImpl), 'live L { beat }');

		live.subscribe(() => undefined);
		await until(() => live.snapshot()?.data !== undefined, 'a snapshot');
		await until(
			() => (live.snapshot()?.data as { beat: number }).beat === 2,
			'the second snapshot'
		);

		expect(live.snapshot()?.data).toEqual({ beat: 2 });
	});

	it('knows nothing before anyone listens', () => {
		const s = server([beat(1)]);
		const live = nexLive(clientFor(s.fetchImpl), 'live L { beat }');

		expect(live.snapshot()).toBeUndefined();
		expect(s.opened()).toBe(0);
	});

	it('opens one connection however many are listening', async () => {
		const s = server([beat(1)]);
		const live = nexLive(clientFor(s.fetchImpl), 'live L { beat }');

		live.subscribe(() => undefined);
		live.subscribe(() => undefined);
		live.subscribe(() => undefined);
		await until(() => live.snapshot() !== undefined, 'the connection');
		await settle();

		// Three components watching one thing is one connection, or a page
		// with a list of them opens a connection per row.
		expect(s.opened()).toBe(1);
	});

	it('tells everyone listening, not just the first', async () => {
		const s = server([beat(1)]);
		const live = nexLive(clientFor(s.fetchImpl), 'live L { beat }');

		const first = vi.fn();
		const second = vi.fn();
		live.subscribe(first);
		live.subscribe(second);
		await until(
			() => first.mock.calls.length > 0 && second.mock.calls.length > 0,
			'both listeners'
		);

		expect(first).toHaveBeenCalledTimes(1);
		expect(second).toHaveBeenCalledTimes(1);
	});

	it('gives a late listener what it already has', async () => {
		const s = server([beat(1)]);
		const live = nexLive(clientFor(s.fetchImpl), 'live L { beat }');

		live.subscribe(() => undefined);
		await until(() => live.snapshot() !== undefined, 'a snapshot');

		const late = vi.fn();
		live.subscribe(late);

		// A component that mounts later should not have to wait for the next
		// event to know anything.
		expect(late).toHaveBeenCalledWith(
			expect.objectContaining({ data: { beat: 1 } })
		);
	});

	it('stops telling one that has gone', async () => {
		const s = server([beat(1)]);
		const live = nexLive(clientFor(s.fetchImpl), 'live L { beat }');

		const listener = vi.fn();
		const stop = live.subscribe(listener);
		stop();
		await settle();

		expect(listener).not.toHaveBeenCalled();
	});

	it('closes the connection when the last one goes', async () => {
		const s = server([beat(1)]);
		const live = nexLive(clientFor(s.fetchImpl), 'live L { beat }');

		const first = live.subscribe(() => undefined);
		const second = live.subscribe(() => undefined);
		await until(() => s.opened() === 1, 'the connection');

		first();
		expect(s.released()).toBe(0);

		second();
		await until(() => s.released() === 1, 'the connection to be released');

		expect(s.released()).toBe(1);
	});

	it('opens again when someone comes back', async () => {
		const s = server([beat(1)]);
		const live = nexLive(clientFor(s.fetchImpl), 'live L { beat }');

		const stop = live.subscribe(() => undefined);
		await until(() => s.opened() === 1, 'the first connection');
		stop();

		live.subscribe(() => undefined);
		await until(() => s.opened() === 2, 'the second connection');

		expect(s.opened()).toBe(2);
	});

	it('never opens one for a listener that left first', async () => {
		const s = server([beat(1)]);
		const live = nexLive(clientFor(s.fetchImpl), 'live L { beat }');

		// Mount and unmount in the same tick, which a component does more
		// often than anyone would like.
		live.subscribe(() => undefined)();
		await settle();

		expect(s.opened()).toBe(0);
	});

	it('lets a listener that throws be its own problem', async () => {
		const s = server([beat(1), beat(2)]);
		const live = nexLive(clientFor(s.fetchImpl), 'live L { beat }');

		const after = vi.fn();
		live.subscribe(() => {
			throw new Error('the component is broken');
		});
		live.subscribe(after);
		await until(
			() => (live.snapshot()?.data as { beat: number } | undefined)?.beat === 2,
			'both snapshots'
		);

		expect(after).toHaveBeenCalled();
		expect(live.snapshot()?.data).toEqual({ beat: 2 });
	});

	it('ignores a snapshot from a connection nobody wants any more', async () => {
		// The frame lands after everyone has gone, which is the ordinary shape
		// of a component unmounting while an event is on the wire.
		let release: (() => void) | undefined;
		const fetchImpl = (async () =>
			new Response(
				new ReadableStream({
					start: (controller) => {
						release = () => {
							try {
								controller.enqueue(new TextEncoder().encode(beat(1)));
							} catch {
								// Already torn down.
							}
						};
						// This one ignores the signal, which a fetch handed in
						// by a caller is free to do - so the stream keeps
						// producing after everyone has gone.
					},
				}),
				{ headers: { 'content-type': 'text/event-stream' } }
			)) as unknown as typeof fetch;

		const live = nexLive(clientFor(fetchImpl), 'live L { beat }');
		const seen = vi.fn();
		const stop = live.subscribe(seen);
		await until(() => seen.mock.calls.length >= 0, 'the connection');
		await settle();

		stop();
		release?.();
		await settle();

		expect(seen).not.toHaveBeenCalled();
		expect(live.snapshot()).toBeUndefined();
	});

	it('can be stopped for good', async () => {
		const s = server([beat(1)]);
		const live = nexLive(clientFor(s.fetchImpl), 'live L { beat }');

		live.subscribe(() => undefined);
		await until(() => s.opened() === 1, 'the connection');
		live.stop();
		await until(() => s.released() === 1, 'the connection to be released');

		expect(s.released()).toBe(1);
		expect(live.snapshot()).toBeUndefined();
	});
});
