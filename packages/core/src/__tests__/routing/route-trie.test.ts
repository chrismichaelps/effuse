import { describe, it, expect } from 'vitest';
import {
	createRouteTrie,
	matchRouteTrie,
	isTrieRoutable,
} from '../../routing/route-trie.js';
import { parseRoutePattern } from '../../routing/route-pattern.js';

const trieOf = (paths: readonly string[]) =>
	createRouteTrie(paths.map((path) => ({ pattern: path, value: path })));

describe('isTrieRoutable', () => {
	it('accepts static, param, and catch-all patterns', () => {
		expect(isTrieRoutable(parseRoutePattern('/api/users'))).toBe(true);
		expect(isTrieRoutable(parseRoutePattern('/api/users/[id]'))).toBe(true);
		expect(isTrieRoutable(parseRoutePattern('/docs/[...slug]'))).toBe(true);
		expect(isTrieRoutable(parseRoutePattern('/'))).toBe(true);
	});

	it('rejects optional segments that need regex semantics', () => {
		expect(isTrieRoutable(parseRoutePattern('/legacy/[[...rest]]'))).toBe(
			false
		);
	});
});

describe('matchRouteTrie', () => {
	it('matches static routes exactly', () => {
		const trie = trieOf(['/api/users', '/api/posts']);

		expect(matchRouteTrie(trie, '/api/users')?.value).toBe('/api/users');
		expect(matchRouteTrie(trie, '/api/posts')?.value).toBe('/api/posts');
		expect(matchRouteTrie(trie, '/api/unknown')).toBeNull();
	});

	it('captures named params', () => {
		const trie = trieOf(['/api/users/[id]']);
		const match = matchRouteTrie(trie, '/api/users/42');

		expect(match?.value).toBe('/api/users/[id]');
		expect(match?.params).toEqual({ id: '42' });
	});

	it('prefers a static segment over a param at the same depth', () => {
		const trie = trieOf(['/api/users/[id]', '/api/users/me']);

		expect(matchRouteTrie(trie, '/api/users/me')?.value).toBe(
			'/api/users/me'
		);
		expect(matchRouteTrie(trie, '/api/users/7')?.value).toBe(
			'/api/users/[id]'
		);
	});

	it('captures catch-all remainders', () => {
		const trie = trieOf(['/docs/[...slug]']);
		const match = matchRouteTrie(trie, '/docs/guide/getting-started');

		expect(match?.value).toBe('/docs/[...slug]');
		expect(match?.params).toEqual({ slug: 'guide/getting-started' });
	});

	it('prefers a more specific branch over a catch-all', () => {
		const trie = trieOf(['/docs/[...slug]', '/docs/intro']);

		expect(matchRouteTrie(trie, '/docs/intro')?.value).toBe('/docs/intro');
		expect(matchRouteTrie(trie, '/docs/a/b')?.value).toBe('/docs/[...slug]');
	});

	it('backtracks from a static branch that dead-ends into a param branch', () => {
		const trie = trieOf(['/a/[id]/c', '/a/b/d']);

		// '/a/b/c' must fall back to the param branch after the static 'b'
		// subtree fails to provide a 'c' child.
		expect(matchRouteTrie(trie, '/a/b/c')?.value).toBe('/a/[id]/c');
		expect(matchRouteTrie(trie, '/a/b/c')?.params).toEqual({ id: 'b' });
		expect(matchRouteTrie(trie, '/a/b/d')?.value).toBe('/a/b/d');
	});

	it('matches the root path', () => {
		const trie = trieOf(['/']);
		expect(matchRouteTrie(trie, '/')?.value).toBe('/');
	});

	it('decodes percent-encoded param values', () => {
		const trie = trieOf(['/api/users/[name]']);
		expect(matchRouteTrie(trie, '/api/users/a%20b')?.params).toEqual({
			name: 'a b',
		});
	});

	it('does not match a longer path against a shorter static route', () => {
		const trie = trieOf(['/api/users']);
		expect(matchRouteTrie(trie, '/api/users/42')).toBeNull();
	});

	it('does not let a param match an empty segment', () => {
		const trie = trieOf(['/api/[id]']);
		expect(matchRouteTrie(trie, '/api/')).toBeNull();
	});

	it('preserves insertion order for equally specific duplicates', () => {
		const trie = createRouteTrie([
			{ pattern: '/x/[a]', value: 'first' },
			{ pattern: '/x/[b]', value: 'second' },
		]);

		expect(matchRouteTrie(trie, '/x/1')?.value).toBe('first');
	});
});
