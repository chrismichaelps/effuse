/**
 * MIT License
 *
 * Copyright (c) 2025 Chris M. Perez
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 */

import type { ExecutionResult } from '../../execution/index.js';

/** How to frame a stream. */
export interface EventStreamOptions {
	/**
	 * The number the last event a client saw carried.
	 *
	 * Numbering carries on from here, so a client that dropped and came back
	 * sees one run of ids across both connections rather than starting over
	 * and being unable to say what it has already had.
	 */
	readonly startingId?: number | undefined;
	/**
	 * How long a connection may go quiet before saying it is still there.
	 *
	 * A proxy closes a connection it has seen nothing on, and a live operation
	 * that is genuinely idle looks exactly like one that has died. A comment
	 * costs one line and is ignored by every client.
	 */
	readonly keepAliveMs?: number | undefined;
}

/**
 * Frame a stream of snapshots as server-sent events.
 *
 * Each snapshot becomes a `next` event carrying an id, so a client that comes
 * back can say what it last saw. The stream is closed with a `complete` event
 * so an ending can be told apart from a dropped connection.
 */
export const toEventStream = async function* (
	snapshots: AsyncIterable<ExecutionResult>,
	options: EventStreamOptions = {}
): AsyncGenerator<string> {
	let id = options.startingId ?? 0;
	const keepAliveMs = options.keepAliveMs;

	const reading = snapshots[Symbol.asyncIterator]();

	try {
		for (;;) {
			const next = reading.next();

			// Racing the next snapshot against the clock is what turns a quiet
			// connection into one that says so, rather than one that looks dead.
			let step: IteratorResult<ExecutionResult>;
			if (keepAliveMs === undefined) {
				step = await next;
			} else {
				let waiting: ReturnType<typeof setTimeout> | undefined;
				const tick = Symbol('tick');

				for (;;) {
					const raced = await Promise.race([
						next,
						new Promise<typeof tick>((resolve) => {
							waiting = setTimeout(() => resolve(tick), keepAliveMs);
						}),
					]);

					if (waiting !== undefined) clearTimeout(waiting);
					if (raced !== tick) {
						step = raced;
						break;
					}

					yield ': still here\n\n';
				}
			}

			if (step.done === true) break;

			id += 1;
			yield `id: ${String(id)}\nevent: next\ndata: ${JSON.stringify(step.value)}\n\n`;
		}
	} finally {
		await reading.return?.().catch(() => undefined);
	}

	yield 'event: complete\ndata: {}\n\n';
};
