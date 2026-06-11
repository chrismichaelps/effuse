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

import { Array as Arr, Option, pipe } from 'effect';
import type { Effect } from 'effect';
import type { BlueprintDef, EffuseChild } from '@effuse/core';
import { RouteNotFoundError } from '../errors.js';

export type RouteComponent =
	| ((props?: Record<string, unknown>) => EffuseChild)
	| BlueprintDef;

export const EFFUSE_LAZY_ROUTE: unique symbol = Symbol.for(
	'effuse.router.lazy-route'
) as never;

export interface LazyRouteComponent {
	(): Promise<{ default: RouteComponent }>;
	readonly [EFFUSE_LAZY_ROUTE]?: true;
}

export interface LazyRouteComponentOptions {
	readonly export?: string;
}

const isBlueprintComponent = (value: unknown): value is BlueprintDef =>
	typeof value === 'object' &&
	value !== null &&
	'_tag' in value &&
	(value as { readonly _tag?: unknown })._tag === 'Blueprint';

const isRouteComponent = (value: unknown): value is RouteComponent =>
	typeof value === 'function' || isBlueprintComponent(value);

export const isLazyRouteComponent = (
	value: unknown
): value is LazyRouteComponent =>
	typeof value === 'function' &&
	(value as { readonly [EFFUSE_LAZY_ROUTE]?: unknown })[EFFUSE_LAZY_ROUTE] ===
		true;

export const lazyRouteComponent = (
	loader: () => Promise<Readonly<Record<string, unknown>>>,
	options: LazyRouteComponentOptions = {}
): LazyRouteComponent => {
	let cachedModule: Promise<{ default: RouteComponent }> | undefined;
	const exportName = options.export ?? 'default';

	const lazyComponent = (() => {
		cachedModule ??= loader().then((module) => {
			const component = module[exportName];
			if (!isRouteComponent(component)) {
				throw new TypeError(
					`Effuse lazy route expected "${exportName}" to export a route component.`
				);
			}
			return { default: component };
		});

		return cachedModule;
	}) as LazyRouteComponent;

	Object.defineProperty(lazyComponent, EFFUSE_LAZY_ROUTE, {
		value: true,
		enumerable: false,
		configurable: false,
	});

	return lazyComponent;
};

export const lazyRoute = lazyRouteComponent;

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
	readonly query: Record<string, string | string[]>;
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
	readonly query: Record<string, string | string[]>;
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

export const parseQuery = (search: string): Record<string, string | string[]> => {
	const query: Record<string, string | string[]> = {};
	if (!search || search === '?') return query;
	const searchString = search.startsWith('?') ? search.slice(1) : search;
	const params = new URLSearchParams(searchString);
	for (const [key, value] of params) {
		const existing = query[key];
		if (existing === undefined) {
			query[key] = value;
		} else if (Array.isArray(existing)) {
			existing.push(value);
		} else {
			query[key] = [existing, value];
		}
	}
	return query;
};

export const stringifyQuery = (query: Record<string, string | string[]>): string => {
	const params = new URLSearchParams();
	for (const [key, value] of Object.entries(query)) {
		if (Array.isArray(value)) {
			for (const v of value) {
				params.append(key, v);
			}
		} else {
			params.set(key, value);
		}
	}
	const str = params.toString();
	return str ? `?${str}` : '';
};

export const parseUrl = (
	url: string
): { pathname: string; query: Record<string, string | string[]>; hash: string } => {
	const hashIndex = url.indexOf('#');
	const hash = hashIndex >= 0 ? url.slice(hashIndex) : '';
	const urlWithoutHash = hashIndex >= 0 ? url.slice(0, hashIndex) : url;

	const queryIndex = urlWithoutHash.indexOf('?');
	const pathname =
		queryIndex >= 0 ? urlWithoutHash.slice(0, queryIndex) : urlWithoutHash;
	const queryString = queryIndex >= 0 ? urlWithoutHash.slice(queryIndex) : '';

	const normalizedPathname = (pathname || '/').replace(/\/+/g, '/');

	return { pathname: normalizedPathname, query: parseQuery(queryString), hash };
};

