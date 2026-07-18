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

import type { FetchHandler } from '../contract.js';
import { payloadTooLargeResponse } from './envelopes.js';

/** `RequestInit` plus the `duplex` field required for streaming request bodies. */
interface StreamingRequestInit extends RequestInit {
	duplex?: 'half';
}

/** Thrown by the counting stream when the request body exceeds its limit. */
class BodyLimitExceeded extends Error {
	constructor() {
		super('Request body limit exceeded');
		this.name = 'BodyLimitExceeded';
	}
}

/**
 * Wraps a body stream so that reading past `maxBodyBytes` errors instead of
 * buffering. The limit is enforced as bytes flow, so an oversize body is never
 * fully held in memory.
 */
const limitStream = (
	body: ReadableStream<Uint8Array>,
	maxBodyBytes: number
): ReadableStream<Uint8Array> => {
	let total = 0;
	const transform = new TransformStream<Uint8Array, Uint8Array>({
		transform(chunk, controller) {
			total += chunk.byteLength;
			if (total > maxBodyBytes) {
				controller.error(new BodyLimitExceeded());
				return;
			}
			controller.enqueue(chunk);
		},
	});
	return body.pipeThrough(transform);
};

/**
 * Returns a handler that rejects oversize request bodies with a stable `413`.
 *
 * A declared `Content-Length` over the limit short-circuits before the handler
 * runs. Otherwise the body is streamed through a counting guard; if the handler
 * reads past the limit, the resulting error is converted to a `413`.
 */
export const withBodyLimit = (
	handler: FetchHandler,
	maxBodyBytes: number
): FetchHandler => {
	return async (request: Request): Promise<Response> => {
		const declaredLength = request.headers.get('content-length');
		if (declaredLength !== null) {
			const length = Number(declaredLength);
			if (Number.isFinite(length) && length > maxBodyBytes) {
				return payloadTooLargeResponse(maxBodyBytes);
			}
		}

		if (request.body === null) {
			return handler(request);
		}

		const guarded = new Request(request, {
			body: limitStream(request.body, maxBodyBytes),
			duplex: 'half',
		} as StreamingRequestInit);

		try {
			return await handler(guarded);
		} catch (error) {
			if (error instanceof BodyLimitExceeded) {
				return payloadTooLargeResponse(maxBodyBytes);
			}
			throw error;
		}
	};
};
