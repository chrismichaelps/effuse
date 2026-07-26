/**
 * MIT License
 *
 * Copyright (c) 2025 Chris M. Perez
 */

import { describe, it, expect, expectTypeOf } from 'vitest';
import {
	matchRoute,
	resolveRoute,
	normalizeRoutes,
	parseQuery,
	stringifyQuery,
	parseUrl,
	lazyRoute,
	lazyRouteComponent,
	isLazyRouteComponent,
	EFFUSE_LAZY_ROUTE,
} from '../core/route.js';
import type { ExtractRouteParams, TypedRouteLocation } from '../types/index.js';

const makeRoutes = (paths: string[]) =>
	normalizeRoutes(paths.map((path) => ({ path, component: () => path })));

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

		it('should extract bracket params', () => {
			const routes = makeRoutes(['/blog/[slug]']);
			const result = matchRoute('/blog/hello-effuse', routes);

			expect(result.matched[result.matched.length - 1].fullPath).toBe(
				'/blog/[slug]'
			);
			expect(result.params).toEqual({ slug: 'hello-effuse' });
			expect(matchRoute('/blog/hello/extra', routes).matched).toHaveLength(0);
		});

		it('should extract required catch-all bracket params', () => {
			const routes = makeRoutes(['/docs/[...slug]']);
			const result = matchRoute('/docs/guide/routing', routes);

			expect(result.params).toEqual({ slug: 'guide/routing' });
			expect(matchRoute('/docs', routes).matched).toHaveLength(0);
		});

		it('should extract optional catch-all bracket params', () => {
			const routes = makeRoutes(['/shop/[[...slug]]']);

			const withoutParam = matchRoute('/shop', routes);
			expect(withoutParam.params).toEqual({ slug: '' });

			const withParam = matchRoute('/shop/clothes/tops', routes);
			expect(withParam.params).toEqual({ slug: 'clothes/tops' });
		});

		it('should decode bracket and catch-all params like server routes', () => {
			const routes = makeRoutes(['/blog/[slug]', '/docs/[...slug]']);

			expect(matchRoute('/blog/hello%20effuse', routes).params).toEqual({
				slug: 'hello effuse',
			});
			expect(matchRoute('/docs/guides/routing%20rules', routes).params).toEqual(
				{
					slug: 'guides/routing rules',
				}
			);
		});

		it('should prefer an exact route over an optional catch-all', () => {
			const routes = normalizeRoutes([
				{ path: '/shop/[[...slug]]', name: 'shop-catch-all' },
				{ path: '/shop', name: 'shop' },
			]);

			expect(matchRoute('/shop', routes).matched.at(-1)?.name).toBe('shop');
		});

		it('should rank routes by segment position instead of score totals', () => {
			for (const routeRecords of [
				[
					{ path: '/:first/edit', name: 'dynamic-first' },
					{ path: '/users/:id', name: 'static-first' },
				],
				[
					{ path: '/users/:id', name: 'static-first' },
					{ path: '/:first/edit', name: 'dynamic-first' },
				],
			]) {
				const routes = normalizeRoutes(routeRecords);
				expect(matchRoute('/users/edit', routes).matched.at(-1)?.name).toBe(
					'static-first'
				);
			}
		});
	});

	describe('route groups', () => {
		it('should strip route groups from matchable URLs', () => {
			const routes = normalizeRoutes([
				{
					path: '/(app)/dashboard',
					component: () => 'dashboard',
				},
			]);

			const result = matchRoute('/dashboard', routes);
			expect(result.matched).toHaveLength(1);
			expect(result.matched[0].fullPath).toBe('/dashboard');
			expect(result.matched[0].routeGroups).toEqual(['app']);
			expect(matchRoute('/(app)/dashboard', routes).matched).toHaveLength(0);
		});

		it('should inherit nested route group metadata', () => {
			const routes = normalizeRoutes([
				{
					path: '/(app)',
					component: () => 'app',
					children: [
						{
							path: '(admin)/dashboard',
							component: () => 'dashboard',
						},
					],
				},
			]);

			const result = matchRoute('/dashboard', routes);
			expect(result.matched).toHaveLength(2);
			expect(result.matched[0].fullPath).toBe('/');
			expect(result.matched[0].routeGroups).toEqual(['app']);
			expect(result.matched[1].fullPath).toBe('/dashboard');
			expect(result.matched[1].routeGroups).toEqual(['app', 'admin']);
			const resolved = resolveRoute('/dashboard', routes);
			expect(resolved.canonicalRouteGroups).toEqual(['app', 'admin']);
			expect(resolved.aliasRouteGroups).toEqual([]);
			expect(resolved.routeGroups).toEqual(['app', 'admin']);
		});

		it('should reject route group and dynamic signature collisions', () => {
			expect(() =>
				normalizeRoutes([
					{ path: '/(app)/dashboard' },
					{ path: '/(admin)/dashboard' },
				])
			).toThrow('resolve to the same URL pattern');
			expect(() =>
				normalizeRoutes([{ path: '/users/[id]' }, { path: '/users/[name]' }])
			).toThrow('resolve to the same URL pattern');
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

		it('should identify lazy route helper outputs without calling the loader', async () => {
			let loadCount = 0;
			const Page = () => 'marked lazy page';
			const lazyComponent = lazyRouteComponent(async () => {
				loadCount += 1;
				return { default: Page };
			});

			expect(isLazyRouteComponent(lazyComponent)).toBe(true);
			expect(lazyComponent[EFFUSE_LAZY_ROUTE]).toBe(true);
			expect(loadCount).toBe(0);

			await lazyComponent();

			expect(loadCount).toBe(1);
		});

		it('should not identify ordinary route functions as lazy routes', () => {
			const Page = () => 'plain page';

			expect(isLazyRouteComponent(Page)).toBe(false);
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
			const lazyComponent = lazyRoute(
				() => Promise.resolve({ missing: true }),
				{
					export: 'Page',
				}
			);

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

		it('should keep named navigation on the canonical path after sorting', () => {
			for (const alias of [
				'/people/:id',
				['/directory/people/:id', '/people/:id'],
			] as const) {
				const routes = normalizeRoutes([
					{
						path: '/users/:id',
						alias,
						name: 'user',
						component: () => 'user',
					},
				]);

				expect(
					resolveRoute({ name: 'user', params: { id: '42' } }, routes).path
				).toBe('/users/42');
			}
		});

		it('should expand nested children beneath every parent alias', () => {
			const parentComponent = () => 'users';
			const childComponent = () => 'details';
			const beforeEnter = () => true;
			const props = { source: 'route' };
			const routes = normalizeRoutes([
				{
					path: '/(account)/users/:id',
					alias: '/(public)/people/:id',
					name: 'user',
					component: parentComponent,
					meta: { area: 'account' },
					children: [
						{
							path: 'details',
							alias: 'profile',
							name: 'user-details',
							component: childComponent,
							beforeEnter,
							props,
							meta: { title: 'Details' },
						},
					],
				},
			]);

			for (const path of ['/people/42/details', '/people/42/profile']) {
				const resolved = resolveRoute(path, routes);
				expect(resolved.params).toEqual({ id: '42' });
				expect(resolved.meta).toEqual({
					area: 'account',
					title: 'Details',
				});
				expect(resolved.matched).toHaveLength(2);
				const [parent, child] = resolved.matched;
				expect(parent.aliasOf?.fullPath).toBe('/users/:id');
				expect(parent.component).toBe(parentComponent);
				expect(parent.canonicalRouteGroups).toEqual(['account']);
				expect(parent.aliasRouteGroups).toEqual(['public']);
				expect(parent.routeGroups).toEqual(['account', 'public']);
				expect(child.aliasOf?.fullPath).toBe('/users/:id/details');
				expect(child.component).toBe(childComponent);
				expect(child.beforeEnter).toBe(beforeEnter);
				expect(child.props).toBe(props);
				expect(child.canonicalRouteGroups).toEqual(['account']);
				expect(child.aliasRouteGroups).toEqual(['public']);
				expect(child.routeGroups).toEqual(['account', 'public']);
				expect(resolved.canonicalRouteGroups).toEqual(['account']);
				expect(resolved.aliasRouteGroups).toEqual(['public']);
				expect(resolved.routeGroups).toEqual(['account', 'public']);
			}

			const canonical = resolveRoute('/users/42/details', routes);
			expect(canonical.canonicalRouteGroups).toEqual(['account']);
			expect(canonical.aliasRouteGroups).toEqual([]);
			expect(canonical.routeGroups).toEqual(['account']);

			expect(
				resolveRoute(
					{ name: 'user-details', params: { id: '42' } },
					routes
				).path
			).toBe('/users/42/details');
		});

		it('should reject aliases that collide with canonical signatures', () => {
			const aliasRoute = {
				path: '/users/:id',
				alias: '/people/:id',
			};
			const canonicalRoute = { path: '/people/:name' };

			for (const routes of [
				[aliasRoute, canonicalRoute],
				[canonicalRoute, aliasRoute],
			]) {
				expect(() => normalizeRoutes(routes)).toThrow(
					'resolve to the same URL pattern'
				);
				expect(() => normalizeRoutes(routes)).toThrow('alias "/people/:id"');
			}
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
		const resolved = resolveRoute(
			{ name: 'user', params: { id: '42' } },
			routes
		);
		expect(resolved.path).toBe('/user/42');
		expect(resolved.name).toBe('user');
	});

	it('should resolve named location with bracket params', () => {
		const routes = normalizeRoutes([
			{ path: '/(content)/blog/[slug]', name: 'post', component: () => 'post' },
			{
				path: '/docs/[...slug]',
				name: 'docs',
				component: () => 'docs',
			},
		]);

		const post = resolveRoute(
			{ name: 'post', params: { slug: 'hello-effuse' } },
			routes
		);
		expect(post.path).toBe('/blog/hello-effuse');
		expect(post.params).toEqual({ slug: 'hello-effuse' });

		const docs = resolveRoute(
			{ name: 'docs', params: { slug: 'guide/routing' } },
			routes
		);
		expect(docs.path).toBe('/docs/guide/routing');
		expect(docs.params).toEqual({ slug: 'guide/routing' });
	});

	it('should encode named bracket params without flattening catch-alls', () => {
		const routes = normalizeRoutes([
			{ path: '/blog/[slug]', name: 'post' },
			{ path: '/docs/[...slug]', name: 'docs' },
			{ path: '/shop/[[...slug]]', name: 'shop' },
		]);

		expect(
			resolveRoute({ name: 'post', params: { slug: 'hello world' } }, routes)
				.path
		).toBe('/blog/hello%20world');
		expect(
			resolveRoute(
				{ name: 'docs', params: { slug: 'guides/routing rules' } },
				routes
			).path
		).toBe('/docs/guides/routing%20rules');
		expect(resolveRoute({ name: 'shop' }, routes).path).toBe('/shop');
	});

	it('should throw when named bracket params are missing', () => {
		const routes = normalizeRoutes([
			{ path: '/blog/[slug]', name: 'post', component: () => 'post' },
		]);

		expect(() => resolveRoute({ name: 'post' }, routes)).toThrow(
			'Missing route param "slug" for "/blog/[slug]".'
		);
	});

	it('should reject malformed, duplicate, and non-terminal route params', () => {
		expect(() => makeRoutes(['/blog/[]'])).toThrow(
			'Route params must have a name'
		);
		expect(() => makeRoutes(['/users/[id]/posts/[id]'])).toThrow(
			'Duplicate route param "id"'
		);
		expect(() => makeRoutes(['/docs/[...slug]/edit'])).toThrow(
			'must be the final URL segment'
		);
		for (const path of [
			'/docs/[[...slug]',
			'/docs/[...slug]]',
			'/docs/[[...slug]]]',
		]) {
			expect(() => makeRoutes([path])).toThrow('Invalid route segment');
		}
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

describe('ExtractRouteParams', () => {
	it('should infer colon and bracket route params', () => {
		expectTypeOf<
			ExtractRouteParams<'/(app)/users/:userId/posts/[slug]'>
		>().toEqualTypeOf<{
			userId: string;
			slug: string;
		}>();
	});

	it('should infer catch-all and optional catch-all route params', () => {
		expectTypeOf<ExtractRouteParams<'/docs/[...slug]'>>().toEqualTypeOf<{
			slug: string;
		}>();
		expectTypeOf<ExtractRouteParams<'/shop/[[...slug]]'>>().toEqualTypeOf<{
			slug?: string;
		}>();
		expectTypeOf<
			TypedRouteLocation<'shop', ExtractRouteParams<'/shop/[[...slug]]'>>
		>().toMatchTypeOf<{
			name: 'shop';
			params?: { slug?: string };
		}>();
	});

	it('should ignore route groups when no params are present', () => {
		expectTypeOf<ExtractRouteParams<'/(marketing)/about'>>().toEqualTypeOf<
			Record<string, never>
		>();
	});
});
