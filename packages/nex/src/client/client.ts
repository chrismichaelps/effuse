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

import type { OperationStore } from '../api/operation-store.js';
import { requestKey } from '../api/persisted.js';
import { print } from '../api/print.js';
import { NexErrorCode, NexExecutionError } from '../errors/index.js';
import type { ExecutionResult } from '../execution/index.js';
import type { DocumentNode } from '../language/ast/index.js';
import { readEventStream } from './event-stream.js';

/** What a request is sent with. */
export interface NexRequestOptions {
	readonly variables?: Readonly<Record<string, unknown>> | undefined;
	readonly operationName?: string | undefined;
	/** Ask again even when the client already has an answer. */
	readonly refresh?: boolean | undefined;
	/** Abort the request. */
	readonly signal?: AbortSignal | undefined;
	/** Headers for this request, on top of the client's own. */
	readonly headers?: Readonly<Record<string, string>> | undefined;
}

/** What a server resolved, ready to travel to the browser. */
export interface DehydratedNexState {
	readonly results: readonly {
		readonly key: string;
		readonly result: ExecutionResult;
	}[];
}

/** How to reach a server. */
export interface NexClientOptions {
	/** Where requests are sent. */
	readonly endpoint: string;
	/** The fetch to use. Defaults to the platform's own. */
	readonly fetch?: typeof fetch | undefined;
	/** Headers every request carries. */
	readonly headers?:
		| Readonly<Record<string, string>>
		| (() => Readonly<Record<string, string>>)
		| undefined;
	/** Operations the server already holds, so a name goes out instead. */
	readonly operations?: OperationStore | undefined;
	/** Keep what came back, keyed by what the request does. Defaults to true. */
	readonly cache?: boolean | undefined;
}

/** A client for one server. */
export interface NexClient {
	/** Run a request, answering from what the client already has when it can. */
	readonly request: (
		input: string | DocumentNode,
		options?: NexRequestOptions
	) => Promise<ExecutionResult>;
	/** Run a request and keep the answer, without looking at it. */
	readonly prefetch: (
		input: string | DocumentNode,
		options?: NexRequestOptions
	) => Promise<void>;
	/** Watch a live operation. */
	readonly subscribe: (
		input: string | DocumentNode,
		options?: NexRequestOptions
	) => AsyncGenerator<ExecutionResult>;
	/** What the client has for a request, if anything. */
	readonly read: (
		input: string | DocumentNode,
		options?: Pick<NexRequestOptions, 'operationName'>
	) => Promise<ExecutionResult | undefined>;
	/** Everything the client holds, ready to send to a browser. */
	readonly dehydrate: () => DehydratedNexState;
	/** Take what a server resolved during a render. */
	readonly hydrate: (state: DehydratedNexState) => void;
	/** Forget everything held. */
	readonly clear: () => void;
}

const failure = (message: string, code: NexErrorCode): ExecutionResult => ({
	data: null,
	errors: [new NexExecutionError({ message, code })],
	extensions: { cost: 0 },
});

/**
 * Talk to a Nex server.
 *
 * Answers are kept by what the request does rather than by how it was typed,
 * which is what lets a render on the server and the browser that takes over
 * agree on what has already been asked. Two callers asking at once share one
 * request.
 */
