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
	readonly routeGroups?: readonly string[];
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

const escapeRegExp = (value: string): string =>
	value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const routeGroupName = (segment: string): string | null => {
	const match = segment.match(/^\(([^/()]+)\)$/);
	return match?.[1] ?? null;
};

const isRouteGroupSegment = (segment: string): boolean =>
	routeGroupName(segment) !== null;

const stripRouteGroups = (path: string): { path: string; groups: string[] } => {
	const isAbsolute = path.startsWith('/');
	const hasTrailingSlash = path.endsWith('/') && path !== '/';
	const groups: string[] = [];
	const pathSegments: string[] = [];

	for (const segment of path.split('/')) {
		if (segment.length === 0) {
			continue;
		}

		const group = routeGroupName(segment);
		if (group) {
			groups.push(group);
			continue;
		}

		pathSegments.push(segment);
	}

	if (pathSegments.length === 0) {
		return { path: isAbsolute ? '/' : '', groups };
	}

	return {
		path: `${isAbsolute ? '/' : ''}${pathSegments.join('/')}${
			hasTrailingSlash ? '/' : ''
		}`,
		groups,
	};
};

const isOptionalCatchAllSegment = (segment: string): boolean =>
	/^\[\[\.\.\.([^/[\]]*)\]\]$/.test(segment);

const isRequiredCatchAllSegment = (segment: string): boolean =>
	/^\[\.\.\.([^/[\]]*)\]$/.test(segment);

const optionalCatchAllName = (segment: string): string => segment.slice(5, -2);

const requiredCatchAllName = (segment: string): string => segment.slice(4, -1);

const bracketParamName = (segment: string): string | null => {
	const match = segment.match(/^\[([^/[\]]*)\]$/);
	return match && !isRequiredCatchAllSegment(segment) ? (match[1] ?? '') : null;
};

const colonParamName = (
	segment: string
): { readonly name: string; readonly optional: boolean } | null => {
	if (!segment.startsWith(':')) {
		return null;
	}

	const rawName = segment.slice(1);
	const optional = rawName.endsWith('?');
	const name = optional ? rawName.slice(0, -1) : rawName;
	return name ? { name, optional } : null;
};

const segmentParam = (
	segment: string
): {
	readonly name: string;
	readonly optional: boolean;
	readonly catchAll: boolean;
} | null => {
	if (isOptionalCatchAllSegment(segment)) {
		return {
			name: optionalCatchAllName(segment),
			optional: true,
			catchAll: true,
		};
	}

	if (isRequiredCatchAllSegment(segment)) {
		return {
			name: requiredCatchAllName(segment),
			optional: false,
			catchAll: true,
		};
	}

	const colonParam = colonParamName(segment);
	if (colonParam) {
		return { ...colonParam, catchAll: false };
	}

	const bracketParam = bracketParamName(segment);
	return bracketParam !== null
		? { name: bracketParam, optional: false, catchAll: false }
		: null;
};

const validateRoutePath = (path: string): void => {
	const segments = path.split('/').filter(Boolean);
	const paramNames = new Set<string>();

	segments.forEach((segment, index) => {
		if (isRouteGroupSegment(segment)) {
			return;
		}

		const param = segmentParam(segment);
		if (!param) {
			if (segment.startsWith('[') || segment.endsWith(']')) {
				throw new TypeError(`Invalid route segment "${segment}" in "${path}".`);
			}
			return;
		}

		if (param.name.length === 0) {
			throw new TypeError(`Route params must have a name in "${path}".`);
		}
		if (paramNames.has(param.name)) {
			throw new TypeError(
				`Duplicate route param "${param.name}" in "${path}".`
			);
		}
		paramNames.add(param.name);

		if (
			param.catchAll &&
			segments
				.slice(index + 1)
				.some((candidate) => !isRouteGroupSegment(candidate))
		) {
			throw new TypeError(
				`Catch-all route param "${param.name}" must be the final URL segment in "${path}".`
			);
		}
	});
};

const encodeRouteParam = (value: string, catchAll: boolean): string =>
	catchAll
		? value
				.split('/')
				.map((segment) => encodeURIComponent(segment))
				.join('/')
		: encodeURIComponent(value);

const decodeRouteParam = (value: string): string => {
	try {
		return decodeURIComponent(value);
	} catch {
		return value;
	}
};

