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

import { selectOperation } from '../../analysis/index.js';
import type { Catalog } from '../../catalog/index.js';
import {
	coerceVariableValues,
	type ErrorPolicy,
	type ExecutionResult,
	type LiveSources,
	type Resolvers,
} from '../../execution/index.js';
import { NexExecutionError } from '../../errors/index.js';
import type { DocumentNode } from '../../language/ast/index.js';
import type { OperationType } from '../../language/kinds/index.js';
import { execute, formatErrors } from '../../api/execute.js';
import { parseSafe } from '../../api/parse.js';
import { subscribe } from '../../api/subscribe.js';
import {
	validateRequest,
	type RequestLimits,
} from '../../api/validate-request.js';
import { toEventStream } from './event-stream.js';
import {
	errorResponse,
	jsonResponse,
	type HttpRequest,
	type HttpRequestBody,
	type HttpResponse,
} from './messages.js';
import { parseGetRequest, parsePostRequest } from './parse.js';

/** How to serve requests that arrive over HTTP. */
export interface HttpHandlerOptions {
	readonly catalog: Catalog;
	readonly resolvers?: Resolvers | undefined;
	/** Where live fields get their events, when live operations are served. */
	readonly sources?: LiveSources | undefined;
	/** Passed to every resolver untouched. */
	readonly context?: unknown;
	/** What to do with a field that fails. */
	readonly errorPolicy?: ErrorPolicy | undefined;
	/** Cost and depth limits enforced before anything runs. */
	readonly limits?: RequestLimits | undefined;
	/** How many requests one batch may carry. Defaults to 10. */
	readonly maxBatchSize?: number | undefined;
	/** Whether `__schema` and `__type` may be asked for. Defaults to `true`. */
	readonly introspection?: boolean | undefined;
	/** Rewrite every error before it goes on the wire. */
	readonly formatError?:
		| ((error: NexExecutionError) => NexExecutionError)
		| undefined;
}

const DEFAULT_MAX_BATCH_SIZE = 10;

/**
 * What one request produced, and whether it ever ran.
 *
 * A request error - it did not parse, or it does not agree with the catalog -
 * is the client's mistake and answers 4xx. A field that failed while running
 * is part of a perfectly good response, and answers 200 with the errors in
 * the body, which is what a partial response is for.
 */
interface RanRequest {
	readonly result: ExecutionResult;
	readonly requestError: boolean;
}

/**
 * The operation a request will run, read once.
 *
 * Deciding what a request is - live, or safe enough for GET - and running it
 * all need the parsed document, so it is parsed here and handed on.
 */
const readOperation = (
	body: HttpRequestBody
):
	| { readonly document: DocumentNode; readonly operation?: OperationType }
	| undefined => {
	const parsed = parseSafe(body.query);
	if (!parsed.success) return undefined;

	const operation = selectOperation(parsed.document, body.operationName);
	return {
		document: parsed.document,
		...(operation === undefined ? {} : { operation: operation.operation }),
	};
};

const refused = (
	messages: readonly string[],
	options: HttpHandlerOptions
): RanRequest => ({
	result: {
		data: null,
		errors: formatErrors(
			messages.map((message) => new NexExecutionError({ message })),
			options.formatError
		),
		extensions: { cost: 0 },
	},
	requestError: true,
});

