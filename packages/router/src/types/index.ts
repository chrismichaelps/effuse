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

import { Schema } from 'effect';
import type { RouteRecord, Route, RouteLocation } from '../core/route.js';

export interface TypedRouteRecord<
	Params extends Record<string, string> = Record<string, string>,
	Query extends Record<string, string> = Record<string, string>,
	Meta extends Record<string, unknown> = Record<string, unknown>,
> extends RouteRecord {
	readonly paramsSchema?: Schema.Schema<Params>;
	readonly querySchema?: Schema.Schema<Query>;
	readonly meta?: Meta;
}

export interface TypedRoute<
	Params extends Record<string, string> = Record<string, string>,
	Query extends Record<string, string> = Record<string, string>,
	Meta extends Record<string, unknown> = Record<string, unknown>,
> extends Route {
	readonly params: Params;
	readonly query: Query;
	readonly meta: Meta;
}

export type ExtractRouteParams<Path extends string> =
	Path extends `${string}:${infer Param}/${infer Rest}`
		? { [K in Param | keyof ExtractRouteParams<`/${Rest}`>]: string }
		: Path extends `${string}:${infer Param}`
			? { [K in Param]: string }
			: Record<string, never>;

export type TypedRouteLocation<
	Name extends string,
	Params extends Record<string, string> = Record<string, never>,
> = {
	name: Name;
	params?: Params extends Record<string, never> ? undefined : Params;
	query?: Record<string, string>;
	hash?: string;
};

export const defineRoutes = <const Routes extends readonly TypedRouteRecord[]>(
	routes: Routes
): Routes => routes;

export const createTypedNavigator = <
	Params extends Record<string, string>,
	Query extends Record<string, string> = Record<string, string>,
>(
	name: string,
	_paramsSchema?: Schema.Schema<Params>,
	_querySchema?: Schema.Schema<Query>
) => ({
	to: (params: Params, query?: Query): RouteLocation => ({
		name,
		params: params as Record<string, string>,
		query: query as Record<string, string>,
	}),

	matches: (route: Route): route is TypedRoute<Params, Query> =>
		route.name === name,
});

export const validateParams = <A>(
	params: Record<string, string>,
	schema: Schema.Schema<A>
): A | null => {
	try {
		return Schema.decodeUnknownSync(schema)(params);
	} catch {
		return null;
	}
};

export const createParamsGuard =
	<A>(
		schema: Schema.Schema<A>,
		onInvalid: (
			params: Record<string, string>
		) => RouteLocation | string = () => '/'
	) =>
	(to: Route) => {
		const result = validateParams(to.params, schema);
		if (result === null) {
			return onInvalid(to.params);
		}
		return true;
	};
