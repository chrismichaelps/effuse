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

import type { MaybePromise, ServerResult } from '../layers/types.js';
import type {
	ServerRequestMiddleware,
	ServerMiddlewareTarget,
} from './middleware-definition.js';
import {
	selectServerMiddlewareChain,
	type CompiledServerMiddlewareGraph,
} from './middleware-graph.js';
import {
	runServerRequestMiddleware,
	type ServerRequestTerminal,
} from './middleware-runtime.js';

/** Default bound on how many times a request may be rewritten and rematched. */
export const DEFAULT_MAX_REWRITES = 5;

export interface ServerRequestPipelineOptions {
	readonly request: Request;
	readonly target: ServerMiddlewareTarget;
	/** Terminal handler run once the selected chain delegates all the way in. */
	readonly resolve: ServerRequestTerminal;
	/** Maximum rewrite/rematch passes before the pipeline fails. */
	readonly maxRewrites?: number;
}

export class ServerRewriteLimitError extends Error {
	readonly attempts: number;
	readonly pathname: string;
	readonly cyclic: boolean;

	constructor(attempts: number, pathname: string, cyclic = false) {
		super(
			cyclic
				? `[middleware] Cyclic request rewrite returned to "${pathname}".`
				: `[middleware] Request rewrite limit of ${String(
						attempts
					)} exceeded while resolving "${pathname}".`
		);
		this.name = 'ServerRewriteLimitError';
		this.attempts = attempts;
		this.pathname = pathname;
		this.cyclic = cyclic;
	}
}

const pathOf = (request: Request): string => new URL(request.url).pathname;

/**
 * Runs the full request-phase pipeline for one request.
 *
 * Middleware is selected from the compiled graph for the request's current
 * path, method, and target, then executed as an onion. When middleware rewrites
 * the request to a different path, the pipeline re-selects and re-runs from the
 * top so the middleware owning the *new* path always runs — a rewrite can never
 * skip the guards protecting its destination. Rewrites are bounded, so a cyclic
 * rewrite fails loudly instead of looping forever.
 *
 * A replacement request that keeps the same path (for example header mutation)
 * is threaded downstream without triggering a rematch.
 */
export const runServerRequestPipeline = async (
	graph: CompiledServerMiddlewareGraph,
	options: ServerRequestPipelineOptions
): Promise<Response> => {
	const maxRewrites = options.maxRewrites ?? DEFAULT_MAX_REWRITES;
	if (!Number.isSafeInteger(maxRewrites) || maxRewrites < 0) {
		throw new TypeError('[middleware] maxRewrites must be a non-negative integer.');
	}

	let current = options.request;
	const seen = new Set<string>();

	for (let pass = 0; pass <= maxRewrites; pass += 1) {
		const pathname = pathOf(current);
		seen.add(pathname);

		const chain = selectServerMiddlewareChain(graph, {
			pathname,
			method: current.method,
			target: options.target,
		}).map(
			(entry) => entry.middleware.handler as ServerRequestMiddleware
		);

		let rewritten: Request | undefined;
		const terminal: ServerRequestTerminal = (
			request,
			context
		): MaybePromise<ServerResult | void> => {
			if (pathOf(request) !== pathname) {
				// The path changed on the way in: restart selection so the new
				// path's own middleware runs before its handler.
				rewritten = request;
				return undefined;
			}
			return options.resolve(request, context);
		};

		const response = await runServerRequestMiddleware(
			chain,
			current,
			terminal
		);

		if (rewritten === undefined) return response;

		current = rewritten;
		if (seen.has(pathOf(current))) {
			throw new ServerRewriteLimitError(maxRewrites, pathOf(current), true);
		}
	}

	throw new ServerRewriteLimitError(maxRewrites, pathOf(current));
};
