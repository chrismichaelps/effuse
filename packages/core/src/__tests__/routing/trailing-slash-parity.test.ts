/**
 * MIT License
 *
 * Copyright (c) 2025 Chris M. Perez
 */

import { describe, expect, it } from 'vitest';
import {
	compareRoutePatterns,
	compileRoutePattern,
	matchRoutePattern,
	parseRoutePattern,
} from '../../routing/route-pattern.js';
import {
	createRouteTrie,
	isTrieRoutable,
	matchRouteTrie,
} from '../../routing/route-trie.js';

/** What the linear scan resolves, over the same sorted table the server uses. */
const scanMatch = (
	patterns: readonly string[],
	pathname: string
): { value: string; params: Record<string, string> } | null => {
	const sorted = [...patterns].sort((left, right) =>
		compareRoutePatterns(parseRoutePattern(left), parseRoutePattern(right))
	);
	for (const pattern of sorted) {
		const params = matchRoutePattern(compileRoutePattern(pattern), pathname);
		if (params) return { value: pattern, params };
	}
	return null;
};

/** What the trie resolves, over that same sorted table. */
const trieMatch = (
	patterns: readonly string[],
	pathname: string
): { value: string; params: Record<string, string> } | null => {
	const sorted = [...patterns].sort((left, right) =>
		compareRoutePatterns(parseRoutePattern(left), parseRoutePattern(right))
	);
	const trie = createRouteTrie(
		sorted.map((pattern) => ({
			pattern: parseRoutePattern(pattern),
			value: pattern,
		}))
	);
	const found = matchRouteTrie(trie, pathname);
	return found ? { value: found.value, params: found.params } : null;
};

const TABLES: ReadonlyArray<readonly string[]> = [
	['/about'],
	['/'],
	['/users/:id'],
	['/users/:id', '/users/new'],
	['/users/:slug/edit', '/users/:id'],
	['/blog/:year/:month', '/blog/:slug'],
	['/a/:one', '/a/:two/b', '/a/:three/b/c'],
	['/shop', '/shop/:category', '/shop/:category/:item'],
];

const PROBES: readonly string[] = [
	'/',
	'/about',
	'/about/',
	'/users/new',
	'/users/new/',
	'/users/abc',
	'/users/abc/',
	'/blog/hello',
	'/blog/hello/',
	'/blog/2024/06',
	'/blog/2024/06/',
	'/a/x',
	'/a/x/',
	'/a/x/b',
	'/a/x/b/',
	'/shop',
	'/shop/',
	'/shop/tools',
	'/shop/tools/',
	'/shop/tools/hammer',
	'/shop/tools/hammer/',
	'/missing',
	'/missing/',
];

describe('trailing slash parity between trie and linear scan', () => {
	for (const table of TABLES) {
		it(`agrees for ${JSON.stringify(table)}`, () => {
			// Only tables the server would actually index are comparable.
			expect(table.every((pattern) => isTrieRoutable(pattern))).toBe(true);

			for (const pathname of PROBES) {
				expect({ pathname, ...trieMatch(table, pathname) }).toEqual({
					pathname,
					...scanMatch(table, pathname),
				});
			}
		});
	}

	it('resolves a trailing slash the same as the bare path', () => {
		const table = ['/about', '/users/:id'];

		expect(scanMatch(table, '/about/')).toEqual(scanMatch(table, '/about'));
		expect(scanMatch(table, '/users/abc/')).toEqual(
			scanMatch(table, '/users/abc')
		);
	});

	it('keeps the root path matching only itself', () => {
		const table = ['/', '/about'];

		expect(scanMatch(table, '/')?.value).toBe('/');
		expect(trieMatch(table, '/')?.value).toBe('/');
		expect(scanMatch(table, '/about')?.value).toBe('/about');
	});

	it('does not collapse a repeated trailing slash into a match', () => {
		const table = ['/about'];

		expect(scanMatch(table, '/about//')).toEqual(trieMatch(table, '/about//'));
	});

	it('still reports parameters under the matching route name', () => {
		const table = ['/users/:slug/edit', '/users/:id'];

		expect(scanMatch(table, '/users/abc/')).toEqual({
			value: '/users/:id',
			params: { id: 'abc' },
		});
	});
});