const runOne = async (
	body: HttpRequestBody,
	options: HttpHandlerOptions,
	read = readOperation(body)
): Promise<RanRequest> => {
	if (read === undefined) {
		const parsed = parseSafe(body.query);
		return refused(
			[parsed.success ? 'The request could not be read' : parsed.error.message],
			options
		);
	}

	const problems = validateRequest(read.document, options.catalog, {
		...options.limits,
		...(options.introspection === undefined
			? {}
			: { introspection: options.introspection }),
		...(body.variables === undefined ? {} : { variables: body.variables }),
		...(body.operationName === undefined
			? {}
			: { operationName: body.operationName }),
	});
	if (problems.length > 0) {
		return refused(
			problems.map((problem) => problem.message),
			options
		);
	}

	const operation = selectOperation(read.document, body.operationName);
	if (operation === undefined) {
		return refused(
			[
				body.operationName === undefined
					? 'The document defines no operation to run'
					: `The document defines no operation named "${body.operationName}"`,
			],
			options
		);
	}

	// Variables are the client's to get right, so a value that does not fit is
	// a request error rather than something that shows up mid-response.
	const coerced = coerceVariableValues(
		options.catalog,
		operation,
		body.variables ?? {}
	);
	if ('errors' in coerced) return refused(coerced.errors, options);

	const result = await execute({
		request: read.document,
		catalog: options.catalog,
		validate: false,
		...(options.resolvers === undefined
			? {}
			: { resolvers: options.resolvers }),
		...(body.variables === undefined ? {} : { variables: body.variables }),
		...(body.operationName === undefined
			? {}
			: { operationName: body.operationName }),
		...(options.context === undefined ? {} : { context: options.context }),
		...(options.errorPolicy === undefined
			? {}
			: { errorPolicy: options.errorPolicy }),
		...(options.formatError === undefined
			? {}
			: { formatError: options.formatError }),
	});

	return { result, requestError: false };
};

/**
 * Serve one HTTP request.
 *
 * Reads the request, runs it, and hands back what to answer with - nothing in
 * here knows about a particular server, so any of them can mount it.
 *
 * `GET` carries safe queries only; a mutation or a live operation sent that
 * way is refused with the methods that would work. A live operation answers
 * with an event stream instead of a body.
 */
export const handleHttpRequest = async (
	request: HttpRequest,
	options: HttpHandlerOptions
): Promise<HttpResponse> => {
	const method = request.method.toUpperCase();

	if (method !== 'GET' && method !== 'POST') {
		return errorResponse(405, [`${method} is not supported`], {
			allow: 'GET, POST',
		});
	}

	const parsed =
		method === 'POST'
			? parsePostRequest(
					request,
					options.maxBatchSize ?? DEFAULT_MAX_BATCH_SIZE
				)
			: parseGetRequest(request);

	if (!parsed.ok) {
		return errorResponse(parsed.status, [parsed.message]);
	}

	const [first] = parsed.batch;
	if (first === undefined) {
		return errorResponse(400, ['A batch must hold at least one request']);
	}

	const read = readOperation(first);
	const live = read?.operation === 'live';
	const safe = read === undefined || read.operation === 'query';

	if (method === 'GET' && !safe) {
		return errorResponse(
			405,
			['Only a query may be sent with GET; send this with POST'],
			{ allow: 'POST' }
		);
	}

	if (live) {
		if (parsed.batch.length > 1) {
			return errorResponse(400, ['A live operation cannot be batched']);
		}

		return {
			status: 200,
			headers: {
				'content-type': 'text/event-stream',
				'cache-control': 'no-cache',
				connection: 'keep-alive',
			},
			stream: toEventStream(
				subscribe({
					request: first.query,
					catalog: options.catalog,
					sources: options.sources ?? {},
					...(options.resolvers === undefined
						? {}
						: { resolvers: options.resolvers }),
					...(first.variables === undefined
						? {}
						: { variables: first.variables }),
					...(first.operationName === undefined
						? {}
						: { operationName: first.operationName }),
					...(options.context === undefined
						? {}
						: { context: options.context }),
					...(options.limits === undefined ? {} : { limits: options.limits }),
					...(options.introspection === undefined
						? {}
						: { introspection: options.introspection }),
					...(options.formatError === undefined
						? {}
						: { formatError: options.formatError }),
				})
			),
		};
	}

	if (parsed.batch.length > 1) {
		const ran = await Promise.all(
			parsed.batch.map((body) => runOne(body, options))
		);
		return jsonResponse(
			200,
			ran.map((one) => one.result)
		);
	}

	const ran = await runOne(first, options, read);
	return jsonResponse(ran.requestError ? 400 : 200, ran.result);
};
