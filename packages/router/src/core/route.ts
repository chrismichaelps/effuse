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
import {
	compareRoutePatterns,
	compileRoutePattern,
	matchRoutePattern,
	parseRoutePattern,
	resolveRoutePattern,
	type BlueprintDef,
	type EffuseChild,
	type RoutePattern,
} from '@effuse/core';
import { RouteNotFoundError } from '../errors.js';
import type { NavigationGuard } from '../navigation/guards.js';

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
	/**
	 * Controls the props injected into the matched component. This option is the
	 * single source of truth for prop injection — route params are never merged
	 * on top of it:
	 *
	 * - absent or `true` — the route params are injected as props (default).
	 * - `false` — nothing is injected; params remain available via `useRoute()`.
	 * - object — exactly that object is injected; params are not auto-merged.
	 * - function — exactly its return value is injected; it receives the current
	 *   `route`, so it can spread `route.params` explicitly when desired.
	 */
	readonly props?:
		| boolean
		| Record<string, unknown>
		| ((route: Route) => Record<string, unknown>);
	readonly beforeEnter?: NavigationGuard;
}

export interface RouteGroupMetadata {
	/** Route groups declared by the canonical record and its canonical ancestors. */
	readonly canonicalRouteGroups: readonly string[];
	/** Additional route groups introduced by the alias path that matched the URL. */
	readonly aliasRouteGroups: readonly string[];
	/** Ordered, duplicate-free union of canonical and alias route groups. */
	readonly routeGroups: readonly string[];
}

