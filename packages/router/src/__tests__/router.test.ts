/**
 * MIT License
 *
 * Copyright (c) 2025 Chris M. Perez
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { Effect, SubscriptionRef } from 'effect';
import { createRouter, installRouter } from '../core/router.js';
import { createMemoryHistory } from '../core/history.js';
import { clearContext } from '../core/context.js';
import { NavigationResult } from '../navigation/guards.js';
import { define } from '@effuse/core';

const dummyComponent = define({
	script: () => ({}),
	template: () => 'test',
});

describe('createRouter lifecycle', () => {
	beforeEach(() => {
		clearContext();
	});

	const getCurrentPath = (router: ReturnType<typeof createRouter>) =>
		Effect.runSync(SubscriptionRef.get(router.currentRoute)).path;

	it('should sync route on start()', () => {
		const history = createMemoryHistory('/about');
		const router = createRouter({
			history,
			routes: [
				{ path: '/', component: dummyComponent },
				{ path: '/about', component: dummyComponent },
			],
		});
		// Before start, currentRoute reflects initial history path
		expect(getCurrentPath(router)).toBe('/about');
	});

	it('should update route when history changes after start()', () => {
		const history = createMemoryHistory('/');
		const router = createRouter({
			history,
			routes: [
				{ path: '/', component: dummyComponent },
				{ path: '/about', component: dummyComponent },
			],
		});
		router.start();
		history.push('/about');
		expect(getCurrentPath(router)).toBe('/about');
	});

	it('should remove listener on start() cleanup', () => {
		const history = createMemoryHistory('/');
		const router = createRouter({
			history,
			routes: [
				{ path: '/', component: dummyComponent },
				{ path: '/about', component: dummyComponent },
			],
		});
		const cleanup = router.start();
		cleanup();
		history.push('/about');
		// Route should not update after cleanup
		expect(getCurrentPath(router)).toBe('/');
	});

	it('should remove a named canonical route with its aliases and children', () => {
		const router = createRouter({
			history: createMemoryHistory('/'),
			routes: [
				{
					path: '/users/:id',
					alias: '/people/:id',
					name: 'user',
					component: dummyComponent,
					children: [
						{
							path: 'details',
							name: 'user-details',
							component: dummyComponent,
						},
					],
				},
				{ path: '/health', name: 'health', component: dummyComponent },
			],
		});

		router.removeRoute('user');

		expect(router.hasRoute('user')).toBe(false);
		expect(router.hasRoute('user-details')).toBe(false);
		expect(router.hasRoute('health')).toBe(true);
		expect(router.getRoutes().map((route) => route.fullPath)).toEqual([
			'/health',
		]);
		expect(router.routes.map((route) => route.fullPath)).toEqual(['/health']);
	});

	it('should validate aliases added after router creation', () => {
		const router = createRouter({
			history: createMemoryHistory('/'),
			routes: [{ path: '/people/:name', component: dummyComponent }],
		});

		expect(() =>
			router.addRoute({
				path: '/users/:id',
				alias: '/people/:id',
				name: 'user',
				component: dummyComponent,
			})
		).toThrow('resolve to the same URL pattern');
	});

	it('should add child routes beneath canonical and aliased parents', () => {
		const router = createRouter({
			history: createMemoryHistory('/'),
			routes: [
				{
					path: '/users/:id',
					alias: '/people/:id',
					name: 'user',
					component: dummyComponent,
				},
			],
		});

		router.addRoute(
			{
				path: 'settings',
				name: 'user-settings',
				component: dummyComponent,
			},
			'user'
		);

		expect(router.resolve('/users/42/settings').name).toBe('user-settings');
		expect(router.resolve('/people/42/settings').name).toBe('user-settings');
		expect(
			router.resolve({
				name: 'user-settings',
				params: { id: '42' },
			}).path
		).toBe('/users/42/settings');
	});

	it('should run each matched guard once through a nested alias', () => {
		const guardCalls: string[] = [];
		const router = createRouter({
			history: createMemoryHistory('/'),
			routes: [
				{
					path: '/users/:id',
					alias: '/people/:id',
					component: dummyComponent,
					beforeEnter: (() => {
						guardCalls.push('parent');
						return NavigationResult.allowed();
					}) as never,
					children: [
						{
							path: 'details',
							component: dummyComponent,
							beforeEnter: (() => {
								guardCalls.push('child');
								return NavigationResult.allowed();
							}) as never,
						},
					],
				},
			],
		});

		router.push('/people/42/details');

		expect(guardCalls).toEqual(['parent', 'child']);
	});
});

describe('installRouter', () => {
	beforeEach(() => {
		clearContext();
	});

	it('should return cleanup from installRouter', () => {
		const installed = createRouter({
			history: createMemoryHistory('/'),
			routes: [{ path: '/', component: dummyComponent }],
		});
		const result = installRouter(installed);
		expect(typeof result.cleanup).toBe('function');
		result.cleanup();
	});
});
