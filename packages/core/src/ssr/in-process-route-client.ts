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

import type { LayerInputSource } from '../layers/api/defineLayer.js';
import type { ServerObservabilityHooks } from './observability.js';
import {
	compileLayerServerRouter,
	handleLayerServerRequest,
	type CompiledLayerServerRouter,
} from './server-routing.js';

export interface InProcessRouteFetchOptions {
	readonly observability?: ServerObservabilityHooks;
}

/**
 * Build a `fetch`-shaped transport that dispatches directly against a set of
 * layers, with no HTTP round-trip. It is the in-process counterpart to the
 * network transport used by {@link createTypedRouteClient}: during SSR a typed
 * client can call its own handlers in the same process while preserving every
 * runtime semantic — middleware ordering, layer services, auth short-circuits,
 * and request/response contract validation — because the call runs through the
 * exact same {@link handleLayerServerRequest} pipeline a real request would.
 *
 * The request is materialized into a `Request` object and dispatched in memory;
 * there is no socket, no serialization across a network boundary, and no second
 * runtime. Reusing the pipeline verbatim is deliberate: a "direct" call that
 * bypassed request construction would risk drifting from real-request semantics,
 * which is precisely what the acceptance criterion forbids.
 *
 * ```ts
 * const client = createTypedRouteClient(routes, {
 *   baseUrl: 'http://ssr.local',
 *   fetch: createInProcessRouteFetch(layers),
 * });
 * const data = await client.search({ query: { limit: '3' } }); // no network
 * ```
 *
 * A request that matches no route resolves to a `404` response, mirroring how an
 * unmatched HTTP request would be handled.
 */
export const createInProcessRouteFetch = (
	layers: LayerInputSource,
	options: InProcessRouteFetchOptions = {}
): typeof fetch => {
	let serverRouter: CompiledLayerServerRouter | undefined;
	return (async (
		input: RequestInfo | URL,
		init?: RequestInit
	): Promise<Response> => {
		const request =
			input instanceof Request && init === undefined
				? input
				: new Request(input as RequestInfo | URL, init);

		const response = await handleLayerServerRequest(
			request,
			(serverRouter ??= compileLayerServerRouter(layers)),
			options.observability
		);

		return response ?? new Response('Not Found', { status: 404 });
	}) as typeof fetch;
};
