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
import { formatErrors } from '../api/execute.js';
import { NexErrorCode, NexExecutionError } from '../errors/index.js';
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
	/**
	 * Build the context this one request runs with.
	 *
	 * Anything a request should not share - the session that made it, the
	 * loaders that remember what it has already fetched - belongs here rather
	 * than in `context`, which is one value for the life of the server. A
	 * loader built here remembers what its own request has seen and nothing
	 * else; one built once and passed as `context` would hand a later request
	 * rows fetched for an earlier one.
	 *
	 * It is given the request itself, so whatever the server already reads to
	 * identify a caller answers here too. A live operation gets one context for
	 * as long as it is watched.
	 */
	readonly createContext?:
		| ((request: Request) => TContext | Promise<TContext>)
		| undefined;
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
 * Answer a request whose context could never be built.
 *
 * The server is at fault, not the caller, so this is a 500 carrying the
 * response shape everything else answers in - and it goes through the
 * server's own error formatting, since a context failure is exactly the kind
 * of thing that names a database.
 */
const contextFailure = (
	cause: unknown,
	format: NexHandlerOptions<never>['formatError']
): Response => {
	const [reported] = formatErrors(
		[
			new NexExecutionError({
				message: cause instanceof Error ? cause.message : String(cause),
				code: NexErrorCode.INTERNAL,
				cause,
			}),
		],
		format
	);

	return new Response(
		JSON.stringify({
			data: null,
			errors: [
				{ message: reported?.message ?? '', path: reported?.path ?? [] },
			],
			extensions: { cost: 0 },
		}),
		{
			status: 500,
			headers: { 'content-type': 'application/json; charset=utf-8' },
		}
	);
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

		let context = options.context;
		if (options.createContext !== undefined) {
			try {
				context = await options.createContext(request);
			} catch (cause) {
				// Nothing ran, so there is no partial response to carry: the
				// request is answered with why it could not start.
				return contextFailure(cause, options.formatError);
			}
		}
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
				...(context === undefined ? {} : { context }),
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
