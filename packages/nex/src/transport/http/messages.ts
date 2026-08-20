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

/** One request, however it arrived. */
export interface HttpRequestBody {
	/** The request itself, when it was sent whole. */
	readonly query: string;
	/** The name of an operation the server already holds. */
	readonly id?: string | undefined;
	readonly variables?: Readonly<Record<string, unknown>> | undefined;
	readonly operationName?: string | undefined;
	readonly extensions?: Readonly<Record<string, unknown>> | undefined;
}

/** What arrived, in the terms every server has. */
export interface HttpRequest {
	readonly method: string;
	/** The full URL or just the path and query; only the query is read. */
	readonly url: string;
	readonly headers: Readonly<Record<string, string | undefined>>;
	/** The body as text, or already parsed. */
	readonly body?: string | unknown;
}

/**
 * What to answer with.
 *
 * A live operation answers with `stream` instead of `body`: an iterable of
 * event-stream frames, ready to be written as they arrive.
 */
export interface HttpResponse {
	readonly status: number;
	readonly headers: Readonly<Record<string, string>>;
	readonly body?: string | undefined;
	readonly stream?: AsyncIterable<string> | undefined;
}

/** Media types this transport reads and writes. */
export const MediaType = {
	JSON: 'application/json',
	EVENT_STREAM: 'text/event-stream',
} as const;

const JSON_HEADERS = {
	'content-type': 'application/json; charset=utf-8',
} as const;

/** Answer with a JSON body. */
export const jsonResponse = (
	status: number,
	payload: unknown
): HttpResponse => ({
	status,
	headers: JSON_HEADERS,
	body: JSON.stringify(payload),
});

/** Answer with the response shape, carrying only errors. */
export const errorResponse = (
	status: number,
	messages: readonly string[],
	headers: Readonly<Record<string, string>> = {}
): HttpResponse => ({
	status,
	headers: { ...JSON_HEADERS, ...headers },
	body: JSON.stringify({
		data: null,
		errors: messages.map((message) => ({ message, path: [] })),
		extensions: { cost: 0 },
	}),
});
