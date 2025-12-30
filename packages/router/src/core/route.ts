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

import type { Effect } from 'effect';
import { RouteNotFoundError } from '../errors.js';

export type RouteComponent = (props?: Record<string, unknown>) => unknown;
export type LazyRouteComponent = () => Promise<{ default: RouteComponent }>;

export interface RouteRecord {
	readonly path: string;
	readonly component?: RouteComponent | LazyRouteComponent;
	readonly components?: Record<string, RouteComponent | LazyRouteComponent>;
	readonly name?: string;
	readonly children?: readonly RouteRecord[];
	readonly meta?: Record<string, unknown>;
	readonly redirect?: string | RouteLocation;
	readonly alias?: string | readonly string[];
	readonly props?:
		| boolean
		| Record<string, unknown>
		| ((route: Route) => Record<string, unknown>);
	readonly beforeEnter?: NavigationGuard;
}

export interface NormalizedRouteRecord extends RouteRecord {
	readonly path: string;
	readonly regex: RegExp;
	readonly paramNames: readonly string[];
	readonly fullPath: string;
	readonly parent: NormalizedRouteRecord | undefined;
}

export type RouteLocation =
	| string
	| { path: string; query?: Record<string, string>; hash?: string }
	| {
			name: string;
			params?: Record<string, string>;
			query?: Record<string, string>;
			hash?: string;
	  };

export interface ResolvedRoute {
	readonly path: string;
	readonly fullPath: string;
	readonly params: Record<string, string>;
	readonly query: Record<string, string>;
	readonly hash: string;
	readonly matched: readonly NormalizedRouteRecord[];
	readonly name: string | undefined;
	readonly meta: Record<string, unknown>;
	readonly redirectedFrom?: ResolvedRoute;
}

export interface Route {
	readonly path: string;
	readonly fullPath: string;
	readonly params: Record<string, string>;
	readonly query: Record<string, string>;
	readonly hash: string;
	readonly matched: readonly NormalizedRouteRecord[];
	readonly name: string | undefined;
	readonly meta: Record<string, unknown>;
}

export type NavigationGuardReturn =
	| boolean
	| string
	| RouteLocation
	| Error
	| undefined;

export type NavigationGuard = (
	to: ResolvedRoute,
	from: ResolvedRoute
) =>
	| NavigationGuardReturn
	| Promise<NavigationGuardReturn>
	| Effect.Effect<NavigationGuardReturn>;

export type NavigationHookCleanup = () => void;

export const parseQuery = (search: string): Record<string, string> => {
	const query: Record<string, string> = {};
	if (!search || search === '?') return query;
	const searchString = search.startsWith('?') ? search.slice(1) : search;
	new URLSearchParams(searchString).forEach((value, key) => {
		query[key] = value;
	});
	return query;
};

export const stringifyQuery = (query: Record<string, string>): string => {
	const params = new URLSearchParams(query);
	const str = params.toString();
	return str ? `?${str}` : '';
};

export const parseUrl = (
	url: string
): { pathname: string; query: Record<string, string>; hash: string } => {
	const hashIndex = url.indexOf('#');
	const hash = hashIndex >= 0 ? url.slice(hashIndex) : '';
	const urlWithoutHash = hashIndex >= 0 ? url.slice(0, hashIndex) : url;

	const queryIndex = urlWithoutHash.indexOf('?');
	const pathname =
		queryIndex >= 0 ? urlWithoutHash.slice(0, queryIndex) : urlWithoutHash;
	const queryString = queryIndex >= 0 ? urlWithoutHash.slice(queryIndex) : '';

	const normalizedPathname =
		(pathname || '/').replace(/\/+/g, '/').replace(/\/$/, '') || '/';

	return { pathname: normalizedPathname, query: parseQuery(queryString), hash };
};

