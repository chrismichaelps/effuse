import { describe, it, expect } from 'vitest';
import {
	compileRoutePattern,
	compareRoutePatterns,
	matchRoutePattern,
	parseRoutePattern,
} from '../../routing/route-pattern.js';
import {
	createRouteTrie,
	isTrieRoutable,
	matchRouteTrie,
} from '../../routing/route-trie.js';

/**
 * The compiled server router sorts routes by specificity and then linearly
 * scans them, taking the first pattern that matches. Replacing that scan with
 * the trie is only safe if both pick the same winner, so this differential
 * test asserts exactly that over a realistic route table.
 */
const ROUTES = [
	'/',
	'/api/users',
	'/api/users/me',
	'/api/users/[id]',
	'/api/users/[id]/posts',
	'/api/users/[id]/posts/[postId]',
	'/api/posts',
	'/api/posts/[slug]',
	'/docs/[...slug]',
	'/docs/intro',
	'/catalog/[category]/[item]',
	'/catalog/featured/[item]',
	'/a/[id]/c',
	'/a/b/d',
	'/files/[...path]',
];

const PATHS = [
	'/',
	'/api/users',
	'/api/users/me',
	'/api/users/42',
	'/api/users/42/posts',
	'/api/users/42/posts/7',
	'/api/posts',
	'/api/posts/hello-world',
	'/docs/intro',
	'/docs/guide/advanced',
	'/docs',
	'/catalog/shoes/running',
	'/catalog/featured/running',
	'/a/b/c',
	'/a/b/d',
	'/a/x/c',
	'/files/deep/nested/file.txt',
	'/unknown',
	'/api',
	'/api/users/42/unknown',
];

// Mirrors the compiled router: sort by specificity, stable by declaration.
const sorted = ROUTES.map((path, index) => ({ path, index }))
	.sort((left, right) => {
		const specificity = compareRoutePatterns(
			parseRoutePattern(left.path),
			parseRoutePattern(right.path)
		);
		return specificity !== 0 ? specificity : left.index - right.index;
	})
	.map(({ path }) => path);

const linearScan = (
	pathname: string
): { path: string; params: Record<string, string> } | null => {
	for (const path of sorted) {
		const params = matchRoutePattern(compileRoutePattern(path), pathname);
		if (params) return { path, params };
	}
	return null;
};

describe('route trie equivalence with the linear scan', () => {
	it('indexes every route in the table', () => {
		expect(sorted.every((path) => isTrieRoutable(path))).toBe(true);
	});

	it('picks the same route and params as the linear scan', () => {
		const trie = createRouteTrie(
			sorted.map((path) => ({ pattern: path, value: path }))
		);

		for (const pathname of PATHS) {
			const expected = linearScan(pathname);
			const actual = matchRouteTrie(trie, pathname);

			expect(actual?.value ?? null, `route for ${pathname}`).toBe(
				expected?.path ?? null
			);
			expect(actual?.params ?? null, `params for ${pathname}`).toEqual(
				expected?.params ?? null
			);
		}
	});
});