export const createNexClient = (options: NexClientOptions): NexClient => {
	const send = options.fetch ?? globalThis.fetch;
	const keeps = options.cache !== false;
	const held = new Map<string, ExecutionResult>();
	const inFlight = new Map<string, Promise<ExecutionResult>>();

	const headersFor = (
		request: NexRequestOptions | undefined
	): Record<string, string> => ({
		'content-type': 'application/json',
		...(typeof options.headers === 'function'
			? options.headers()
			: (options.headers ?? {})),
		...(request?.headers ?? {}),
	});

	/** What goes on the wire: a name when the server holds it, else the request. */
	const bodyFor = async (
		input: string | DocumentNode,
		request: NexRequestOptions | undefined,
		key: string
	): Promise<string> => {
		const carried = {
			...(request?.variables === undefined
				? {}
				: { variables: request.variables }),
			...(request?.operationName === undefined
				? {}
				: { operationName: request.operationName }),
		};

		// A request goes out as it was written, so what a developer reads in the
		// network tab is what they typed; the key is worked out separately.
		return options.operations?.has(key) === true
			? JSON.stringify({ id: key, ...carried })
			: JSON.stringify({
					query: typeof input === 'string' ? input : print(input),
					...carried,
				});
	};

	const keyFor = (
		input: string | DocumentNode,
		request: NexRequestOptions | undefined
	): Promise<string> =>
		requestKey(input, {
			...(request?.operationName === undefined
				? {}
				: { operationName: request.operationName }),
		});

	/**
	 * What two callers must agree on to share a request in flight.
	 *
	 * The stored key is a hash, and working one out takes a turn of the event
	 * loop - long enough for a second caller to arrive and miss the first. This
	 * one is worked out on the spot, so callers coalesce before anything
	 * awaits; the hash still decides what is kept.
	 */
	const coalesceKey = (
		input: string | DocumentNode,
		request: NexRequestOptions | undefined
	): string =>
		[
			typeof input === 'string' ? input : print(input),
			request?.operationName ?? '',
			JSON.stringify(request?.variables ?? null),
		].join('\u0000');

	const run = async (
		input: string | DocumentNode,
		request: NexRequestOptions | undefined,
		key: string
	): Promise<ExecutionResult> => {
		let response: Response;

		try {
			response = await send(options.endpoint, {
				method: 'POST',
				headers: headersFor(request),
				body: await bodyFor(input, request, key),
				...(request?.signal === undefined ? {} : { signal: request.signal }),
			});
		} catch (cause) {
			return failure(
				`The request never reached ${options.endpoint}: ${
					cause instanceof Error ? cause.message : String(cause)
				}`,
				NexErrorCode.INTERNAL
			);
		}

		const body = await response.text();
		let parsed: unknown;

		try {
			parsed = JSON.parse(body);
		} catch {
			return failure(
				response.ok
					? 'The response could not be read as a Nex response'
					: `The server answered ${String(response.status)} and the body could not be read as a Nex response`,
				NexErrorCode.INTERNAL
			);
		}

		if (typeof parsed !== 'object' || parsed === null) {
			return failure(
				'The response could not be read as a Nex response',
				NexErrorCode.INTERNAL
			);
		}

		return parsed as ExecutionResult;
	};

	const requestFor = (
		input: string | DocumentNode,
		request?: NexRequestOptions
	): Promise<ExecutionResult> => {
		const sharing = coalesceKey(input, request);
		const running = inFlight.get(sharing);
		if (running !== undefined && request?.refresh !== true) return running;

		const pending = (async (): Promise<ExecutionResult> => {
			const key = await keyFor(input, request);

			if (keeps && request?.refresh !== true) {
				const already = held.get(key);
				if (already !== undefined) return already;
			}

			const result = await run(input, request, key);

			// Only an answer worth reusing is kept: a failure should be asked
			// again rather than remembered.
			if (keeps && result.errors === undefined) held.set(key, result);
			return result;
		})().finally(() => {
			inFlight.delete(sharing);
		});

		inFlight.set(sharing, pending);
		return pending;
	};

	return {
		request: requestFor,
		prefetch: async (input, request) => {
			await requestFor(input, request);
		},
		subscribe: async function* (input, request) {
			const key = await keyFor(input, request);
			let response: Response;

			try {
				response = await send(options.endpoint, {
					method: 'POST',
					headers: { ...headersFor(request), accept: 'text/event-stream' },
					body: await bodyFor(input, request, key),
					...(request?.signal === undefined ? {} : { signal: request.signal }),
				});
			} catch (cause) {
				yield failure(
					`The request never reached ${options.endpoint}: ${
						cause instanceof Error ? cause.message : String(cause)
					}`,
					NexErrorCode.INTERNAL
				);
				return;
			}

			if (response.body === null) {
				yield failure(
					'The server answered a live operation with no stream',
					NexErrorCode.INTERNAL
				);
				return;
			}

			yield* readEventStream(response.body);
		},
		read: async (input, request) => held.get(await keyFor(input, request)),
		dehydrate: () => ({
			results: [...held].map(([key, result]) => ({ key, result })),
		}),
		hydrate: (state) => {
			for (const entry of state.results ?? [])
				held.set(entry.key, entry.result);
		},
		clear: () => {
			held.clear();
			inFlight.clear();
		},
	};
};
