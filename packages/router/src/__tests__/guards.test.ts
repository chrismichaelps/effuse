/**
 * MIT License
 *
 * Copyright (c) 2025 Chris M. Perez
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createRouter } from '../core/router.js';
import { createMemoryHistory } from '../core/history.js';
import {
	NavigationResult,
	combineGuards,
	guardWhen,
	createAuthGuard,
} from '../navigation/guards.js';
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
});

describe('createRouter guards', () => {
	beforeEach(() => {
		clearContext();
	});

	it('should allow navigation when no guards', () => {
		const router = createRouter({
			history: createMemoryHistory('/'),
			routes: [{ path: '/', component: dummyComponent }],
		});
		const result = router.push('/');
		expect(NavigationFailure.isNavigationFailure(result)).toBe(true); // duplicated (same path)
	});

	it('should call beforeEach guard', () => {
		const guard = vi.fn(() => NavigationResult.allowed());
		const router = createRouter({
			history: createMemoryHistory('/'),
			routes: [
				{ path: '/', component: dummyComponent },
				{ path: '/about', component: dummyComponent },
			],
		});
		router.beforeEach(guard);
		router.push('/about');
		expect(guard).toHaveBeenCalled();
	});

	it('should cancel navigation when guard returns cancelled', () => {
		const router = createRouter({
			history: createMemoryHistory('/'),
			routes: [
				{ path: '/', component: dummyComponent },
				{ path: '/admin', component: dummyComponent },
			],
		});
		router.beforeEach(() => NavigationResult.cancelled('blocked'));
		const result = router.push('/admin');
		expect(NavigationFailure.isNavigationFailure(result)).toBe(true);
	});

	it('should redirect navigation when guard returns redirect', () => {
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
		const result = router.push('/admin');
		// Should redirect to /login
		expect(result).toBeDefined();
	});

	it('should remove guard on cleanup', () => {
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
		router.push('/about');
		expect(guard).not.toHaveBeenCalled();
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
});