const pathToRegex = (path: string): { regex: RegExp; paramNames: string[] } => {
	const paramNames: string[] = [];
	// Process optional params first, then required params, then wildcards
	let regexPattern = path
		.replace(/:([^/]+)\?/g, (_: string, paramName: string) => {
			paramNames.push(paramName);
			return '<<OPT>>';
		})
		.replace(/:([^/]+)/g, (_: string, paramName: string) => {
			paramNames.push(paramName);
			return '<<REQ>>';
		})
		.replace(/\*/g, '.*');

	// Escape slashes
	regexPattern = regexPattern.replace(/\//g, '\\/');

	// Replace markers with actual regex patterns
	// For optional params, the preceding slash is also optional
	regexPattern = regexPattern
		.replace(/\\\/<<OPT>>/g, '(?:\\/([^/]*))?')
		.replace(/<<OPT>>/g, '([^/]*)?')
		.replace(/<<REQ>>/g, '([^/]+)');

	return { regex: new RegExp(`^${regexPattern}$`), paramNames };
};

/**
 * Score a route path for ranked matching.
 * Higher score = more specific = should match first.
 *
 * Scoring:
 * - Static segment: 4 points
 * - Dynamic param (:id): 2 points
 * - Optional param (:id?): 1 point
 * - Catch-all (*): 0 points
 *
 * More segments always outrank fewer segments at the same specificity.
 */
const scoreRoute = (path: string): number => {
	const segments = path.split('/').filter(Boolean);
	let score = 0;
	for (const segment of segments) {
		if (segment === '*') {
			score += 0;
		} else if (segment.startsWith(':') && segment.endsWith('?')) {
			score += 1;
		} else if (segment.startsWith(':')) {
			score += 2;
		} else {
			score += 4;
		}
	}
	// More segments = higher base score to ensure /a/b outranks /a
	score += segments.length * 0.1;
	return score;
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

	// Generate alias routes that share the same component/guards/meta
	if (route.alias) {
		const aliases: readonly string[] =
			typeof route.alias === 'string' ? [route.alias] : route.alias;
			for (const alias of aliases) {
				const { alias: _ignored, ...routeWithoutAlias } = route;
				void _ignored;
				const aliasRecord = normalizeRouteRecord(
					{ ...routeWithoutAlias, path: alias },
					parent
				);
				result.push(aliasRecord);
			}
		}

		if (route.children) {
			result.push(...normalizeRoutes(route.children, normalized));
		}
	}

	// Sort by specificity: static > dynamic > optional > catch-all
	result.sort((a, b) => scoreRoute(b.fullPath) - scoreRoute(a.fullPath));

	return result;
};

export const matchRoute = (
	pathname: string,
	normalizedRoutes: readonly NormalizedRouteRecord[]
): { matched: NormalizedRouteRecord[]; params: Record<string, string> } => {
	// Try pathname as-is, and also without trailing slash (for matching /about/ against /about)
	const pathVariants = [pathname];
	if (pathname !== '/' && pathname.endsWith('/')) {
		pathVariants.push(pathname.slice(0, -1));
	}

	for (const path of pathVariants) {
		for (const route of normalizedRoutes) {
			const match = path.match(route.regex);
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
	}
	return { matched: [], params: {} };
};

export const resolveRoute = (
	location: RouteLocation,
	normalizedRoutes: readonly NormalizedRouteRecord[],
	_currentRoute?: Route
): ResolvedRoute => {
	let pathname: string;
	let query: Record<string, string | string[]> = {};
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
		name: pipe(
			Arr.last(matched),
			Option.flatMap((m) => Option.fromNullable(m.name)),
			Option.getOrUndefined
		),
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