export interface NormalizedRouteRecord
	extends RouteRecord,
		RouteGroupMetadata {
	readonly path: string;
	readonly regex: RegExp;
	readonly paramNames: readonly string[];
	readonly pattern: RoutePattern;
	readonly fullPath: string;
	readonly parent: NormalizedRouteRecord | undefined;
	readonly aliasOf?: NormalizedRouteRecord;
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

export interface ResolvedRoute extends RouteGroupMetadata {
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

export interface Route extends RouteGroupMetadata {
	readonly path: string;
	readonly fullPath: string;
	readonly params: Record<string, string>;
	readonly query: Record<string, string | string[]>;
	readonly hash: string;
	readonly matched: readonly NormalizedRouteRecord[];
	readonly name: string | undefined;
	readonly meta: Record<string, unknown>;
}

export type NavigationHookCleanup = () => void;

export const parseQuery = (
	search: string
): Record<string, string | string[]> => {
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

export const stringifyQuery = (
	query: Record<string, string | string[]>
): string => {
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
): {
	pathname: string;
	query: Record<string, string | string[]>;
	hash: string;
} => {
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

const isAncestorRoute = (
	ancestor: NormalizedRouteRecord,
	route: NormalizedRouteRecord
): boolean => {
	let current = route.parent;
	while (current) {
		if (current === ancestor) return true;
		current = current.parent;
	}
	return false;
};

const assertNoRouteCollisions = (
	routes: readonly NormalizedRouteRecord[]
): void => {
	const signatures = new Map<string, NormalizedRouteRecord>();
	for (const route of routes) {
		const existing = signatures.get(route.pattern.signature);
		if (
			existing &&
			!isAncestorRoute(existing, route) &&
			!isAncestorRoute(route, existing)
		) {
			const existingDescription = existing.aliasOf
				? `alias "${existing.fullPath}" for route "${existing.aliasOf.fullPath}"`
				: `route "${existing.fullPath}"`;
			const routeDescription = route.aliasOf
				? `alias "${route.fullPath}" for route "${route.aliasOf.fullPath}"`
				: `route "${route.fullPath}"`;
			throw new TypeError(
				`The ${existingDescription} and ${routeDescription} resolve to the same URL pattern "${route.fullPath}".`
			);
		}
		signatures.set(route.pattern.signature, route);
	}
};

const normalizeRouteRecord = (
	route: RouteRecord,
	parent?: NormalizedRouteRecord,
	aliasOf?: NormalizedRouteRecord
): NormalizedRouteRecord => {
	const rawFullPath = parent
		? `${parent.fullPath.replace(/\/$/, '')}/${route.path.replace(/^\//, '')}`
		: route.path;
	const parsed = parseRoutePattern(rawFullPath);
	const fullPath = parsed.path;
	const { regex, paramNames } = compileRoutePattern(parsed);
	const canonicalRouteGroups = aliasOf
		? [...aliasOf.canonicalRouteGroups]
		: [...new Set([...(parent?.canonicalRouteGroups ?? []), ...parsed.groups])];
	const aliasRouteGroups = aliasOf
		? [
				...new Set([
					...(parent?.aliasRouteGroups ?? []),
					...parsed.groups.filter(
						(group) => !canonicalRouteGroups.includes(group)
					),
				]),
			]
		: [];
	const routeGroups = [
		...new Set([...canonicalRouteGroups, ...aliasRouteGroups]),
	];

	return {
		...route,
		fullPath,
		regex,
		paramNames,
		pattern: parsed,
		canonicalRouteGroups,
		aliasRouteGroups,
		routeGroups,
		parent,
		...(aliasOf ? { aliasOf } : {}),
	};
};

const normalizeRouteTree = (
	route: RouteRecord,
	canonicalParent: NormalizedRouteRecord | undefined,
	aliasParents: readonly NormalizedRouteRecord[]
): NormalizedRouteRecord[] => {
	const canonical = normalizeRouteRecord(route, canonicalParent);
	const variants: NormalizedRouteRecord[] = [canonical];
	const aliases: readonly string[] = route.alias
		? typeof route.alias === 'string'
			? [route.alias]
			: route.alias
		: [];
	const { alias: _ignored, ...routeWithoutAlias } = route;
	void _ignored;

	for (const alias of aliases) {
		variants.push(
			normalizeRouteRecord(
				{ ...routeWithoutAlias, path: alias },
				canonicalParent,
				canonical
			)
		);
	}

	for (const aliasParent of aliasParents) {
		variants.push(
			normalizeRouteRecord(routeWithoutAlias, aliasParent, canonical)
		);
		for (const alias of aliases) {
			variants.push(
				normalizeRouteRecord(
					{ ...routeWithoutAlias, path: alias },
					aliasParent,
					canonical
				)
			);
		}
	}

	const result = [...variants];
	for (const child of route.children ?? []) {
		result.push(...normalizeRouteTree(child, canonical, variants.slice(1)));
	}
	return result;
};

export const finalizeNormalizedRoutes = (
	routes: readonly NormalizedRouteRecord[]
): NormalizedRouteRecord[] => {
	const result = [...routes];
	assertNoRouteCollisions(result);
	result.sort((left, right) => compareRoutePatterns(left.pattern, right.pattern));
	return result;
};

export const normalizeRoutes = (
	routes: readonly RouteRecord[],
	parent?: NormalizedRouteRecord,
	aliasParents: readonly NormalizedRouteRecord[] = []
): NormalizedRouteRecord[] => {
	const result: NormalizedRouteRecord[] = [];

	for (const route of routes) {
		result.push(...normalizeRouteTree(route, parent, aliasParents));
	}

	return finalizeNormalizedRoutes(result);
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
			const params = matchRoutePattern(
				{
					pattern: route.pattern,
					regex: route.regex,
					paramNames: route.paramNames,
				},
				path
			);
			if (params) {
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
		const namedRoute = normalizedRoutes.find(
			(r) => r.name === location.name && r.aliasOf === undefined
		);
		if (!namedRoute) {
			throw new RouteNotFoundError({ name: location.name });
		}
		params = location.params ?? {};
		query = location.query ?? {};
		hash = location.hash ?? '';
		pathname = resolveRoutePattern(namedRoute.pattern, params);
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
	const matchedRecord = matched.at(-1);

	return {
		path: pathname,
		fullPath,
		params: mergedParams,
		query,
		hash,
		matched,
		canonicalRouteGroups: matchedRecord?.canonicalRouteGroups ?? [],
		aliasRouteGroups: matchedRecord?.aliasRouteGroups ?? [],
		routeGroups: matchedRecord?.routeGroups ?? [],
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
	canonicalRouteGroups: resolved.canonicalRouteGroups,
	aliasRouteGroups: resolved.aliasRouteGroups,
	routeGroups: resolved.routeGroups,
	name: resolved.name,
	meta: resolved.meta,
});
