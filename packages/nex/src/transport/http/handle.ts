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
	type Authorize,
	type ErrorPolicy,
	type ExecutionResult,
	type LiveSources,
	type Resolvers,
} from '../../execution/index.js';
import { NexErrorCode, NexExecutionError } from '../../errors/index.js';
import type { OperationStore } from '../../api/operation-store.js';
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
export interface HttpHandlerOptions<TContext = unknown> {
	readonly catalog: Catalog;
	readonly resolvers?: Resolvers<TContext> | undefined;
	/** Where live fields get their events, when live operations are served. */
	readonly sources?: LiveSources<TContext> | undefined;
	/** Passed to every resolver untouched. */
	readonly context?: TContext | undefined;
	/** What to do with a field that fails. */
	readonly errorPolicy?: ErrorPolicy | undefined;
	/** Cost and depth limits enforced before anything runs. */
	readonly limits?: RequestLimits | undefined;
	/** How many requests one batch may carry. Defaults to 10. */
	readonly maxBatchSize?: number | undefined;
	/** The operations this server holds, so a client may send a name. */
	readonly operations?: OperationStore | undefined;
	/**
	 * Run nothing but the operations the store holds.
	 *
	 * A request sent whole is refused, which bounds what a client can ask for
	 * to what was registered ahead of time.
	 */
	readonly persistedOnly?: boolean | undefined;
	/** Whether `__schema` and `__type` may be asked for. Defaults to `true`. */
	readonly introspection?: boolean | undefined;
	/** Decide whether a caller may have a field the catalog guards. */
	readonly authorize?: Authorize<TContext> | undefined;
	/** Calls the run off when the caller goes away. */
	readonly signal?: AbortSignal | undefined;
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
	problems: readonly {
		readonly message: string;
		readonly code?: NexErrorCode;
	}[],
	format: HttpHandlerOptions<never>['formatError']
): RanRequest => ({
	result: {
		data: null,
		errors: formatErrors(
			problems.map(
				(problem) =>
					new NexExecutionError({
						message: problem.message,
						...(problem.code === undefined ? {} : { code: problem.code }),
					})
			),
			format
		),
		extensions: { cost: 0 },
	},
	requestError: true,
});

/**
 * Resolve what a request asked to run.
 *
 * A name is looked up in the store; a request sent whole is taken as it is,
 * unless the server only runs what it already knows.
 */
const resolveBody = <TContext>(
	body: HttpRequestBody,
	options: HttpHandlerOptions<TContext>
): HttpRequestBody | string => {
	if (body.id !== undefined) {
		const held = options.operations?.get(body.id);
		if (held === undefined) {
			return `No operation is registered under "${body.id}"`;
		}
		return { ...body, query: held };
	}

	if (options.persistedOnly === true) {
		return 'This server only runs operations it knows: send an "id" rather than a request';
	}

	return body;
};

const runOne = async <TContext>(
	body: HttpRequestBody,
	options: HttpHandlerOptions<TContext>,
	read?: ReturnType<typeof readOperation>
): Promise<RanRequest> => {
	const resolved = resolveBody(body, options);
	if (typeof resolved === 'string') {
		return refused(
			[{ message: resolved, code: NexErrorCode.VALIDATION }],
			options.formatError
		);
	}

	body = resolved;
	read = read ?? readOperation(body);
	if (read === undefined) {
		const parsed = parseSafe(body.query);
		return refused(
			[
				{
					message: parsed.success
						? 'The request could not be read'
						: parsed.error.message,
					code: NexErrorCode.SYNTAX,
				},
			],
			options.formatError
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
		return refused(problems, options.formatError);
	}

	const operation = selectOperation(read.document, body.operationName);
	if (operation === undefined) {
		return refused(
			[
				{
					message:
						body.operationName === undefined
							? 'The document defines no operation to run'
							: `The document defines no operation named "${body.operationName}"`,
				},
			],
			options.formatError
		);
	}

	// Variables are the client's to get right, so a value that does not fit is
	// a request error rather than something that shows up mid-response.
	const coerced = coerceVariableValues(
		options.catalog,
		operation,
		body.variables ?? {}
	);
	if ('errors' in coerced) {
		return refused(
			coerced.errors.map((message) => ({
				message,
				code: NexErrorCode.VARIABLE,
			})),
			options.formatError
		);
	}

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
		...(options.authorize === undefined
			? {}
			: { authorize: options.authorize }),
		...(options.signal === undefined ? {} : { signal: options.signal }),
		...(options.formatError === undefined
			? {}
			: { formatError: options.formatError }),
	});

	return { result, requestError: false };
};

/**
 * Read one request, run it, and say what to answer with.
 *
 * This is the mapping specification section 9 describes - which bodies are
 * requests, which failures are the client's, how a live operation is framed -
 * expressed against plain values. `createNexHandler` wraps it in the web
 * platform's own `Request` and `Response`, which is what a server mounts.
 *
 * `GET` carries safe queries only; a mutation or a live operation sent that
 * way is refused with the methods that would work. A live operation answers
 * with an event stream instead of a body.
 */
export const handleProtocolRequest = async <TContext>(
	request: HttpRequest,
	options: HttpHandlerOptions<TContext>
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

	const resolvedFirst = resolveBody(first, options);
	const read =
		typeof resolvedFirst === 'string'
			? undefined
			: readOperation(resolvedFirst);
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

		if (typeof resolvedFirst === 'string') {
			return errorResponse(400, [resolvedFirst]);
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
					...(options.authorize === undefined
						? {}
						: { authorize: options.authorize }),
					...(options.signal === undefined ? {} : { signal: options.signal }),
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
