/**
 * MIT License
 *
 * Copyright (c) 2025 Chris M. Perez
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useRouter, useRoute, onRouteChange } from '../utils/composables.js';
import { createRouter, installRouter } from '../core/router.js';
import { createMemoryHistory } from '../core/history.js';
import { clearContext } from '../core/context.js';
import { define } from '@effuse/core';

const dummyComponent = define({
	script: () => ({}),
	template: () => 'test',
});

describe('useRouter', () => {
	beforeEach(() => {
		clearContext();
	});

	it('should throw when router not installed', () => {
		expect(() => useRouter()).toThrow();
	});

	it('should return router when installed', () => {
		const router = createRouter({
			history: createMemoryHistory('/'),
			routes: [{ path: '/', component: dummyComponent }],
		});
		installRouter(router);
		expect(useRouter()).toBe(router);
	});
});

describe('useRoute', () => {
	beforeEach(() => {
		clearContext();
	});

	it('should throw when router not installed', () => {
		expect(() => useRoute()).toThrow();
	});

	it('should return current route', () => {
		const router = createRouter({
			history: createMemoryHistory('/'),
			routes: [{ path: '/', name: 'home', component: dummyComponent }],
		});
		installRouter(router);
		const route = useRoute();
		expect(route.path).toBe('/');
		expect(route.name).toBe('home');
	});

	it('should reflect route changes after navigation', () => {
		const router = createRouter({
			history: createMemoryHistory('/'),
			routes: [
				{ path: '/', component: dummyComponent },
				{ path: '/about', name: 'about', component: dummyComponent },
			],
		});
		installRouter(router);
		router.push('/about');
		const route = useRoute();
		expect(route.path).toBe('/about');
		expect(route.name).toBe('about');
	});
});

describe('onRouteChange', () => {
	beforeEach(() => {
		clearContext();
	});

	it('should call callback on route change', () => {
		const router = createRouter({
			history: createMemoryHistory('/'),
			routes: [
				{ path: '/', component: dummyComponent },
				{ path: '/about', component: dummyComponent },
			],
		});
		installRouter(router);
		const cb = vi.fn();
		const stop = onRouteChange(cb);
		router.push('/about');
		expect(cb).toHaveBeenCalled();
		stop();
	});

	it('should not call callback for same route', () => {
		const router = createRouter({
			history: createMemoryHistory('/'),
			routes: [{ path: '/', component: dummyComponent }],
		});
		installRouter(router);
		const cb = vi.fn();
		const stop = onRouteChange(cb);
		router.push('/'); // same path
		expect(cb).not.toHaveBeenCalled();
		stop();
	});
});
