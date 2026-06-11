/**
 * MIT License
 *
 * Copyright (c) 2025 Chris M. Perez
 */

import { describe, it, expect } from 'vitest';
import {
	matchRoute,
	resolveRoute,
	normalizeRoutes,
	parseQuery,
	stringifyQuery,
	parseUrl,
	lazyRoute,
	lazyRouteComponent,
} from '../core/route.js';

const makeRoutes = (paths: string[]) =>
	normalizeRoutes(
		paths.map((path) => ({ path, component: () => path }))
	);

describe('route matching', () => {
	describe('ranked matching', () => {
		it('should prefer static over dynamic segments', () => {
			const routes = makeRoutes(['/teams/:id', '/teams/new']);
			const result = matchRoute('/teams/new', routes);
			expect(result.matched[result.matched.length - 1].path).toBe('/teams/new');
		});

		it('should prefer more specific routes regardless of definition order', () => {
			const routes = makeRoutes(['/:a/:b', '/foo/bar']);
			const result = matchRoute('/foo/bar', routes);
			expect(result.matched[result.matched.length - 1].path).toBe('/foo/bar');
		});

		it('should still match dynamic when no static alternative', () => {
			const routes = makeRoutes(['/teams/:id', '/teams/new']);
			const result = matchRoute('/teams/123', routes);
			expect(result.matched[result.matched.length - 1].path).toBe('/teams/:id');
			expect(result.params).toEqual({ id: '123' });
		});

		it('should prefer routes with more static segments', () => {
			const routes = makeRoutes(['/a', '/a/b']);
			const result = matchRoute('/a/b', routes);
			expect(result.matched[result.matched.length - 1].path).toBe('/a/b');
		});
	});

	describe('params', () => {
		it('should extract single param', () => {
			const routes = makeRoutes(['/user/:id']);
			const result = matchRoute('/user/42', routes);
			expect(result.params).toEqual({ id: '42' });
		});

		it('should extract multiple params', () => {
			const routes = makeRoutes(['/user/:userId/post/:postId']);
			const result = matchRoute('/user/7/post/99', routes);
			expect(result.params).toEqual({ userId: '7', postId: '99' });
		});

		it('should handle optional param', () => {
			const routes = makeRoutes(['/docs/:section?']);
			const withParam = matchRoute('/docs/api', routes);
			expect(withParam.params).toEqual({ section: 'api' });

			const withoutParam = matchRoute('/docs', routes);
			expect(withoutParam.params).toEqual({ section: '' });
		});

		it('should return empty params for no match', () => {
			const routes = makeRoutes(['/user/:id']);
			const result = matchRoute('/product/42', routes);
			expect(result.matched).toHaveLength(0);
			expect(result.params).toEqual({});
		});
	});

	describe('trailing slashes', () => {
		it('should match route with trailing slash', () => {
			const routes = makeRoutes(['/about']);
			const result = matchRoute('/about/', routes);
			expect(result.matched).toHaveLength(1);
		});

		it('should match route without trailing slash', () => {
			const routes = makeRoutes(['/about']);
			const result = matchRoute('/about', routes);
			expect(result.matched).toHaveLength(1);
		});
	});

	describe('nested routes', () => {
		it('should return parent chain in matched', () => {
			const routes = normalizeRoutes([
				{
					path: '/parent',
					component: () => 'parent',
					children: [
						{
							path: 'child',
							component: () => 'child',
						},
					],
				},
			]);
			const result = matchRoute('/parent/child', routes);
			expect(result.matched).toHaveLength(2);
			expect(result.matched[0].path).toBe('/parent');
			expect(result.matched[1].path).toBe('child');
		});
	});

	describe('lazy components', () => {
		it('should preserve lazy component in normalized route', () => {
			const lazyComponent = () => Promise.resolve({ default: () => 'lazy' });
			const routes = normalizeRoutes([
				{ path: '/lazy', component: lazyComponent },
			]);
			expect(routes[0].component).toBe(lazyComponent);
		});

		it('should match route with lazy component', () => {
			const lazyComponent = () => Promise.resolve({ default: () => 'lazy' });
			const routes = normalizeRoutes([
				{ path: '/lazy', component: lazyComponent },
			]);
			const result = matchRoute('/lazy', routes);
			expect(result.matched).toHaveLength(1);
			expect(result.matched[0].path).toBe('/lazy');
		});

		it('should resolve default lazy route exports', async () => {
			const Page = () => 'lazy page';
			const lazyComponent = lazyRoute(() => Promise.resolve({ default: Page }));

			await expect(lazyComponent()).resolves.toEqual({ default: Page });
		});

		it('should resolve named lazy route exports', async () => {
			const NamedPage = () => 'named page';
			const lazyComponent = lazyRoute(() => Promise.resolve({ NamedPage }), {
				export: 'NamedPage',
			});

			await expect(lazyComponent()).resolves.toEqual({ default: NamedPage });
		});

		it('should cache lazy route loader results', async () => {
			let loadCount = 0;
			const Page = () => 'cached page';
			const lazyComponent = lazyRouteComponent(async () => {
				loadCount += 1;
				return { default: Page };
			});

			await lazyComponent();
			await lazyComponent();

			expect(loadCount).toBe(1);
		});

		it('should reject lazy route modules without the requested component export', async () => {
			const lazyComponent = lazyRoute(() => Promise.resolve({ missing: true }), {
				export: 'Page',
			});

			await expect(lazyComponent()).rejects.toThrow(
				'Effuse lazy route expected "Page" to export a route component.'
			);
		});
	});

	describe('aliases', () => {
		it('should create alias route records', () => {
			const routes = normalizeRoutes([
				{ path: '/users', alias: '/people', component: () => 'users' },
			]);
			const paths = routes.map((r) => r.path);
			expect(paths).toContain('/users');
			expect(paths).toContain('/people');
		});

		it('should match alias path', () => {
			const routes = normalizeRoutes([
				{ path: '/users', alias: '/people', component: () => 'users' },
			]);
			const result = matchRoute('/people', routes);
			expect(result.matched).toHaveLength(1);
			expect(result.matched[0].path).toBe('/people');
		});

		it('should support multiple aliases', () => {
			const routes = normalizeRoutes([
				{
					path: '/users',
					alias: ['/people', '/folks'],
					component: () => 'users',
				},
			]);
			const paths = routes.map((r) => r.path);
			expect(paths).toContain('/users');
			expect(paths).toContain('/people');
			expect(paths).toContain('/folks');
		});
	});
});

