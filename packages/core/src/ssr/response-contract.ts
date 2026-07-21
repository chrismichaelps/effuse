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

import type { ServerValidator } from './validation.js';

const SERVER_STREAM_RESPONSE = Symbol.for('effuse.server.streamResponse');

/**
 * A response contract for routes that stream, return binary, or otherwise take
 * over serialization by returning a `Response`. It is a `ServerValidator<Response>`
 * so it slots into a route's `response` field wherever a data validator would,
 * but it carries a brand and a pass-through `parse`: the value is never inspected,
 * so a streaming or binary body opts out of response-body validation by design.
 *
 * Because its validator output is `Response`, a typed client call to a streaming
 * route resolves to `Response` rather than a decoded value — the caller owns how
 * the stream is consumed.
 */
export type ServerStreamResponse = ServerValidator<Response> & {
	readonly [SERVER_STREAM_RESPONSE]: true;
	readonly parse: (value: unknown) => Response;
};

/**
 * Declare a streaming/binary response contract. A route using it hands the whole
 * `Response` back to the caller untouched — no field validation on the way out,
 * and the typed client surfaces the raw `Response` instead of a decoded body.
 *
 * ```ts
 * defineServerRoute({
 *   path: '/api/download',
 *   request: defineServerRequest({}),
 *   response: streamResponse(),
 *   GET: () => new Response(fileStream, { headers: { 'Content-Type': 'application/octet-stream' } }),
 * });
 * ```
 */
export const streamResponse = (): ServerStreamResponse => ({
	[SERVER_STREAM_RESPONSE]: true,
	// Identity parse: a streaming route has already produced its Response, so the
	// contract never validates the body — it exists to type the result and mark
	// the route as raw for the client reader.
	parse: (value: unknown): Response => value as Response,
});

/** Narrow a route's `response` to the streaming contract marker. */
export const isStreamResponse = (
	value: unknown
): value is ServerStreamResponse =>
	typeof value === 'object' &&
	value !== null &&
	SERVER_STREAM_RESPONSE in value;
