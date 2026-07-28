/**
 * MIT License
 *
 * Copyright (c) 2025 Chris M. Perez
 */

import { describe, it, expect, vi } from 'vitest';
import {
	createWebHistory,
	createHashHistory,
	createMemoryHistory,
} from '../core/history.js';
import { createMemoryHistory as createPublicMemoryHistory } from '../index.js';

describe('createMemoryHistory', () => {
	it('should be available from the package entry point for SSR routers', () => {
		const history = createPublicMemoryHistory('/server-rendered');
		expect(history.getCurrentPath()).toBe('/server-rendered');
	});

	it('should return initial path', () => {
		const history = createMemoryHistory('/start');
		expect(history.getCurrentPath()).toBe('/start');
	});

	it('should push new path', () => {
		const history = createMemoryHistory('/');
		history.push('/about');
		expect(history.getCurrentPath()).toBe('/about');
	});

	it('should replace path', () => {
		const history = createMemoryHistory('/');
		history.replace('/contact');
		expect(history.getCurrentPath()).toBe('/contact');
	});

	it('should notify listeners on push', () => {
		const history = createMemoryHistory('/');
		const listener = vi.fn();
		history.listen(listener);
		history.push('/about');
		expect(listener).toHaveBeenCalledTimes(1);
	});

	it('should remove listener on cleanup', () => {
		const history = createMemoryHistory('/');
		const listener = vi.fn();
		const cleanup = history.listen(listener);
		cleanup();
		history.push('/about');
		expect(listener).not.toHaveBeenCalled();
	});
});

describe('createWebHistory (browser environment)', () => {
	it('should return / in non-browser', () => {
		const history = createWebHistory();
		expect(history.getCurrentPath()).toBe('/');
	});

	it('should be no-op in non-browser', () => {
		const history = createWebHistory();
		expect(() => history.push('/about')).not.toThrow();
		expect(() => history.replace('/about')).not.toThrow();
		expect(() => history.back()).not.toThrow();
		expect(() => history.forward()).not.toThrow();
		expect(() => history.go(1)).not.toThrow();
	});

	it('should return empty cleanup in non-browser', () => {
		const history = createWebHistory();
		const cleanup = history.listen(() => {});
		expect(typeof cleanup).toBe('function');
		expect(() => cleanup()).not.toThrow();
	});
});

describe('createHashHistory (browser environment)', () => {
	it('should return / in non-browser', () => {
		const history = createHashHistory();
		expect(history.getCurrentPath()).toBe('/');
	});

	it('should be no-op in non-browser', () => {
		const history = createHashHistory();
		expect(() => history.push('/about')).not.toThrow();
		expect(() => history.replace('/about')).not.toThrow();
	});
});
