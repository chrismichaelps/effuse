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
	MaybePromise,
	RequestDisposer,
	RequestLocals,
	ServerMiddleware,
	ServerResult,
} from '../layers/types.js';
import { parseRoutePattern } from '../routing/route-pattern.js';
import { isHttpMethod } from './server-routes.js';

export type ServerMiddlewarePhase = 'request' | 'route';
export type ServerMiddlewareTarget = 'api' | 'action' | 'page' | 'asset';
export type ServerMiddlewareMethod = HttpMethod | Lowercase<HttpMethod>;

export interface ServerMiddlewareMatchInput {
	readonly paths?: string | readonly string[];
	readonly methods?: ServerMiddlewareMethod | readonly ServerMiddlewareMethod[];
	readonly targets?: ServerMiddlewareTarget | readonly ServerMiddlewareTarget[];
}

type MatchField<Match, Key extends PropertyKey> = Match extends object
	? Key extends keyof Match
		? Match[Key]
		: undefined
	: undefined;

type NormalizeList<
	Value,
	Fallback extends readonly string[],
> = Value extends readonly string[]
	? Readonly<Value>
	: Value extends string
		? readonly [Value]
		: Fallback;

type NormalizeMethod<Value> = Value extends string
	? Uppercase<Value> extends HttpMethod
		? Uppercase<Value>
		: never
	: never;

type NormalizeMethods<Value> = Value extends readonly unknown[]
	? { readonly [Key in keyof Value]: NormalizeMethod<Value[Key]> }
	: Value extends string
		? readonly [NormalizeMethod<Value>]
		: readonly ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS', 'HEAD'];

export type NormalizedServerMiddlewareMatch<
	Match extends ServerMiddlewareMatchInput | undefined = undefined,
> = Readonly<{
	paths: NormalizeList<MatchField<Match, 'paths'>, readonly ['/*']>;
	methods: NormalizeMethods<MatchField<Match, 'methods'>>;
	targets: NormalizeList<
		MatchField<Match, 'targets'>,
		readonly ['api', 'action', 'page']
	>;
}>;

export interface ServerRequestMiddlewareContext {
	readonly request: Request;
	readonly url: URL;
	readonly locals: RequestLocals;
	readonly defer: (disposer: RequestDisposer) => void;
}

export type ServerRequestMiddlewareNext = (
	request?: Request
) => Promise<Response>;

export type ServerRequestMiddleware = (
	context: ServerRequestMiddlewareContext,
	next: ServerRequestMiddlewareNext
) => MaybePromise<ServerResult | void>;

interface ServerMiddlewareDefinitionBase<
	Match extends ServerMiddlewareMatchInput | undefined,
> {
	readonly name?: string;
	readonly order?: number;
	readonly match?: Match;
}

export type ServerRequestMiddlewareDefinition<
	Match extends ServerMiddlewareMatchInput | undefined = undefined,
> = ServerMiddlewareDefinitionBase<Match> & {
	readonly phase: 'request';
	readonly handler: ServerRequestMiddleware;
};

export type ServerRouteMiddlewareDefinition<
	Services extends Record<string, unknown> = Record<string, unknown>,
	Match extends ServerMiddlewareMatchInput | undefined = undefined,
> = ServerMiddlewareDefinitionBase<Match> & {
	readonly phase?: 'route';
	readonly handler: ServerMiddleware<Services>;
};

type DefinedServerMiddlewareBase<
	Match extends ServerMiddlewareMatchInput | undefined,
> = Readonly<{
	readonly name?: string;
	readonly order: number;
	readonly match: NormalizedServerMiddlewareMatch<Match>;
}>;

export type DefinedServerRequestMiddleware<
	Match extends ServerMiddlewareMatchInput | undefined = undefined,
> = DefinedServerMiddlewareBase<Match> &
	Readonly<{
		readonly phase: 'request';
		readonly handler: ServerRequestMiddleware;
	}>;

export type DefinedServerRouteMiddleware<
	Services extends Record<string, unknown> = Record<string, unknown>,
	Match extends ServerMiddlewareMatchInput | undefined = undefined,
> = DefinedServerMiddlewareBase<Match> &
	Readonly<{
		readonly phase: 'route';
		readonly handler: ServerMiddleware<Services>;
	}>;

export type DefinedServerMiddleware =
	| DefinedServerRequestMiddleware<ServerMiddlewareMatchInput | undefined>
	| DefinedServerRouteMiddleware<
			Record<string, unknown>,
			ServerMiddlewareMatchInput | undefined
	  >;

