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

import type { HttpRequest, HttpRequestBody } from './messages.js';

/** What reading a request produced: work to do, or why it could not be read. */
export type ParsedHttpRequest =
	| { readonly ok: true; readonly batch: readonly HttpRequestBody[] }
	| { readonly ok: false; readonly status: number; readonly message: string };

const asRecord = (value: unknown): Record<string, unknown> | undefined =>
	typeof value === 'object' && value !== null && !Array.isArray(value)
		? (value as Record<string, unknown>)
		: undefined;

/** Read one request out of a decoded body or query string. */
const readOne = (value: unknown): HttpRequestBody | string => {
	const record = asRecord(value);
	if (record === undefined) return 'A request must be an object';

	const id = record.id;
	if (id !== undefined && typeof id !== 'string') {
		return '"id" must be a string';
	}

	const query = record.query;
	if (id === undefined && (typeof query !== 'string' || query.trim() === '')) {
		return 'A request must carry a "query" string or an "id"';
	}

	const variables = record.variables;
	if (
		variables !== undefined &&
		variables !== null &&
		asRecord(variables) === undefined
	) {
		return '"variables" must be an object';
	}

	const operationName = record.operationName;
	if (
		operationName !== undefined &&
		operationName !== null &&
		typeof operationName !== 'string'
	) {
		return '"operationName" must be a string';
	}

	const extensions = record.extensions;
	if (
		extensions !== undefined &&
		extensions !== null &&
		asRecord(extensions) === undefined
	) {
		return '"extensions" must be an object';
	}

	return {
		query: typeof query === 'string' ? query : '',
		...(typeof id === 'string' ? { id } : {}),
		...(asRecord(extensions) === undefined
			? {}
			: { extensions: asRecord(extensions) }),
		...(asRecord(variables) === undefined
			? {}
			: { variables: asRecord(variables) }),
		...(typeof operationName === 'string' ? { operationName } : {}),
	};
};

const readBatch = (value: unknown, maxBatchSize: number): ParsedHttpRequest => {
	const items = Array.isArray(value) ? value : [value];

	if (items.length === 0) {
		return {
			ok: false,
			status: 400,
			message: 'A batch must hold at least one request',
		};
	}
	if (items.length > maxBatchSize) {
		return {
			ok: false,
			status: 400,
			message: `A batch may hold at most ${String(maxBatchSize)} requests, received ${String(items.length)}`,
		};
	}

	const batch: HttpRequestBody[] = [];
	for (const item of items) {
		const parsed = readOne(item);
		if (typeof parsed === 'string') {
			return { ok: false, status: 400, message: parsed };
		}
		batch.push(parsed);
	}

	return { ok: true, batch };
};

/** The query string of a URL, whether or not it carries an origin. */
const searchParamsOf = (url: string): URLSearchParams => {
	const index = url.indexOf('?');
	return new URLSearchParams(index === -1 ? '' : url.slice(index + 1));
};

/** Read a POST body: JSON only, batched or not. */
export const parsePostRequest = (
	request: HttpRequest,
	maxBatchSize: number
): ParsedHttpRequest => {
	const contentType = request.headers['content-type'] ?? '';
	if (!contentType.toLowerCase().includes('application/json')) {
		return {
			ok: false,
			status: 415,
			message: 'The request body must be sent as application/json',
		};
	}

	if (typeof request.body !== 'string') {
		return readBatch(request.body, maxBatchSize);
	}

	let decoded: unknown;
	try {
		decoded = JSON.parse(request.body);
	} catch {
		return {
			ok: false,
			status: 400,
			message: 'The request body is not valid JSON',
		};
	}

	return readBatch(decoded, maxBatchSize);
};

/** Read a GET request: everything comes from the query string. */
export const parseGetRequest = (request: HttpRequest): ParsedHttpRequest => {
	const params = searchParamsOf(request.url);
	const query = params.get('query');

	if (query === null || query.trim() === '') {
		return {
			ok: false,
			status: 400,
			message: 'A request must carry a "query" parameter',
		};
	}

	const rawVariables = params.get('variables');
	let variables: unknown;
	if (rawVariables !== null) {
		try {
			variables = JSON.parse(rawVariables);
		} catch {
			return {
				ok: false,
				status: 400,
				message: 'The "variables" parameter is not valid JSON',
			};
		}
	}

	const rawExtensions = params.get('extensions');
	let extensions: unknown;
	if (rawExtensions !== null) {
		try {
			extensions = JSON.parse(rawExtensions);
		} catch {
			return {
				ok: false,
				status: 400,
				message: 'The "extensions" parameter is not valid JSON',
			};
		}
	}

	const operationName = params.get('operationName');

	return readBatch(
		{
			query,
			...(variables === undefined ? {} : { variables }),
			...(extensions === undefined ? {} : { extensions }),
			...(operationName === null ? {} : { operationName }),
		},
		1
	);
};
