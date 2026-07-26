import { describe, it, expect, beforeEach } from 'vitest';
import { useRoute } from '../utils/composables.js';
import { RouterNotInstalledError } from '../errors.js';
import { createRouter, installRouter } from '../core/router.js';
import { createMemoryHistory } from '../core/history.js';
import { clearContext } from '../core/context.js';
import { computed, define } from '@effuse/core';

describe('useRoute', () => {
	beforeEach(() => {
		clearContext();
	});

	it('should throw RouterNotInstalledError if router is not installed', () => {
		expect(() => useRoute()).toThrow(RouterNotInstalledError);
	});

	it('should return the current route if router is installed', () => {
		const router = createRouter({
			history: createMemoryHistory('/start'),
			routes: [
				{
					path: '/(app)/home',
					alias: '/(start)/start',
					component: define({
						script: () => ({}),
						template: () => 'Home',
					}),
					name: 'home',
				},
			],
		});

		installRouter(router);

		const route = useRoute();
		expect(route).toBeDefined();
		expect(route.path).toBe('/start');
		expect(route.name).toBe('home');
		expect(route.canonicalRouteGroups).toEqual(['app']);
		expect(route.aliasRouteGroups).toEqual(['start']);
		expect(route.routeGroups).toEqual(['app', 'start']);
		expect(Object.keys(route)).toContain('routeGroups');
	});

	it('keeps optional catch-all params reactive after navigation', async () => {
		const component = define({
			script: () => ({}),
			template: () => 'Route',
		});
		const router = createRouter({
			history: createMemoryHistory('/shop'),
			routes: [
				{
					path: '/(store)/shop/[[...slug]]',
					component,
					name: 'shop',
				},
			],
		});

		installRouter(router);

		const route = useRoute();
		const slug = computed(() => route.params.slug ?? '');
		expect(route.params.slug).toBe('');
		expect(slug.value).toBe('');

		await router.push('/shop/sale/today');

		expect(route.params.slug).toBe('sale/today');
		expect(slug.value).toBe('sale/today');
		expect(route.routeGroups).toEqual(['store']);
	});

	it('exposes optional catch-all params on the initial route', () => {
		const router = createRouter({
			history: createMemoryHistory('/shop/sale/today'),
			routes: [
				{
					path: '/(store)/shop/[[...slug]]',
					component: define({
						script: () => ({}),
						template: () => 'Route',
					}),
				},
			],
		});

		installRouter(router);

		const route = useRoute();
		expect(route.params.slug).toBe('sale/today');
		expect(route.routeGroups).toEqual(['store']);
	});
});