const HTTP_METHODS: readonly HttpMethod[] = [
	'GET',
	'POST',
	'PUT',
	'PATCH',
	'DELETE',
	'OPTIONS',
	'HEAD',
];
const DEFAULT_TARGETS: readonly ServerMiddlewareTarget[] = [
	'api',
	'action',
	'page',
];
const TARGETS = new Set<ServerMiddlewareTarget>([...DEFAULT_TARGETS, 'asset']);

const toList = <Value>(
	value: Value | readonly Value[] | undefined,
	fallback: readonly Value[]
): Value[] => {
	if (value === undefined) return [...fallback];
	if (Array.isArray(value)) return [...value] as Value[];
	return [value as Value];
};

const assertUnique = (values: readonly string[], label: string): void => {
	if (new Set(values).size !== values.length) {
		throw new TypeError(
			`Server middleware ${label} must not contain duplicates.`
		);
	}
};

const normalizeMatch = (
	input: ServerMiddlewareMatchInput | undefined
): NormalizedServerMiddlewareMatch<ServerMiddlewareMatchInput | undefined> => {
	const paths = toList(input?.paths, ['/*']);
	if (paths.length === 0) {
		throw new TypeError('Server middleware paths must not be empty.');
	}
	const signatures = paths.map((path) => {
		if (typeof path !== 'string' || !path.startsWith('/')) {
			throw new TypeError('Server middleware paths must be absolute.');
		}
		const pattern = parseRoutePattern(path);
		return pattern.signature;
	});
	assertUnique(signatures, 'paths');

	const methods = toList(input?.methods, HTTP_METHODS).map((method) => {
		const normalized = String(method).toUpperCase();
		if (!isHttpMethod(normalized)) {
			throw new TypeError(
				`Invalid server middleware method "${String(method)}".`
			);
		}
		return normalized;
	});
	if (methods.length === 0) {
		throw new TypeError('Server middleware methods must not be empty.');
	}
	assertUnique(methods, 'methods');

	const targets = toList(input?.targets, DEFAULT_TARGETS);
	if (targets.length === 0) {
		throw new TypeError('Server middleware targets must not be empty.');
	}
	for (const target of targets) {
		if (!TARGETS.has(target)) {
			throw new TypeError(
				`Invalid server middleware target "${String(target)}".`
			);
		}
	}
	assertUnique(targets, 'targets');

	return Object.freeze({
		paths: Object.freeze(paths),
		methods: Object.freeze(methods),
		targets: Object.freeze(targets),
	}) as NormalizedServerMiddlewareMatch<ServerMiddlewareMatchInput | undefined>;
};

export function defineServerMiddleware<
	Services extends Record<string, unknown> = Record<string, unknown>,
	const Match extends ServerMiddlewareMatchInput | undefined = undefined,
>(
	definition: ServerRouteMiddlewareDefinition<Services, Match>
): DefinedServerRouteMiddleware<Services, Match>;
export function defineServerMiddleware<
	const Match extends ServerMiddlewareMatchInput | undefined = undefined,
>(
	definition: ServerRequestMiddlewareDefinition<Match>
): DefinedServerRequestMiddleware<Match>;
export function defineServerMiddleware(
	definition: unknown
): unknown {
	if (!definition || typeof definition !== 'object') {
		throw new TypeError('Server middleware definition must be an object.');
	}
	const input = definition as Record<string, unknown>;
	if (typeof input.handler !== 'function') {
		throw new TypeError('Server middleware handler must be a function.');
	}
	const phase = input.phase ?? 'route';
	if (phase !== 'request' && phase !== 'route') {
		throw new TypeError(`Invalid server middleware phase "${String(phase)}".`);
	}
	const order = input.order ?? 0;
	if (!Number.isSafeInteger(order)) {
		throw new TypeError('Server middleware order must be a safe integer.');
	}
	if (
		input.name !== undefined &&
		(typeof input.name !== 'string' ||
			!input.name ||
			input.name.trim() !== input.name)
	) {
		throw new TypeError(
			'Server middleware name must be non-empty and trimmed.'
		);
	}
	if (
		input.match !== undefined &&
		(!input.match ||
			typeof input.match !== 'object' ||
			Array.isArray(input.match))
	) {
		throw new TypeError('Server middleware match must be an object.');
	}

	return Object.freeze({
		...(input.name ? { name: input.name } : {}),
		phase,
		order,
		match: normalizeMatch(
			input.match as ServerMiddlewareMatchInput | undefined
		),
		handler: input.handler,
	});
}
