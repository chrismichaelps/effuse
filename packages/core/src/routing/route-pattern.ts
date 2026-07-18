export interface RoutePatternParam {
	readonly name: string;
	readonly optional: boolean;
	readonly catchAll: boolean;
}

export type RoutePatternSegment =
	| { readonly kind: 'static'; readonly value: string }
	| { readonly kind: 'group'; readonly value: string }
	| { readonly kind: 'wildcard'; readonly value: '*' }
	| ({ readonly kind: 'param'; readonly value: string } & RoutePatternParam);

export interface RoutePattern {
	readonly source: string;
	readonly path: string;
	readonly groups: readonly string[];
	readonly segments: readonly RoutePatternSegment[];
	readonly urlSegments: readonly Exclude<
		RoutePatternSegment,
		{ readonly kind: 'group' }
	>[];
	readonly params: readonly RoutePatternParam[];
	readonly signature: string;
}

export interface CompiledRoutePattern {
	readonly pattern: RoutePattern;
	readonly regex: RegExp;
	readonly paramNames: readonly string[];
}

const GROUP_SEGMENT = /^\(([^/()]+)\)$/;
const OPTIONAL_CATCH_ALL_SEGMENT = /^\[\[\.\.\.([^/[\]]+)\]\]$/;
const CATCH_ALL_SEGMENT = /^\[\.\.\.([^/[\]]+)\]$/;
const BRACKET_PARAM_SEGMENT = /^\[([^/[\]]+)\]$/;

const parseSegment = (segment: string): RoutePatternSegment => {
	const group = segment.match(GROUP_SEGMENT)?.[1];
	if (group) return { kind: 'group', value: group };
	if (segment === '*') return { kind: 'wildcard', value: '*' };
	if (segment === '[]' || segment === '[...]' || segment === '[[...]]') {
		throw new TypeError(`Route params must have a name.`);
	}

	const optionalCatchAll = segment.match(OPTIONAL_CATCH_ALL_SEGMENT)?.[1];
	if (optionalCatchAll) {
		return {
			kind: 'param',
			value: segment,
			name: optionalCatchAll,
			optional: true,
			catchAll: true,
		};
	}

	const catchAll = segment.match(CATCH_ALL_SEGMENT)?.[1];
	if (catchAll) {
		return {
			kind: 'param',
			value: segment,
			name: catchAll,
			optional: false,
			catchAll: true,
		};
	}

	const bracketParam = segment.match(BRACKET_PARAM_SEGMENT)?.[1];
	if (bracketParam) {
		return {
			kind: 'param',
			value: segment,
			name: bracketParam,
			optional: false,
			catchAll: false,
		};
	}

	if (segment.startsWith(':')) {
		const rawName = segment.slice(1);
		const optional = rawName.endsWith('?');
		const name = optional ? rawName.slice(0, -1) : rawName;
		if (!name) throw new TypeError(`Route params must have a name.`);
		return {
			kind: 'param',
			value: segment,
			name,
			optional,
			catchAll: false,
		};
	}

	if (
		segment.startsWith('[') ||
		segment.endsWith(']') ||
		segment.startsWith('(') ||
		segment.endsWith(')')
	) {
		throw new TypeError(`Invalid route segment "${segment}".`);
	}

	return { kind: 'static', value: segment };
};

const segmentSignature = (segment: RoutePatternSegment): string => {
	if (segment.kind === 'static' || segment.kind === 'wildcard') {
		return segment.value;
	}
	if (segment.kind === 'group') return '';
	if (segment.catchAll) return '[...]';
	return segment.optional ? '[]?' : '[]';
};

export const parseRoutePattern = (source: string): RoutePattern => {
	const absolute = source.startsWith('/');
	const trailingSlash = source.endsWith('/') && source !== '/';
	const segments = source.split('/').filter(Boolean).map(parseSegment);
	const urlSegments = segments.filter(
		(
			segment
		): segment is Exclude<RoutePatternSegment, { readonly kind: 'group' }> =>
			segment.kind !== 'group'
	);
	const paramSegments = urlSegments.filter(
		(
			segment
		): segment is Extract<RoutePatternSegment, { readonly kind: 'param' }> =>
			segment.kind === 'param'
	);
	const names = new Set<string>();

	for (const param of paramSegments) {
		if (names.has(param.name)) {
			throw new TypeError(
				`Duplicate route param "${param.name}" in "${source}".`
			);
		}
		names.add(param.name);
		if (param.catchAll && urlSegments.at(-1) !== param) {
			throw new TypeError(
				`Catch-all route param "${param.name}" must be the final URL segment in "${source}".`
			);
		}
	}
	const params = paramSegments.map(({ name, optional, catchAll }) => ({
		name,
		optional,
		catchAll,
	}));

	const pathBody = urlSegments.map((segment) => segment.value).join('/');
	const path = pathBody
		? `${absolute ? '/' : ''}${pathBody}${trailingSlash ? '/' : ''}`
		: absolute
			? '/'
			: '';

	return {
		source,
		path,
		groups: [
			...new Set(
				segments
					.filter(
						(
							segment
						): segment is Extract<
							RoutePatternSegment,
							{ readonly kind: 'group' }
						> => segment.kind === 'group'
					)
					.map((segment) => segment.value)
			),
		],
		segments,
		urlSegments,
		params,
		signature: urlSegments.map(segmentSignature).join('/'),
	};
};

