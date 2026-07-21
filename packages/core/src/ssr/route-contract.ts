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
	HttpMethod,
	ServerContractHandler,
	ServerContractMethodHandlers,
	ServerHandler,
	ServerMethodHandlers,
	ServerMiddleware,
	ServerRoute,
	ServerRouteMetadata,
} from '../layers/types.js';
import type {
	AnyServerRequestContract,
	ServerRequestContractOutput,
} from './request-contract.js';
import type { AnyServerValidator } from './validation.js';

export interface ServerContractRouteInput<
	Contract extends AnyServerRequestContract,
	S extends Record<string, unknown> = Record<string, unknown>,
> extends ServerContractMethodHandlers<ServerRequestContractOutput<Contract>, S> {
	readonly path: string;
	readonly request: Contract;
	readonly handler?: ServerContractHandler<
		ServerRequestContractOutput<Contract>,
		S
	>;
	readonly methods?: ServerContractMethodHandlers<
		ServerRequestContractOutput<Contract>,
		S
	>;
	readonly metadata?: ServerRouteMetadata;
	readonly middleware?: readonly ServerMiddleware<S>[];
	/**
	 * Validates what the handler returns before it is serialized. A mismatch is a
	 * server-side contract violation, not a client error: it fails closed with a
	 * stable 500 that reports the offending field paths and never echoes the
	 * offending payload.
	 */
	readonly response?: AnyServerValidator;
}

const HTTP_METHODS: readonly HttpMethod[] = [
	'GET',
	'POST',
	'PUT',
	'PATCH',
	'DELETE',
	'OPTIONS',
	'HEAD',
];

const isHttpMethod = (value: string): value is HttpMethod =>
	(HTTP_METHODS as readonly string[]).includes(value);

/**
 * Declare a server route whose handlers receive the request contract's validated
 * output as `ctx.input`. The contract is parsed after middleware and before the
 * handler, so auth and other middleware still run first, and invalid input
 * short-circuits with a stable validation response.
 *
 * ```ts
 * defineServerRoute({
 *   path: '/api/users',
 *   request: defineServerRequest({ query: serverSchema.object({ limit: serverSchema.numberFromString() }) }),
 *   GET: (ctx) => ({ limit: ctx.input.query.limit }), // number, not string
 * });
 * ```
 */
export const defineServerRoute = <
	const Contract extends AnyServerRequestContract,
	S extends Record<string, unknown> = Record<string, unknown>,
>(
	input: ServerContractRouteInput<Contract, S>
): ServerRoute<S> => {
	const methods: ServerMethodHandlers<S> = { ...(input.methods ?? {}) } as
		ServerMethodHandlers<S>;

	if (input.handler) {
		methods.GET = input.handler as unknown as ServerHandler<S>;
	}
	for (const [key, value] of Object.entries(input)) {
		const method = key.toUpperCase();
		if (isHttpMethod(method) && typeof value === 'function') {
			methods[method] = value as unknown as ServerHandler<S>;
		}
	}

	return {
		path: input.path,
		methods,
		request: input.request,
		...(input.response ? { response: input.response } : {}),
		...(input.metadata ? { metadata: input.metadata } : {}),
		...(input.middleware ? { middleware: input.middleware } : {}),
	};
};
