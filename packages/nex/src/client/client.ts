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
	/**
	 * Send requests made together as one round trip.
	 *
	 * `true` batches everything queued in the same tick; `{ size }` caps how
	 * many travel together. A batch is never held for a request that has not
	 * been made: nothing waits on a timer.
	 */
	readonly batch?: boolean | { readonly size?: number } | undefined;
}

/** A client for one server. */
export interface NexClient {
	/** Run a request, answering from what the client already has when it can. */
	readonly request: <
		TData extends Record<string, unknown> = Record<string, unknown>,
	>(
		input: string | DocumentNode,
		options?: NexRequestOptions
	) => Promise<ExecutionResult<TData>>;
	/** Run a request and keep the answer, without looking at it. */
	readonly prefetch: (
		input: string | DocumentNode,
		options?: NexRequestOptions
	) => Promise<void>;
	/** Watch a live operation. */
	readonly subscribe: <
		TData extends Record<string, unknown> = Record<string, unknown>,
	>(
		input: string | DocumentNode,
		options?: NexRequestOptions
	) => AsyncGenerator<ExecutionResult<TData>>;
	/** What the client has for a request, if anything. */
	readonly read: <
		TData extends Record<string, unknown> = Record<string, unknown>,
	>(
		input: string | DocumentNode,
		options?: Pick<NexRequestOptions, 'operationName'>
	) => Promise<ExecutionResult<TData> | undefined>;
	/** Everything the client holds, ready to send to a browser. */
	readonly dehydrate: () => DehydratedNexState;
	/** Take what a server resolved during a render. */
	readonly hydrate: (state: DehydratedNexState) => void;
	/** Forget everything held. */
	readonly clear: () => void;
}