const escapeRegExp = (value: string): string =>
	value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export const compileRoutePattern = (
	input: string | RoutePattern
): CompiledRoutePattern => {
	const pattern = typeof input === 'string' ? parseRoutePattern(input) : input;
	if (pattern.path === '*' || pattern.path === '/*') {
		return { pattern, regex: /^.*$/, paramNames: [] };
	}
	if (pattern.path === '/') {
		return { pattern, regex: /^\/$/, paramNames: [] };
	}

	const paramNames: string[] = [];
	let expression = '';
	pattern.urlSegments.forEach((segment, index) => {
		const prefix = index === 0 && !pattern.path.startsWith('/') ? '' : '\\/';
		if (segment.kind === 'static') {
			expression += `${prefix}${escapeRegExp(segment.value)}`;
			return;
		}
		if (segment.kind === 'wildcard') {
			expression += `${prefix}.*`;
			return;
		}
		paramNames.push(segment.name);
		if (segment.catchAll) {
			expression += segment.optional
				? index === 0 && !pattern.path.startsWith('/')
					? '(.*)?'
					: `(?:\\/(.*))?`
				: `${prefix}(.+)`;
			return;
		}
		expression += segment.optional
			? index === 0 && !pattern.path.startsWith('/')
				? '([^/]*)?'
				: '(?:\\/([^/]*))?'
			: `${prefix}([^/]+)`;
	});
	if (pattern.path.endsWith('/') && pattern.path !== '/') expression += '\\/';
	return {
		pattern,
		regex: new RegExp(`^${expression}$`),
		paramNames,
	};
};

const decodeRouteValue = (value: string): string => {
	try {
		return decodeURIComponent(value);
	} catch {
		return value;
	}
};

export const matchRoutePattern = (
	input: string | RoutePattern | CompiledRoutePattern,
	pathname: string
): Record<string, string> | null => {
	const compiled =
		typeof input === 'object' && input !== null && 'regex' in input
			? (input as CompiledRoutePattern)
			: compileRoutePattern(input as string | RoutePattern);
	const match = pathname.match(compiled.regex);
	if (!match) return null;
	return Object.fromEntries(
		compiled.paramNames.map((name, index) => [
			name,
			decodeRouteValue(match[index + 1] ?? ''),
		])
	);
};

const encodeRouteValue = (value: string, catchAll: boolean): string =>
	catchAll
		? value
				.split('/')
				.map((segment) => encodeURIComponent(segment))
				.join('/')
		: encodeURIComponent(value);

export const resolveRoutePattern = (
	input: string | RoutePattern,
	params: Readonly<Record<string, string | undefined>>
): string => {
	const pattern = typeof input === 'string' ? parseRoutePattern(input) : input;
	const resolved: string[] = [];
	for (const segment of pattern.urlSegments) {
		if (segment.kind === 'static' || segment.kind === 'wildcard') {
			resolved.push(segment.value);
			continue;
		}
		const value = params[segment.name];
		if (value === undefined || (segment.optional && value.length === 0)) {
			if (segment.optional) continue;
			throw new TypeError(
				`Missing route param "${segment.name}" for "${pattern.source}".`
			);
		}
		if (value.length === 0) {
			throw new TypeError(
				`Missing route param "${segment.name}" for "${pattern.source}".`
			);
		}
		resolved.push(encodeRouteValue(value, segment.catchAll));
	}
	if (resolved.length === 0) return pattern.path.startsWith('/') ? '/' : '';
	return `${pattern.path.startsWith('/') ? '/' : ''}${resolved.join('/')}${
		pattern.path.endsWith('/') ? '/' : ''
	}`;
};

const segmentSpecificity = (segment: RoutePatternSegment): number => {
	if (segment.kind === 'static') return 4;
	if (segment.kind === 'param') {
		if (segment.optional) return -1;
		return segment.catchAll ? 0 : 2;
	}
	return 0;
};

export const compareRoutePatterns = (
	left: string | RoutePattern,
	right: string | RoutePattern
): number => {
	const leftPattern = typeof left === 'string' ? parseRoutePattern(left) : left;
	const rightPattern =
		typeof right === 'string' ? parseRoutePattern(right) : right;
	const length = Math.max(
		leftPattern.urlSegments.length,
		rightPattern.urlSegments.length
	);
	for (let index = 0; index < length; index++) {
		const leftSegment = leftPattern.urlSegments[index];
		const rightSegment = rightPattern.urlSegments[index];
		const leftScore = leftSegment ? segmentSpecificity(leftSegment) : 0;
		const rightScore = rightSegment ? segmentSpecificity(rightSegment) : 0;
		if (leftScore !== rightScore) return rightScore - leftScore;
	}
	return rightPattern.urlSegments.length - leftPattern.urlSegments.length;
};
