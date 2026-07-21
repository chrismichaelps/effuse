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

import type { HttpMethod } from '../layers/types.js';
import type { ServerRequestDefinition } from './request-contract.js';
import type {
	AnyTypedServerRoute,
	TypedServerRoute,
} from './route-contract.js';
import type { AnyServerValidator, ServerValidator } from './validation.js';
import type { ServerSchemaInput, ServerSchemaOutput } from './server-schema.js';
import { createLayerRoutePath, LayerServerClientError } from './client.js';
import { isStreamResponse } from './response-contract.js';

type Simplify<T> = { [K in keyof T]: T[K] };

type ValidatorOutput<V> =
	V extends ServerValidator<infer Output> ? Output : never;

/**
 * What a caller must send for a source. Schemas describe both an input and an
 * output form — a query `numberFromString` accepts the wire string and yields a
 * number — so the client is typed with the input form the transport carries.
 * Non-schema validators have no distinct input form and fall back to their
 * output type.
 */
type SourceInput<V> = [ServerSchemaInput<V>] extends [never]
	? ValidatorOutput<V>
	: ServerSchemaInput<V>;

type SourceField<Key extends string, V> = V extends AnyServerValidator
	? { readonly [K in Key]: SourceInput<V> }
	: Record<never, never>;

type RequestDefinitionOf<Contract> =
	Contract extends { readonly schemas: infer Schemas } ? Schemas : never;

/** The typed argument for calling a route, derived from its request contract. */
export type TypedRouteInput<Contract> =
	RequestDefinitionOf<Contract> extends infer Definition
		? Definition extends ServerRequestDefinition<
				AnyServerValidator | undefined,
				AnyServerValidator | undefined,
				AnyServerValidator | undefined,
				AnyServerValidator | undefined,
				AnyServerValidator | undefined
			>
			? Simplify<
					SourceField<'params', Definition['params']> &
						SourceField<'query', Definition['query']> &
						SourceField<'headers', Definition['headers']> &
						SourceField<'body', Definition['json']>
				>
			: Record<never, never>
		: Record<never, never>;

/**
 * What a route call resolves to. A route declaring a response contract resolves
 * to that contract's output; one without stays `unknown`, so an untyped route
 * never masquerades as typed.
 */
export type TypedRouteResult<Response> = Response extends AnyServerValidator
	? [ServerSchemaOutput<Response>] extends [never]
		? ValidatorOutput<Response>
		: ServerSchemaOutput<Response>
	: unknown;

type RouteContractOf<Route> =
	Route extends TypedServerRoute<infer Contract, infer Response, infer Services>
		? Services extends Record<string, unknown>
			? { request: Contract; response: Response }
			: never
		: never;

export interface TypedRouteCallOptions
	extends Omit<RequestInit, 'body' | 'method'> {
	readonly baseUrl?: string | URL;
	readonly fetch?: typeof fetch;
	readonly method?: HttpMethod;
}

type HasKeys<T> = keyof T extends never ? false : true;

/** A callable for one route: typed input in, typed result out. */
export type TypedRouteCaller<Route> =
	RouteContractOf<Route> extends { request: infer Contract; response: infer Response }
		? HasKeys<TypedRouteInput<Contract>> extends true
			? (
					input: TypedRouteInput<Contract>,
					options?: TypedRouteCallOptions
				) => Promise<TypedRouteResult<Response>>
			: (
					input?: TypedRouteInput<Contract>,
					options?: TypedRouteCallOptions
				) => Promise<TypedRouteResult<Response>>
		: never;

export type TypedRouteClient<Routes extends Record<string, unknown>> = {
	readonly [K in keyof Routes]: TypedRouteCaller<Routes[K]>;
};

export interface TypedRouteClientOptions {
	readonly baseUrl?: string | URL;
	readonly fetch?: typeof fetch;
	readonly headers?: HeadersInit;
}

interface CallInput {
	readonly params?: Record<string, unknown>;
	readonly query?: Record<string, unknown>;
	readonly headers?: Record<string, unknown>;
	readonly body?: unknown;
}

const METHOD_PRIORITY: readonly HttpMethod[] = [
	'GET',
	'POST',
	'PUT',
	'PATCH',
	'DELETE',
	'HEAD',
	'OPTIONS',
];

/**
 * A route's default method is the first it declares in conventional priority
 * order, so a single-method route needs no method at the call site. Callers
 * override explicitly when a route serves several methods.
 */
const defaultMethodFor = (methods: readonly string[]): HttpMethod => {
	for (const candidate of METHOD_PRIORITY) {
		if (methods.includes(candidate)) {
			return candidate;
		}
	}
	return 'GET';
};

const toQueryRecord = (
	query: Record<string, unknown> | undefined
): Record<string, string> | undefined => {
	if (!query) {
		return undefined;
	}
	const out: Record<string, string> = {};
	for (const [key, value] of Object.entries(query)) {
		if (value !== undefined && value !== null) {
			out[key] = String(value);
		}
	}
	return out;
};

const readTypedResponse = async (
	response: Response,
	stream: boolean
): Promise<unknown> => {
	if (!response.ok) {
		const body = await response
			.clone()
			.text()
			.catch(() => '');
		throw new LayerServerClientError(response, body);
	}
	// A streaming/binary route surfaces the raw Response — the caller owns how the
	// body is consumed, and buffering it here would defeat streaming and corrupt
	// binary payloads.
	if (stream) {
		return response;
	}
	if (response.status === 204) {
		return undefined;
	}
	if (response.headers.get('Content-Type')?.includes('application/json')) {
		return response.json();
	}
	return response.text();
};

/**
 * Build a client whose calls are typed by the routes themselves. Each route's
 * request contract types the call's params/query/headers/body, and its response
 * contract types the result — no manual generics and no generated build step.
 *
 * ```ts
 * const client = createTypedRouteClient({ search: searchRoute });
 * const result = await client.search({ query: { limit: '3' } });
 * //    ^ typed from searchRoute's response contract
 * ```
 */
export const createTypedRouteClient = <
	const Routes extends Record<string, AnyTypedServerRoute>,
>(
	routes: Routes,
	options: TypedRouteClientOptions = {}
): TypedRouteClient<Routes> => {
	const client: Record<string, unknown> = {};

	for (const [name, route] of Object.entries(routes)) {
		const isStream = isStreamResponse(route.response);
		client[name] = async (
			input: CallInput = {},
			callOptions: TypedRouteCallOptions = {}
		): Promise<unknown> => {
			const {
				baseUrl = options.baseUrl,
				fetch: fetchImpl = options.fetch ?? globalThis.fetch,
				method = defaultMethodFor(Object.keys(route.methods)),
				...init
			} = callOptions;

			const path = createLayerRoutePath(route.path, {
				params: input.params as never,
				query: toQueryRecord(input.query) as never,
			});
			const url = baseUrl ? new URL(path, baseUrl) : path;

			const headers = new Headers(options.headers);
			for (const [key, value] of Object.entries(input.headers ?? {})) {
				if (value !== undefined && value !== null) {
					headers.set(key, String(value));
				}
			}
			for (const [key, value] of new Headers(init.headers)) {
				headers.set(key, value);
			}

			const hasBody = input.body !== undefined;
			if (hasBody && !headers.has('Content-Type')) {
				headers.set('Content-Type', 'application/json');
			}

			const response = await fetchImpl(url as never, {
				...init,
				headers,
				method,
				...(hasBody ? { body: JSON.stringify(input.body) } : {}),
			});

			return readTypedResponse(response, isStream);
		};
	}

	return client as TypedRouteClient<Routes>;
};
