/**
 * MIT License
 *
 * Copyright (c) 2025 Chris M. Perez
 */

import { describe, expect, it } from 'vitest';
import {
	createRouteTrie,
	isTrieRoutable,
	matchRouteTrie,
} from '../../routing/route-trie.js';
import {
	compareRoutePatterns,
	compileRoutePattern,
	matchRoutePattern,
} from '../../routing/route-pattern.js';

interface Resolution {
	readonly route: string | null;
	readonly params: Record<string, string> | null;
}

/** Production ordering: specificity first, exactly as `server-routing.ts` sorts. */
const sortRoutes = (routes: readonly string[]): string[] =>
	[...routes]
		.map((path) => ({ path, compiled: compileRoutePattern(path) }))
		.sort((left, right) =>
			compareRoutePatterns(left.compiled.pattern, right.compiled.pattern)
		)
		.map((entry) => entry.path);

/** The reference implementation: first match in the sorted table. */
const byScan = (routes: readonly string[], pathname: string): Resolution => {
	for (const route of routes) {
		const params = matchRoutePattern(route, pathname);
		if (params) return { route, params };
	}
	return { route: null, params: null };
};

const byTrie = (routes: readonly string[], pathname: string): Resolution => {
	const trie = createRouteTrie(
		routes.map((pattern) => ({ pattern, value: pattern }))
	);
	const found = matchRouteTrie(trie, pathname);
	return found
		? { route: found.value, params: found.params }
		: { route: null, params: null };
};

/**
 * The trie exists only as a faster equivalent of the linear scan, so the scan
 * is the oracle. Comparing against it rather than against hardcoded expectations
 * means a divergence fails regardless of which side changed.
 */
const expectParity = (routes: readonly string[], paths: readonly string[]) => {
	const sorted = sortRoutes(routes);
	expect(sorted.every((route) => isTrieRoutable(route))).toBe(true);

	for (const pathname of paths) {
		expect({ pathname, ...byTrie(sorted, pathname) }).toEqual({
			pathname,
			...byScan(sorted, pathname),
		});
	}
};

describe('route trie matches the linear scan', () => {
	it('names parameters from the route that matched', () => {
		expectParity(
			['/users/:id', '/users/:slug/edit'],
			['/users/abc', '/users/abc/edit']
		);
	});

	it('names parameters when a shorter route shares a branch', () => {
		expectParity(
			['/blog/:year/:month', '/blog/:slug'],
			['/blog/2024/06', '/blog/hello']
		);
	});

	it('names parameters across three routes sharing one position', () => {
		expectParity(
			['/o/:one', '/o/:two/x', '/o/:three/x/y'],
			['/o/A', '/o/A/x', '/o/A/x/y']
		);
	});

	it('prefers a static segment over a parameter', () => {
		expectParity(['/p/:id', '/p/new'], ['/p/new', '/p/7']);
	});

	it('backtracks from a dead-end static branch into the parameter branch', () => {
		expectParity(
			['/a/fixed/b', '/a/:x/c'],
			['/a/fixed/b', '/a/other/c', '/a/fixed/c']
		);
	});

	it('binds catch-all routes and the parameters before them', () => {
		expectParity(
			['/files/:bucket/[...path]'],
			['/files/b/a', '/files/b/a/b/c']
		);
	});

	it('prefers an exact route over a catch-all', () => {
		expectParity(['/t/:id', '/t/[...rest]'], ['/t/1', '/t/1/2/3']);
	});

	it('decodes percent-encoded segments', () => {
		expectParity(['/s/:name'], ['/s/a%20b', '/s/caf%C3%A9']);
	});

	it('handles the root and a single parameter', () => {
		expectParity(['/', '/:page'], ['/', '/about']);
	});

	it('reports no match for paths outside the table', () => {
		expectParity(['/a/:x'], ['/b/1', '/a', '/a/1/2']);
	});

	it('keeps declaration order for equally specific duplicates', () => {
		expectParity(['/dup/:first', '/dup/:second'], ['/dup/v']);
	});
});