describe('resolveRoute', () => {
	it('should resolve string location', () => {
		const routes = makeRoutes(['/']);
		const resolved = resolveRoute('/about?name=test', routes);
		expect(resolved.path).toBe('/about');
		expect(resolved.query.name).toBe('test');
	});

	it('should resolve named location with params', () => {
		const routes = normalizeRoutes([
			{ path: '/user/:id', name: 'user', component: () => 'user' },
		]);
		const resolved = resolveRoute({ name: 'user', params: { id: '42' } }, routes);
		expect(resolved.path).toBe('/user/42');
		expect(resolved.name).toBe('user');
	});

	it('should throw for unknown named route', () => {
		const routes = makeRoutes(['/']);
		expect(() => resolveRoute({ name: 'missing' }, routes)).toThrow();
	});

	it('should merge meta from matched routes', () => {
		const routes = normalizeRoutes([
			{
				path: '/admin',
				component: () => 'admin',
				meta: { requiresAuth: true },
				children: [
					{
						path: 'dashboard',
						component: () => 'dashboard',
						meta: { title: 'Dashboard' },
					},
				],
			},
		]);
		const resolved = resolveRoute('/admin/dashboard', routes);
		expect(resolved.meta).toEqual({ requiresAuth: true, title: 'Dashboard' });
	});
});

describe('parseQuery', () => {
	it('should parse simple query', () => {
		const q = parseQuery('?foo=bar&baz=qux');
		expect(q).toEqual({ foo: 'bar', baz: 'qux' });
	});

	it('should handle multi-value keys', () => {
		const q = parseQuery('?tag=a&tag=b&tag=c');
		expect(q.tag).toEqual(['a', 'b', 'c']);
	});

	it('should mix single and multi values', () => {
		const q = parseQuery('?category=tech&tag=a&tag=b');
		expect(q.category).toBe('tech');
		expect(q.tag).toEqual(['a', 'b']);
	});

	it('should return empty object for empty string', () => {
		expect(parseQuery('')).toEqual({});
		expect(parseQuery('?')).toEqual({});
	});
});

describe('stringifyQuery', () => {
	it('should stringify simple query', () => {
		expect(stringifyQuery({ foo: 'bar' })).toBe('?foo=bar');
	});

	it('should stringify array values', () => {
		expect(stringifyQuery({ tag: ['a', 'b'] })).toBe('?tag=a&tag=b');
	});

	it('should return empty string for empty object', () => {
		expect(stringifyQuery({})).toBe('');
	});
});

describe('parseUrl', () => {
	it('should preserve trailing slashes', () => {
		const url = parseUrl('/about/');
		expect(url.pathname).toBe('/about/');
	});

	it('should normalize multiple slashes', () => {
		const url = parseUrl('/about//page');
		expect(url.pathname).toBe('/about/page');
	});

	it('should extract query and hash', () => {
		const url = parseUrl('/search?q=test#results');
		expect(url.pathname).toBe('/search');
		expect(url.query.q).toBe('test');
		expect(url.hash).toBe('#results');
	});
});
