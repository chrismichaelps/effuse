import { describe, it, expect, beforeEach } from 'vitest';
import { useRoute } from '../utils/composables.js';
import { RouterNotInstalledError } from '../errors.js';
import { createRouter, installRouter } from '../core/router.js';
import { clearContext } from '../core/context.js';
import { define } from '@effuse/core';

describe('useRoute', () => {
	beforeEach(() => {
		clearContext();
	});

	it('should throw RouterNotInstalledError if router is not installed', () => {
		expect(() => useRoute()).toThrow(RouterNotInstalledError);
	});

	it('should return the current route if router is installed', () => {
		const router = createRouter({
			routes: [
				{
					path: '/',
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
		expect(route.path).toBe('/');
		expect(route.name).toBe('home');
	});
});
