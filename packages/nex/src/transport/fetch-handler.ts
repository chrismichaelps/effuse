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

import type { CostBudget } from '../analysis/index.js';
import {
	handleProtocolRequest,
	type HttpHandlerOptions,
} from './http/handle.js';

/** What a caller may spend, and how to tell one caller from another. */
export interface NexBudgetOptions {
	/** The budget every caller is charged against. */
	readonly budget: CostBudget;
	/**
	 * Name the caller a request is charged to.
	 *
	 * Whatever the server already uses to tell callers apart - an API key, a
	 * session, an address - is the right answer here, so the budget follows the
	 * same identity as the rest of the server rather than inventing one.
	 */
	readonly callerFor: (request: Request) => string;
}

/** How to serve Nex requests. The same options the protocol mapping reads. */
export interface NexHandlerOptions<TContext = unknown> extends Omit<
	HttpHandlerOptions<TContext>,
	'budget'
> {
	/** What each caller may spend over time, charged what their requests cost. */
	readonly budget?: NexBudgetOptions | undefined;
}

/**
 * Turn an async iterable of frames into a body a runtime can stream.
 *
 * Whoever stops reading - a client that went away, an adapter tearing the
 * response down - stops the source with them, so a live operation never keeps
 * producing for nobody.
 */
const streamOf = (
	frames: AsyncIterable<string>,
	signal: AbortSignal | undefined
): ReadableStream<Uint8Array> => {
	const iterator = frames[Symbol.asyncIterator]();
	const encoder = new TextEncoder();

	const end = async (): Promise<void> => {
		await iterator.return?.().catch(() => undefined);
	};

	return new ReadableStream<Uint8Array>({
		start: (controller) => {
			if (signal === undefined) return;
			if (signal.aborted) {
				void end();
				controller.close();
				return;
			}
			signal.addEventListener(
				'abort',
				() => {
					void end();
					try {
						controller.close();
					} catch {
						// Already closed by the pull that noticed first.
					}
				},
				{ once: true }
			);
		},
		pull: async (controller) => {
			if (signal?.aborted === true) {
				await end();
				controller.close();
				return;
			}

			const next = await iterator.next();
			if (next.done === true) {
				controller.close();
				return;
			}

			controller.enqueue(encoder.encode(next.value));
		},
		cancel: end,
	});
};

/**
 * Build the request handler a server mounts.
 *
 * This is the whole surface a server author touches: hand it a catalog and
 * resolvers, and it answers `Request`s with `Response`s - which is the shape
 * `@effuse/server` binds to its Node and Bun adapters, and the shape any other
 * runtime speaking the web platform already understands.
 *
 * ```ts
 * import { createNodeServer } from '@effuse/server';
 * import { createNexHandler } from '@effuse/nex';
 *
 * const server = createNodeServer(createNexHandler({ catalog, resolvers }));
 * await server.listen({ port: 4000 });
 * ```
 *
 * Nothing about HTTP itself lives here: the runtime owns listening, body
 * limits, and shutdown, while this owns what a Nex request means.
 */
export const createNexHandler = <TContext = unknown>(
	options: NexHandlerOptions<TContext>
): ((request: Request) => Promise<Response>) => {
	return async (request: Request): Promise<Response> => {
		const method = request.method.toUpperCase();
		const headers: Record<string, string> = {};
		request.headers.forEach((value, key) => {
			headers[key] = value;
		});

		const answer = await handleProtocolRequest(
			{
				method,
				url: request.url,
				headers,
				...(method === 'POST' ? { body: await request.text() } : {}),
			},
			// The request's own signal calls the run off, so a caller that
			// disconnects stops the work it started.
			{
				...options,
				signal: request.signal,
				...(options.budget === undefined
					? { budget: undefined }
					: {
							budget: {
								budget: options.budget.budget,
								caller: options.budget.callerFor(request),
							},
						}),
			}
		);

		if (answer.stream !== undefined) {
			return new Response(streamOf(answer.stream, request.signal), {
				status: answer.status,
				headers: answer.headers,
			});
		}

		return new Response(answer.body ?? null, {
			status: answer.status,
			headers: answer.headers,
		});
	};
};