const pathToRegex = (path: string): { regex: RegExp; paramNames: string[] } => {
	const paramNames: string[] = [];
	const regexPattern = path
		.replace(/\*/g, '.*')
		.replace(/:([^/]+)\?/g, (_: string, paramName: string) => {
			paramNames.push(paramName);
			return '([^/]*)';
		})
		.replace(/:([^/]+)/g, (_: string, paramName: string) => {
			paramNames.push(paramName);
			return '([^/]+)';
		})
		.replace(/\//g, '\\/');
	return { regex: new RegExp(`^${regexPattern}$`), paramNames };
};

const normalizeRouteRecord = (
	route: RouteRecord,
	parent?: NormalizedRouteRecord
): NormalizedRouteRecord => {
	const fullPath = parent
		? `${parent.fullPath.replace(/\/$/, '')}/${route.path.replace(/^\//, '')}`
		: route.path;
	const { regex, paramNames } = pathToRegex(fullPath);

	return {
		...route,
		fullPath,
		regex,
		paramNames,
		parent,
	};
};

export const normalizeRoutes = (
	routes: readonly RouteRecord[],
	parent?: NormalizedRouteRecord
): NormalizedRouteRecord[] => {
	const result: NormalizedRouteRecord[] = [];

	for (const route of routes) {
		const normalized = normalizeRouteRecord(route, parent);
		result.push(normalized);

		if (route.children) {
			result.push(...normalizeRoutes(route.children, normalized));
		}
	}

	return result;
};

export const matchRoute = (
	pathname: string,
	normalizedRoutes: readonly NormalizedRouteRecord[]
): { matched: NormalizedRouteRecord[]; params: Record<string, string> } => {
	for (const route of normalizedRoutes) {
		const match = pathname.match(route.regex);
		if (match) {
			const params: Record<string, string> = {};
			route.paramNames.forEach((name, index) => {
				params[name] = match[index + 1] ?? '';
			});

			const matched: NormalizedRouteRecord[] = [];
			let current: NormalizedRouteRecord | undefined = route;
			while (current) {
				matched.unshift(current);
				current = current.parent;
			}

			return { matched, params };
		}
	}
	return { matched: [], params: {} };
};

export const resolveRoute = (
	location: RouteLocation,
	normalizedRoutes: readonly NormalizedRouteRecord[],
	_currentRoute?: Route
): ResolvedRoute => {
	let pathname: string;
	let query: Record<string, string> = {};
	let hash = '';
	let params: Record<string, string> = {};

	if (typeof location === 'string') {
		const parsed = parseUrl(location);
		pathname = parsed.pathname;
		query = parsed.query;
		hash = parsed.hash;
	} else if ('path' in location) {
		pathname = location.path;
		query = location.query ?? {};
		hash = location.hash ?? '';
	} else {
		const namedRoute = normalizedRoutes.find((r) => r.name === location.name);
		if (!namedRoute) {
			throw new RouteNotFoundError({ name: location.name });
		}
		params = location.params ?? {};
		query = location.query ?? {};
		hash = location.hash ?? '';
		pathname = namedRoute.fullPath.replace(
			/:([^/]+)\??/g,
			(_: string, paramName: string) => {
				return params[paramName] ?? '';
			}
		);
	}

	const { matched, params: matchedParams } = matchRoute(
		pathname,
		normalizedRoutes
	);
	const mergedParams = { ...matchedParams, ...params };

	const meta: Record<string, unknown> = {};
	for (const route of matched) {
		Object.assign(meta, route.meta);
	}

	const fullPath = pathname + stringifyQuery(query) + hash;

	return {
		path: pathname,
		fullPath,
		params: mergedParams,
		query,
		hash,
		matched,
		name: matched[matched.length - 1]?.name,
		meta,
	};
};

export const createRoute = (resolved: ResolvedRoute): Route => ({
	path: resolved.path,
	fullPath: resolved.fullPath,
	params: resolved.params,
	query: resolved.query,
	hash: resolved.hash,
	matched: resolved.matched,
	name: resolved.name,
	meta: resolved.meta,
});
