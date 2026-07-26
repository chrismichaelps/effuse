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

import type { IncomingMessage, ServerResponse } from 'node:http';
import { Readable } from 'node:stream';
import { once } from 'node:events';

/** `RequestInit` plus the `duplex` field required for streaming request bodies. */
interface StreamingRequestInit extends RequestInit {
	duplex?: 'half';
}

const METHODS_WITHOUT_BODY = new Set(['GET', 'HEAD']);

/**
 * Builds a Web `Request` from a Node `IncomingMessage`.
 *
 * The request body is exposed as a `ReadableStream` (never buffered), and the
 * provided `signal` reflects client disconnects so handlers can cancel work.
 */
export const toWebRequest = (
	req: IncomingMessage,
	fallbackHost: string,
	signal: AbortSignal
): Request => {
	const method = req.method ?? 'GET';
	const authority = req.headers.host ?? fallbackHost;
	const url = `http://${authority}${req.url ?? '/'}`;

	const headers = new Headers();
	for (const [key, value] of Object.entries(req.headers)) {
		if (Array.isArray(value)) {
			for (const item of value) {
				headers.append(key, item);
			}
		} else if (value !== undefined) {
			headers.set(key, value);
		}
	}

	const hasBody = !METHODS_WITHOUT_BODY.has(method);
	const body = hasBody
		? (Readable.toWeb(req) as unknown as ReadableStream<Uint8Array>)
		: null;

	const init: StreamingRequestInit = { method, headers, body, signal };
	if (hasBody) {
		init.duplex = 'half';
	}

	return new Request(url, init);
};

/** Applies a Web `Response`'s status and headers to a Node `ServerResponse`. */
const applyHead = (res: ServerResponse, response: Response): void => {
	res.statusCode = response.status;
	response.headers.forEach((value, key) => {
		if (key.toLowerCase() === 'set-cookie') {
			return;
		}
		res.setHeader(key, value);
	});
	// `Headers.forEach` coalesces multiple Set-Cookie values into one comma-joined
	// string, which corrupts cookies. `getSetCookie` preserves them as an array.
	const cookies = response.headers.getSetCookie();
	if (cookies.length > 0) {
		res.setHeader('set-cookie', cookies);
	}
};

/**
 * Streams a Web `Response` into a Node `ServerResponse`, honoring backpressure.
 *
 * HEAD responses send headers only. A client disconnect mid-stream (reflected
 * on `signal`) tears the socket down without treating it as a server error.
 */
export const writeWebResponse = async (
	res: ServerResponse,
	response: Response,
	signal: AbortSignal,
	omitBody: boolean
): Promise<void> => {
	applyHead(res, response);

	if (omitBody || response.body === null) {
		res.end();
		return;
	}

	const reader = response.body.getReader();
	try {
		for (;;) {
			const { done, value } = await reader.read();
			if (done) {
				break;
			}
			if (signal.aborted) {
				await reader.cancel();
				break;
			}
			if (!res.write(value)) {
				await once(res, 'drain');
			}
		}
		res.end();
	} catch (error) {
		await reader.cancel().catch(() => undefined);
		if (!res.writableEnded) {
			res.destroy();
		}
		if (!signal.aborted) {
			throw error;
		}
	}
};

/** Writes a small, non-streamed envelope response (used for adapter errors). */
export const writeEnvelope = async (
	res: ServerResponse,
	response: Response
): Promise<void> => {
	res.statusCode = response.status;
	response.headers.forEach((value, key) => {
		res.setHeader(key, value);
	});
	res.end(await response.text());
};
