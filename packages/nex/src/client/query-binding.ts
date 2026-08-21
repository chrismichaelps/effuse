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
import type { DocumentNode } from '../language/ast/index.js';
import { normalizeRequest } from '../api/persisted.js';
import type { ExecutionResult } from '../execution/index.js';
import type { NexClient } from './client.js';

/** What to run, and what to say about what came back. */
export interface NexBindingOptions {
	/** Which operation to run, when the document holds several. */
	readonly operationName?: string | undefined;
	/** Variable values the request takes. */
	readonly variables?: Readonly<Record<string, unknown>> | undefined;
	/**
	 * Told about the fields that failed, when some of the answer came back.
	 *
	 * A partial response is a real answer with real problems, and a cache has
	 * one slot for each. Rather than throwing away either, what worked is
	 * returned and what failed is reported here.
	 */
	readonly onErrors?:
		| ((errors: readonly NexExecutionError[]) => void)
		| undefined;
}

/** The shape a query cache is configured with. */
export interface NexQueryBinding<TData> {
	readonly queryKey: readonly unknown[];
	/**
	 * Run the request.
	 *
	 * The context is optional because a cache may or may not offer one: a
	 * hook that calls this with nothing and one that hands over a signal to
	 * call the request off are both served, and a function that insisted on
	 * the argument would fit only the second.
	 */
	readonly queryFn: (context?: {
		readonly signal?: AbortSignal | undefined;
	}) => Promise<TData>;
}

/** The shape a mutation is configured with. */
export interface NexMutationBinding<TData, TVariables> {
	readonly mutationFn: (variables: TVariables) => Promise<TData>;
}

/**
 * Name a request, the same way however it was written.
 *
 * A cache decides what is the same request by its key, so two spellings of one
 * request have to arrive at one key or the same answer is fetched twice. The
 * request is normalized rather than hashed, so the key stays readable in a
 * devtool and costs no turn of the event loop to work out.
 */
export const nexQueryKey = (
	request: string | DocumentNode,
	options: NexBindingOptions = {}
): readonly unknown[] => [
	'nex',
	normalizeRequest(request, {
		...(options.operationName === undefined
			? {}
			: { operationName: options.operationName }),
	}),
	options.variables ?? null,
];

/** Whatever came back, or a reason nothing did. */
const answerOf = <TData extends object>(
	result: ExecutionResult<TData>,
	options: NexBindingOptions
): TData => {
	const errors = result.errors ?? [];

	// Nothing usable came back, so this is not an answer to hold: throwing is
	// what lets a cache leave the entry empty and a retry policy do its work.
	if (result.data === null || result.data === undefined) {
		throw (
			errors[0] ??
			new NexExecutionError({
				message: 'The request produced no data and said no reason why',
				code: NexErrorCode.INTERNAL,
			})
		);
	}

	if (errors.length > 0) options.onErrors?.(errors);

	return result.data;
};

/**
 * Describe a request as something a query cache can hold.
 *
 * This ecosystem already owns caching, deduplication, retries, and reactive
 * fetch status, and running a second cache underneath it means two things
 * that each believe they know what is current. So this hands over a key and a
 * way to run the request, and nothing else: pair it with a client built
 * `cache: false`, and there is one cache, invalidated one way.
 *
 * A request that produced nothing throws, so nothing is held and a retry
 * policy applies. A request that produced some of an answer returns it, and
 * reports what failed through `onErrors`.
 */
export const nexQuery = <TData extends object = Record<string, unknown>>(
	client: NexClient,
	request: string | DocumentNode,
	options: NexBindingOptions = {}
): NexQueryBinding<TData> => ({
	queryKey: nexQueryKey(request, options),
	queryFn: async (context) =>
		answerOf(
			await client.request<TData>(request, {
				...(context?.signal === undefined ? {} : { signal: context.signal }),
				...(options.operationName === undefined
					? {}
					: { operationName: options.operationName }),
				...(options.variables === undefined
					? {}
					: { variables: options.variables }),
			}),
			options
		),
});

/**
 * Describe a change as something the ecosystem can run.
 *
 * The variables come from wherever the change is triggered rather than from
 * here, which is what lets one binding serve every caller of it.
 */
export const nexMutation = <
	TData extends object = Record<string, unknown>,
	TVariables extends Readonly<Record<string, unknown>> = Record<
		string,
		unknown
	>,
>(
	client: NexClient,
	request: string | DocumentNode,
	options: Omit<NexBindingOptions, 'variables'> = {}
): NexMutationBinding<TData, TVariables> => ({
	mutationFn: async (variables) =>
		answerOf(
			await client.request<TData>(request, {
				variables,
				...(options.operationName === undefined
					? {}
					: { operationName: options.operationName }),
			}),
			options
		),
});
