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

import type {
	MaybePromise,
	RequestDisposer,
	RequestLocals,
	ServerResult,
} from '../layers/types.js';
import { normalizeServerResult } from './server-routing.js';
import type {
	ServerRequestMiddleware,
	ServerRequestMiddlewareContext,
} from './middleware-definition.js';

/**
 * Terminal executed at the center of the onion, after every request-phase
 * middleware has delegated through `next()`. Receives the (possibly rewritten)
 * request and the shared middleware context.
 */
export type ServerRequestTerminal = (
	request: Request,
	context: ServerRequestMiddlewareContext
) => MaybePromise<ServerResult | void>;

/**
 * Runs an ordered list of request-phase middleware as a single-pass onion
 * around a terminal handler.
 *
 * - Each middleware runs once; its `next()` advances to the next middleware or
 *   the terminal, and is single-use (a second call rejects).
 * - Returning without calling `next()` short-circuits: downstream middleware
 *   and the terminal do not run.
 * - `next(request)` replaces the request seen by everything downstream.
 * - Request-scoped `locals` are shared across the chain; `defer` disposers run
 *   after the response settles, in LIFO order.
 */
export const runServerRequestMiddleware = async (
	chain: readonly ServerRequestMiddleware[],
	request: Request,
	terminal: ServerRequestTerminal
): Promise<Response> => {
	const locals: RequestLocals = {};
	const disposers: RequestDisposer[] = [];
	const defer = (disposer: RequestDisposer): void => {
		if (typeof disposer !== 'function') {
			throw new TypeError('[middleware] defer expects a function.');
		}
		disposers.push(disposer);
	};

	const contextFor = (
		currentRequest: Request
	): ServerRequestMiddlewareContext => ({
		request: currentRequest,
		url: new URL(currentRequest.url),
		locals,
		defer,
	});

	const dispatch = async (
		index: number,
		currentRequest: Request
	): Promise<Response> => {
		if (index >= chain.length) {
			const context = contextFor(currentRequest);
			const result = await terminal(currentRequest, context);
			return normalizeServerResult(result);
		}

		const middleware = chain[index];
		if (middleware === undefined) {
			return dispatch(index + 1, currentRequest);
		}

		let nextCalled = false;
		let downstreamResponse: Response | undefined;
		const context = contextFor(currentRequest);
		const next = async (replacement?: Request): Promise<Response> => {
			if (nextCalled) {
				throw new Error(
					`[middleware] next() was already called once at position ${String(
						index
					)}.`
				);
			}
			nextCalled = true;
			downstreamResponse = await dispatch(
				index + 1,
				replacement ?? currentRequest
			);
			return downstreamResponse;
		};

		const result = await middleware(context, next);
		if (result === undefined && nextCalled) {
			// The middleware delegated and returned nothing of its own; use the
			// response produced downstream through `next`.
			return downstreamResponse ?? normalizeServerResult(undefined);
		}
		return normalizeServerResult(result);
	};

	try {
		return await dispatch(0, request);
	} finally {
		for (let i = disposers.length - 1; i >= 0; i -= 1) {
			await disposers[i]?.();
		}
	}
};
