/**
 * MIT License
 *
 * Copyright (c) 2025 Chris M. Perez
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Effect, SubscriptionRef } from 'effect';
import { createRouter } from '../core/router.js';
import { createMemoryHistory } from '../core/history.js';
import {
	NavigationResult,
	combineGuards,
	guardWhen,
	createAuthGuard,
	createUnsavedChangesGuard,
} from '../navigation/guards.js';
import type { NavigationGuard } from '../navigation/guards.js';
import {
	NavigationFailure,
} from '../navigation/errors.js';
import { clearContext } from '../core/context.js';
import { define } from '@effuse/core';

const dummyComponent = define({
	script: () => ({}),
	template: () => 'test',
});

describe('NavigationResult', () => {
	it('should create allowed result', () => {
		const result = NavigationResult.allowed();
		expect(NavigationResult.isAllowed(result)).toBe(true);
	});

	it('should create cancelled result', () => {
		const result = NavigationResult.cancelled('nope');
		expect(NavigationResult.isCancelled(result)).toBe(true);
	});

	it('should create redirected result', () => {
		const result = NavigationResult.redirected('/login');
		expect(NavigationResult.isRedirected(result)).toBe(true);
	});

	it('should create failed result', () => {
		const result = NavigationResult.failed(new Error('oops'));
		expect(NavigationResult.isFailed(result)).toBe(true);
	});

	it('should preserve tagged results during legacy normalization', () => {
		const result = NavigationResult.cancelled('tagged');
		expect(NavigationResult.fromLegacy(result)).toBe(result);
	});
});

describe('createRouter guards', () => {
	beforeEach(() => {
		clearContext();
	});

	it('should allow navigation when no guards', async () => {
		const router = createRouter({
			history: createMemoryHistory('/'),
			routes: [{ path: '/', component: dummyComponent }],
		});
		const result = await router.push('/');
		expect(NavigationFailure.isNavigationFailure(result)).toBe(true); // duplicated (same path)
	});

	it('should call beforeEach guard', async () => {
		const guard = vi.fn(() => NavigationResult.allowed());
		const router = createRouter({
			history: createMemoryHistory('/'),
			routes: [
				{ path: '/', component: dummyComponent },
				{ path: '/about', component: dummyComponent },
			],
		});
		router.beforeEach(guard);
		await router.push('/about');
		expect(guard).toHaveBeenCalled();
	});

	it('should cancel navigation when guard returns cancelled', async () => {
		const router = createRouter({
			history: createMemoryHistory('/'),
			routes: [
				{ path: '/', component: dummyComponent },
				{ path: '/admin', component: dummyComponent },
			],
		});
		router.beforeEach(() => NavigationResult.cancelled('blocked'));
		const result = await router.push('/admin');
		expect(NavigationFailure.isNavigationFailure(result)).toBe(true);
	});

	it('should redirect navigation when guard returns redirect', async () => {
		const router = createRouter({
			history: createMemoryHistory('/'),
			routes: [
				{ path: '/', component: dummyComponent },
				{ path: '/login', component: dummyComponent },
				{ path: '/admin', component: dummyComponent },
			],
		});
		router.beforeEach((to) => {
			if (to.path === '/admin') {
				return NavigationResult.redirected('/login');
			}
			return NavigationResult.allowed();
		});
		const result = await router.push('/admin');
		// Should redirect to /login
		expect(result).toBeDefined();
	});

	it('should remove guard on cleanup', async () => {
		const guard = vi.fn(() => NavigationResult.allowed());
		const router = createRouter({
			history: createMemoryHistory('/'),
			routes: [
				{ path: '/', component: dummyComponent },
				{ path: '/about', component: dummyComponent },
			],
		});
		const cleanup = router.beforeEach(guard);
		cleanup();
		await router.push('/about');
		expect(guard).not.toHaveBeenCalled();
	});

	it('should call beforeEnter guard on matched route', async () => {
		const beforeEnter = vi.fn(() => NavigationResult.allowed());
		const router = createRouter({
			history: createMemoryHistory('/'),
			routes: [
				{ path: '/', component: dummyComponent },
				{ path: '/admin', component: dummyComponent, beforeEnter },
			],
		});
		await router.push('/admin');
		expect(beforeEnter).toHaveBeenCalled();
	});

	it('should cancel navigation when beforeEnter returns cancelled', async () => {
		const router = createRouter({
			history: createMemoryHistory('/'),
			routes: [
				{ path: '/', component: dummyComponent },
				{
					path: '/admin',
					component: dummyComponent,
					beforeEnter: () => NavigationResult.cancelled('no access'),
				},
			],
		});
		const result = await router.push('/admin');
		expect(NavigationFailure.isNavigationFailure(result)).toBe(true);
	});

	it('should redirect when beforeEnter returns redirect', async () => {
		const router = createRouter({
			history: createMemoryHistory('/'),
			routes: [
				{ path: '/', component: dummyComponent },
				{ path: '/login', component: dummyComponent },
				{
					path: '/admin',
					component: dummyComponent,
					beforeEnter: (to) =>
						to.path === '/admin'
							? NavigationResult.redirected('/login')
							: NavigationResult.allowed(),
				},
			],
		});
		const result = await router.push('/admin');
		expect(NavigationFailure.isNavigationFailure(result)).toBe(false);
		expect((result as { path: string }).path).toBe('/login');
	});

	it('should run beforeEnter after beforeEach and before beforeResolve', async () => {
		const order: string[] = [];
		const router = createRouter({
			history: createMemoryHistory('/'),
			routes: [
				{ path: '/', component: dummyComponent },
				{
					path: '/admin',
					component: dummyComponent,
					beforeEnter: () => {
						order.push('beforeEnter');
						return NavigationResult.allowed();
					},
				},
			],
		});
		router.beforeEach(() => {
			order.push('beforeEach');
			return NavigationResult.allowed();
		});
		router.beforeResolve(() => {
			order.push('beforeResolve');
			return NavigationResult.allowed();
		});
		await router.push('/admin');
		expect(order).toEqual(['beforeEach', 'beforeEnter', 'beforeResolve']);
	});

	it('should normalize mixed Promise and Effect guards in order', async () => {
		const order: string[] = [];
		const router = createRouter({
			history: createMemoryHistory('/'),
			routes: [
				{ path: '/', component: dummyComponent },
				{
					path: '/reports',
					component: dummyComponent,
					beforeEnter: () =>
						Effect.sync(() => {
							order.push('effect');
							return undefined;
						}),
				},
			],
		});
		router.beforeEach(async () => {
			await Promise.resolve();
			order.push('promise');
			return true;
		});
		router.beforeResolve(() => {
			order.push('tagged');
			return NavigationResult.allowed();
		});

		const result = await router.push('/reports');

		expect(NavigationFailure.isNavigationFailure(result)).toBe(false);
		expect(order).toEqual(['promise', 'effect', 'tagged']);
	});

	it('should normalize legacy cancellation and redirect values', async () => {
		const cancelledRouter = createRouter({
			history: createMemoryHistory('/'),
			routes: [
				{ path: '/', component: dummyComponent },
				{ path: '/blocked', component: dummyComponent },
			],
		});
		cancelledRouter.beforeEach(() => false);
		const cancelled = await cancelledRouter.push('/blocked');
		expect(NavigationFailure.isCancelled(cancelled)).toBe(true);

		const redirectRouter = createRouter({
			history: createMemoryHistory('/'),
			routes: [
				{ path: '/', component: dummyComponent },
				{ path: '/private', component: dummyComponent },
				{ path: '/login', component: dummyComponent },
			],
		});
		redirectRouter.beforeEach((to) =>
			to.path === '/private' ? '/login' : true
		);
		const redirected = await redirectRouter.push('/private');
		expect(NavigationFailure.isNavigationFailure(redirected)).toBe(false);
		expect(redirected.path).toBe('/login');
	});

	it('should preserve returned and raised guard errors as typed failures', async () => {
		const error = new Error('guard failed');
		const failingGuards = [
			() => error,
			() => {
				throw error;
			},
			async () => Promise.reject(error),
			() => Effect.fail(error),
		] satisfies NavigationGuard[];

		for (const guard of failingGuards) {
			const router = createRouter({
				history: createMemoryHistory('/'),
				routes: [
					{ path: '/', component: dummyComponent },
					{ path: '/secure', component: dummyComponent },
				],
			});
			router.beforeEach(guard);

			const result = await router.push('/secure');

			expect(NavigationFailure.isFailed(result)).toBe(true);
			if (NavigationFailure.isFailed(result)) {
				expect(result.error).toBe(error);
			}
		}
	});

	it('should stop guard redirect loops with a typed path chain', async () => {
		const router = createRouter({
			history: createMemoryHistory('/'),
			routes: [
				{ path: '/', component: dummyComponent },
				{ path: '/private', component: dummyComponent },
				{ path: '/login', component: dummyComponent },
			],
		});
		router.beforeEach(() => '/login');

		const result = await router.push('/private');

		expect(NavigationFailure.isRedirectLoop(result)).toBe(true);
		if (NavigationFailure.isRedirectLoop(result)) {
				expect(result.paths).toEqual(['/private', '/login', '/login']);
		}
	});

	it('should abort stale async navigation without overwriting the winner', async () => {
		let releaseSlow: (() => void) | undefined;
		let markSlowStarted: (() => void) | undefined;
		const slowGate = new Promise<void>((resolve) => {
			releaseSlow = resolve;
		});
		const slowStarted = new Promise<void>((resolve) => {
			markSlowStarted = resolve;
		});
		const router = createRouter({
			history: createMemoryHistory('/'),
			routes: [
				{ path: '/', component: dummyComponent },
				{ path: '/slow', component: dummyComponent },
				{ path: '/fast', component: dummyComponent },
			],
		});
		router.beforeEach(async (to) => {
			if (to.path === '/slow') {
				markSlowStarted?.();
				await slowGate;
			}
			return true;
		});

		const slowNavigation = router.push('/slow');
		await slowStarted;
		const fastResult = await router.push('/fast');
		releaseSlow?.();
		const slowResult = await slowNavigation;

		expect(NavigationFailure.isNavigationFailure(fastResult)).toBe(false);
		expect(NavigationFailure.isAborted(slowResult)).toBe(true);
		expect(
			Effect.runSync(SubscriptionRef.get(router.currentRoute)).path
		).toBe('/fast');
	});
});

describe('guard utilities', () => {
	it('combineGuards should stop on first rejection', async () => {
		const combined = combineGuards(
			() => NavigationResult.allowed(),
			() => NavigationResult.cancelled('stop')
		);
		const result = await combined({} as any, {} as any);
		expect(NavigationResult.isCancelled(result)).toBe(true);
	});

	it('combineGuards should normalize legacy values', async () => {
		const finalGuard = vi.fn(() => true);
		const combined = combineGuards(
			() => undefined,
			() => Effect.succeed(true),
			finalGuard
		);

		const result = await combined({} as any, {} as any);

		expect(NavigationResult.isAllowed(result)).toBe(true);
		expect(finalGuard).toHaveBeenCalledOnce();
	});

	it('guardWhen should conditionally run guard', async () => {
		const guard = vi.fn(() => NavigationResult.cancelled());
		const conditional = guardWhen(() => true, guard);
		await conditional({} as any, {} as any);
		expect(guard).toHaveBeenCalled();

		const skip = guardWhen(() => false, guard);
		const result = await skip({} as any, {} as any);
		expect(NavigationResult.isAllowed(result)).toBe(true);
	});

	it('createAuthGuard should redirect when not authenticated', async () => {
		const authGuard = createAuthGuard(() => false, '/login');
		const result = await authGuard(
			{ meta: { requiresAuth: true } } as any,
			{} as any
		);
		expect(NavigationResult.isRedirected(result)).toBe(true);
	});

	it('createAuthGuard should allow when authenticated', async () => {
		const authGuard = createAuthGuard(() => true, '/login');
		const result = await authGuard(
			{ meta: { requiresAuth: true } } as any,
			{} as any
		);
		expect(NavigationResult.isAllowed(result)).toBe(true);
	});

	it('createUnsavedChangesGuard should remain SSR-safe', async () => {
		const guard = createUnsavedChangesGuard(() => true);
		const result = await guard({} as any, {} as any);

		expect(NavigationResult.isAllowed(result)).toBe(true);
	});

	it('createUnsavedChangesGuard should support an injected confirmation', async () => {
		const confirmLeave = vi.fn(() => false);
		const guard = createUnsavedChangesGuard(
			() => true,
			'Leave this form?',
			confirmLeave
		);
		const result = await guard({} as any, {} as any);

		expect(confirmLeave).toHaveBeenCalledWith('Leave this form?');
		expect(NavigationResult.isCancelled(result)).toBe(true);
	});
});
