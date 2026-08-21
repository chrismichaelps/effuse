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

import { NexErrorCode, NexExecutionError } from '../errors/index.js';
import type { ExecutionResult } from '../execution/index.js';

const FRAME_SEPARATOR = '\n\n';

/**
 * Read the snapshots out of an event stream.
 *
 * Frames arrive however the network cut them, so bytes are held until a whole
 * frame is there rather than assuming one chunk is one event.
 */
/** What to do with a stream beyond reading its snapshots. */
export interface ReadEventStreamOptions {
	/**
	 * Told the number each event carried, as it is read.
	 *
	 * A client that means to pick a dropped connection back up has to know
	 * where it got to, and the number is the only thing that says.
	 */
	readonly onEventId?: ((id: string) => void) | undefined;
	/** Told when the server said the stream was finished rather than cut. */
	readonly onComplete?: (() => void) | undefined;
}

export const readEventStream = async function* (
	body: ReadableStream<Uint8Array>,
	options: ReadEventStreamOptions = {}
): AsyncGenerator<ExecutionResult> {
	const reader = body.getReader();
	const decoder = new TextDecoder();
	let held = '';

	const frames = function* (chunk: string): Generator<string> {
		held += chunk;

		let boundary = held.indexOf(FRAME_SEPARATOR);
		while (boundary !== -1) {
			yield held.slice(0, boundary);
			held = held.slice(boundary + FRAME_SEPARATOR.length);
			boundary = held.indexOf(FRAME_SEPARATOR);
		}
	};

	const parse = (frame: string): ExecutionResult | undefined => {
		const lines = frame.split('\n');
		const event = lines
			.find((line) => line.startsWith('event:'))
			?.slice('event:'.length)
			.trim();

		const id = lines
			.find((line) => line.startsWith('id:'))
			?.slice('id:'.length)
			.trim();
		if (id !== undefined && id !== '') options.onEventId?.(id);
		const data = lines
			.filter((line) => line.startsWith('data:'))
			.map((line) => line.slice('data:'.length).trim())
			.join('');

		if (event === 'complete') {
			options.onComplete?.();
			return undefined;
		}

		if (data === '') return undefined;

		try {
			return JSON.parse(data) as ExecutionResult;
		} catch {
			return {
				data: null,
				errors: [
					new NexExecutionError({
						message: 'A live snapshot could not be read',
						code: NexErrorCode.INTERNAL,
					}),
				],
				extensions: { cost: 0 },
			};
		}
	};

	try {
		for (;;) {
			const { done, value } = await reader.read();
			if (done) break;

			for (const frame of frames(decoder.decode(value, { stream: true }))) {
				const result = parse(frame);
				if (result !== undefined) yield result;
			}
		}

		for (const frame of frames(FRAME_SEPARATOR)) {
			const result = parse(frame);
			if (result !== undefined) yield result;
		}
	} finally {
		// Whoever stops reading closes the stream with them.
		await reader.cancel().catch(() => undefined);
	}
};