const createPathFromParams = (
	path: string,
	params: Record<string, string>
): string => {
	const isAbsolute = path.startsWith('/');
	const hasTrailingSlash = path.endsWith('/') && path !== '/';
	const resolvedSegments: string[] = [];

	for (const segment of path.split('/')) {
		if (segment.length === 0) {
			continue;
		}

		const param = segmentParam(segment);
		if (!param) {
			resolvedSegments.push(segment);
			continue;
		}

		const value = params[param.name];
		if (value === undefined) {
			if (param.optional) {
				continue;
			}
			throw new TypeError(`Missing route param "${param.name}" for "${path}".`);
		}

		if (param.optional && value.length === 0) {
			continue;
		}
		if (value.length === 0) {
			throw new TypeError(`Missing route param "${param.name}" for "${path}".`);
		}

		resolvedSegments.push(encodeRouteParam(value, param.catchAll));
	}

	if (resolvedSegments.length === 0) {
		return isAbsolute ? '/' : '';
	}

	return `${isAbsolute ? '/' : ''}${resolvedSegments.join('/')}${
		hasTrailingSlash ? '/' : ''
	}`;
};

const pathToRegex = (path: string): { regex: RegExp; paramNames: string[] } => {
	const paramNames: string[] = [];
	const segments = path.split('/').filter(Boolean);
	if (segments.length === 0) {
		return {
			regex: new RegExp(`^${path.startsWith('/') ? '\\/' : ''}$`),
			paramNames,
		};
	}

	let regexPattern = '';
	const isAbsolute = path.startsWith('/');
	segments.forEach((segment, index) => {
		const prefix = index === 0 && !isAbsolute ? '' : '\\/';

		if (segment === '*') {
			regexPattern += `${prefix}.*`;
			return;
		}

		if (isOptionalCatchAllSegment(segment)) {
			paramNames.push(optionalCatchAllName(segment));
			regexPattern += index === 0 && !isAbsolute ? '(.*)?' : '(?:\\/(.*))?';
			return;
		}

		if (isRequiredCatchAllSegment(segment)) {
			paramNames.push(requiredCatchAllName(segment));
			regexPattern += `${prefix}(.+)`;
			return;
		}

		const colonParam = colonParamName(segment);
		if (colonParam) {
			paramNames.push(colonParam.name);
			regexPattern += colonParam.optional
				? index === 0 && !isAbsolute
					? '([^/]*)?'
					: '(?:\\/([^/]*))?'
				: `${prefix}([^/]+)`;
			return;
		}

		const bracketParam = bracketParamName(segment);
		if (bracketParam) {
			paramNames.push(bracketParam);
			regexPattern += `${prefix}([^/]+)`;
			return;
		}

		regexPattern += `${prefix}${escapeRegExp(segment)}`;
	});

	if (path.endsWith('/') && path !== '/') {
		regexPattern += '\\/';
	}

	return { regex: new RegExp(`^${regexPattern}$`), paramNames };
};

const routeSegmentSpecificity = (segment: string): number => {
	if (
		isOptionalCatchAllSegment(segment) ||
		(segment.startsWith(':') && segment.endsWith('?'))
	) {
		return -1;
	}
	if (segment === '*' || isRequiredCatchAllSegment(segment)) return 0;
	if (segment.startsWith(':') || bracketParamName(segment) !== null) return 2;
	return 4;
};

const compareRouteSpecificity = (
	left: NormalizedRouteRecord,
	right: NormalizedRouteRecord
): number => {
	const leftSegments = left.fullPath.split('/').filter(Boolean);
	const rightSegments = right.fullPath.split('/').filter(Boolean);
	const maxLength = Math.max(leftSegments.length, rightSegments.length);

	for (let index = 0; index < maxLength; index++) {
		const leftSegment = leftSegments[index];
		const rightSegment = rightSegments[index];
		const leftScore =
			leftSegment === undefined ? 0 : routeSegmentSpecificity(leftSegment);
		const rightScore =
			rightSegment === undefined ? 0 : routeSegmentSpecificity(rightSegment);
		if (leftScore !== rightScore) return rightScore - leftScore;
	}

	return rightSegments.length - leftSegments.length;
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
		const existing = signatures.get(route.regex.source);
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
		signatures.set(route.regex.source, route);
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
	validateRoutePath(rawFullPath);
	const parsed = stripRouteGroups(rawFullPath);
	const fullPath = parsed.path;
	const { regex, paramNames } = pathToRegex(fullPath);
	const routeGroups = [
		...new Set([
			...(aliasOf?.routeGroups ?? []),
			...(parent?.routeGroups ?? []),
			...parsed.groups,
		]),
	];

	return {
		...route,
		fullPath,
		regex,
		paramNames,
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
	result.sort(compareRouteSpecificity);
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
			const match = path.match(route.regex);
			if (match) {
				const params: Record<string, string> = {};
				route.paramNames.forEach((name, index) => {
					params[name] = decodeRouteParam(match[index + 1] ?? '');
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
		const namedRoute = normalizedRoutes.find(
			(r) => r.name === location.name && r.aliasOf === undefined
		);
		if (!namedRoute) {
			throw new RouteNotFoundError({ name: location.name });
		}
		params = location.params ?? {};
		query = location.query ?? {};
		hash = location.hash ?? '';
		pathname = createPathFromParams(namedRoute.fullPath, params);
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
