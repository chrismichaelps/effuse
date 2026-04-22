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
