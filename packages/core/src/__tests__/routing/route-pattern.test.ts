import { describe, expect, it } from 'vitest';
import {
	compareRoutePatterns,
	compileRoutePattern,
	matchRoutePattern,
	parseRoutePattern,
	resolveRoutePattern,
} from '../../routing/route-pattern.js';

describe('route pattern grammar', () => {
	it('retains groups while normalizing the URL pattern', () => {
		const pattern = parseRoutePattern(
			'/(admin)/api/(users)/users/[id]/[[...tab]]'
		);

		expect(pattern.path).toBe('/api/users/[id]/[[...tab]]');
		expect(pattern.groups).toEqual(['admin', 'users']);
		expect(pattern.params).toEqual([
			{ name: 'id', optional: false, catchAll: false },
			{ name: 'tab', optional: true, catchAll: true },
		]);
		expect(pattern.signature).toBe('api/users/[]/[...]');
	});

	it.each([
		['/users/[id]', '/users/a%20b', { id: 'a b' }],
		[
			'/docs/[...slug]',
			'/docs/guides/getting%20started',
			{ slug: 'guides/getting started' },
		],
		['/docs/[[...slug]]', '/docs', { slug: '' }],
		['/reports/:year?', '/reports', { year: '' }],
	])('matches %s against %s', (pattern, pathname, params) => {
		expect(matchRoutePattern(compileRoutePattern(pattern), pathname)).toEqual(
			params
		);
	});

	it('interpolates params with segment-safe URL encoding', () => {
		expect(
			resolveRoutePattern('/users/[id]/files/[...path]', {
				id: 'a/b',
				path: 'docs/getting started',
			})
		).toBe('/users/a%2Fb/files/docs/getting%20started');
		expect(resolveRoutePattern('/docs/[[...slug]]', {})).toBe('/docs');
	});

	it('orders static, dynamic, catch-all, and optional routes deterministically', () => {
		const patterns = [
			'/shop/[[...slug]]',
			'/shop/[...slug]',
			'/shop/[id]',
			'/shop/new',
		].sort(compareRoutePatterns);

		expect(patterns).toEqual([
			'/shop/new',
			'/shop/[id]',
			'/shop/[...slug]',
			'/shop/[[...slug]]',
		]);
	});

	it('uses syntax-independent collision signatures', () => {
		expect(parseRoutePattern('/users/:id').signature).toBe(
			parseRoutePattern('/users/[userId]').signature
		);
		expect(parseRoutePattern('/docs/[...slug]').signature).toBe(
			parseRoutePattern('/docs/[[...path]]').signature
		);
	});

	it.each([
		['/users/[]', 'Route params must have a name'],
		['/users/[id]/posts/[id]', 'Duplicate route param "id"'],
		['/docs/[...slug]/edit', 'must be the final URL segment'],
		['/docs/[[...]]', 'Route params must have a name'],
	])('rejects invalid pattern %s', (pattern, message) => {
		expect(() => parseRoutePattern(pattern)).toThrow(message);
	});
});