const failure = <TData extends Record<string, unknown>>(
	message: string,
	code: NexErrorCode
): ExecutionResult<TData> => ({
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
	const batching = options.batch !== undefined && options.batch !== false;
	const batchSize =
		typeof options.batch === 'object' ? (options.batch.size ?? 25) : 25;
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

	/**
	 * A request waiting to travel with the others queued this tick.
	 *
	 * What goes on the wire is worked out afterwards - the key it is kept
	 * under is a hash, and that costs a turn of the event loop - but which
	 * requests travel together is decided the moment each is made, or the
	 * batch would already have gone.
	 */
	interface Queued {
		/** What to send, or the answer already held for it. */
		readonly prepare: () => Promise<
			| { readonly body: Record<string, unknown> }
			| { readonly held: ExecutionResult }
		>;
		readonly settle: (result: ExecutionResult) => void;
		readonly headers: Record<string, string>;
		readonly signal: AbortSignal | undefined;
	}

	let queue: Queued[] = [];
	let scheduled = false;

	/**
	 * A batch's place in the queue for the wire.
	 *
	 * Working out what to send costs a turn of the event loop - the key a
	 * request is kept under is a hash - and a batch that finishes that work
	 * sooner would otherwise overtake one formed before it. A client that sends
	 * two mutations expects the server to see them in the order they were made,
	 * so each batch takes a place the moment it is formed and waits for it.
	 */
	interface Turn {
		/** Resolves once every batch formed earlier has gone out. */
		readonly wait: Promise<void>;
		/** Say this batch has gone, letting the next one go. */
		readonly done: () => void;
	}

	let dispatched: Promise<void> = Promise.resolve();

	const takeTurn = (): Turn => {
		const wait = dispatched;
		let done = (): void => undefined;
		dispatched = new Promise<void>((resolve) => {
			done = resolve;
		});
		return { wait, done };
	};

	/** Answer everyone in a batch with what came back for them. */
	const deliver = (
		waiting: readonly Queued[],
		answers: readonly ExecutionResult[] | ExecutionResult
	): void => {
		if (!Array.isArray(answers)) {
			for (const entry of waiting) entry.settle(answers as ExecutionResult);
			return;
		}

		for (const [index, entry] of waiting.entries()) {
			entry.settle(
				answers[index] ??
					failure(
						'The server answered a batch with fewer results than it was sent',
						NexErrorCode.INTERNAL
					)
			);
		}
	};

	const sendBatch = async (
		queued: readonly Queued[],
		turn: Turn
	): Promise<void> => {
		const failed = (cause: unknown): void => {
			deliver(
				queued,
				failure(
					`The request never reached ${options.endpoint}: ${
						cause instanceof Error ? cause.message : String(cause)
					}`,
					NexErrorCode.INTERNAL
				)
			);
		};

		let prepared: {
			readonly entry: Queued;
			readonly ready: Awaited<ReturnType<Queued['prepare']>>;
		}[];

		try {
			prepared = await Promise.all(
				queued.map(async (entry) => ({ entry, ready: await entry.prepare() }))
			);
		} catch (cause) {
			// Nothing was sent, so nothing is owed a place on the wire - but the
			// batches behind this one are, and must not wait on it forever.
			turn.done();
			failed(cause);
			return;
		}

		const waiting: Queued[] = [];
		const bodies: Record<string, unknown>[] = [];

		for (const { entry, ready } of prepared) {
			if ('held' in ready) {
				entry.settle(ready.held);
				continue;
			}
			waiting.push(entry);
			bodies.push(ready.body);
		}

		const first = waiting[0];
		if (first === undefined) {
			turn.done();
			return;
		}

		const single = waiting.length === 1;

		const unreachable = (cause: unknown): void => {
			deliver(
				waiting,
				failure(
					`The request never reached ${options.endpoint}: ${
						cause instanceof Error ? cause.message : String(cause)
					}`,
					NexErrorCode.INTERNAL
				)
			);
		};

		await turn.wait;

		let answering: Promise<Response>;
		try {
			answering = Promise.resolve(
				send(options.endpoint, {
					method: 'POST',
					headers: first.headers,
					body: JSON.stringify(single ? bodies[0] : bodies),
					...(first.signal === undefined ? {} : { signal: first.signal }),
				})
			);
		} catch (cause) {
			turn.done();
			unreachable(cause);
			return;
		}

		// The next batch may go as soon as this one is on the wire; waiting for
		// the answer would make batches take turns rather than travel together.
		turn.done();

		try {
			deliver(waiting, await readAnswer(await answering));
		} catch (cause) {
			unreachable(cause);
		}
	};

	/** Queue a request, and send what is queued once this tick is over. */
	const enqueue = (entry: Queued): void => {
		queue.push(entry);

		if (queue.length >= batchSize) {
			const full = queue;
			queue = [];
			void sendBatch(full, takeTurn());
			return;
		}

		if (scheduled) return;
		scheduled = true;

		queueMicrotask(() => {
			scheduled = false;
			const waiting = queue;
			queue = [];
			if (waiting.length > 0) void sendBatch(waiting, takeTurn());
		});
	};

	/** Read what came back, whatever shape the server answered in. */
	const readAnswer = async (
		response: Response
	): Promise<readonly ExecutionResult[] | ExecutionResult> => {
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

		return parsed as readonly ExecutionResult[] | ExecutionResult;
	};

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

	/** Run a request on its own, working out its key on the way. */
	const direct = async (
		input: string | DocumentNode,
		request: NexRequestOptions | undefined
	): Promise<ExecutionResult> => {
		const key = await keyFor(input, request);

		if (keeps && request?.refresh !== true) {
			const already = held.get(key);
			if (already !== undefined) return already;
		}

		const result = await run(input, request, key);

		// Only an answer worth reusing is kept: a failure should be asked again
		// rather than remembered.
		if (keeps && result.errors === undefined) held.set(key, result);
		return result;
	};

	/** Put a request in this tick's batch, and answer when the batch does. */
	const queued = (
		input: string | DocumentNode,
		request: NexRequestOptions | undefined
	): Promise<ExecutionResult> =>
		new Promise<ExecutionResult>((resolve) => {
			enqueue({
				prepare: async () => {
					const key = await keyFor(input, request);

					if (keeps && request?.refresh !== true) {
						const already = held.get(key);
						if (already !== undefined) return { held: already };
					}

					return {
						body: JSON.parse(await bodyFor(input, request, key)) as Record<
							string,
							unknown
						>,
					};
				},
				settle: (result) => {
					if (keeps && result.errors === undefined) {
						void keyFor(input, request).then((key) => held.set(key, result));
					}
					resolve(result);
				},
				headers: headersFor(request),
				signal: request?.signal,
			});
		});

	const requestFor = <
		TData extends Record<string, unknown> = Record<string, unknown>,
	>(
		input: string | DocumentNode,
		request?: NexRequestOptions
	): Promise<ExecutionResult<TData>> => {
		const sharing = coalesceKey(input, request);
		const running = inFlight.get(sharing);
		if (running !== undefined && request?.refresh !== true) {
			return running as Promise<ExecutionResult<TData>>;
		}

		const pending = (
			batching ? queued(input, request) : direct(input, request)
		).finally(() => {
			inFlight.delete(sharing);
		}) as Promise<ExecutionResult<TData>>;

		inFlight.set(sharing, pending as Promise<ExecutionResult>);
		return pending;
	};

	return {
		request: requestFor,
		prefetch: async (input, request) => {
			await requestFor(input, request);
		},
		subscribe: async function* <
			TData extends Record<string, unknown> = Record<string, unknown>,
		>(
			input: string | DocumentNode,
			request?: NexRequestOptions
		): AsyncGenerator<ExecutionResult<TData>> {
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

			// Frames carry whatever the server sent; naming that shape is the
			// caller's, the same as for a request.
			yield* readEventStream(response.body) as AsyncGenerator<
				ExecutionResult<TData>
			>;
		},
		read: async (input, request) =>
			held.get(await keyFor(input, request)) as never,
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
