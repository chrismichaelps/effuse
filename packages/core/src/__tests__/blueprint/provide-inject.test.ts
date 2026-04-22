/**
 * MIT License
 *
 * Copyright (c) 2025 Chris M. Perez
 */

import { describe, it, expect, vi } from 'vitest';
import {
	provide,
	inject,
	createProvideScope,
	runWithProvideScope,
	getCurrentProvideScope,
} from '../../blueprint/provide-inject.js';

describe('provide / inject', () => {
	it('should provide and inject a value in the same scope', () => {
		const scope = createProvideScope();

		const result = runWithProvideScope(scope, () => {
			provide('theme', 'dark');
			return inject('theme');
		});

		expect(result).toBe('dark');
	});

	it('should return default value when key not found', () => {
		const scope = createProvideScope();

		const result = runWithProvideScope(scope, () => {
			return inject('missing', 'default');
		});

		expect(result).toBe('default');
	});

	it('should walk up parent scopes to find value', () => {
		const parent = createProvideScope();
		const child = createProvideScope(parent);

		runWithProvideScope(parent, () => {
			provide('user', { name: 'Chris' });
		});

		const result = runWithProvideScope(child, () => {
			return inject('user');
		});

		expect(result).toEqual({ name: 'Chris' });
	});

	it('should prefer child scope over parent scope', () => {
		const parent = createProvideScope();
		const child = createProvideScope(parent);

		runWithProvideScope(parent, () => {
			provide('theme', 'light');
		});

		const result = runWithProvideScope(child, () => {
			provide('theme', 'dark');
			return inject('theme');
		});

		expect(result).toBe('dark');
	});

	it('should support symbol keys', () => {
		const KEY = Symbol('secret');
		const scope = createProvideScope();

		const result = runWithProvideScope(scope, () => {
			provide(KEY, 42);
			return inject(KEY);
		});

		expect(result).toBe(42);
	});

	it('should return null when no scope is active', () => {
		expect(getCurrentProvideScope()).toBeNull();
	});

	it('should warn when provide() called outside a scope in dev', () => {
		const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

		provide('key', 'value');

		if (process.env.NODE_ENV !== 'production') {
			expect(warnSpy).toHaveBeenCalledWith(
				expect.stringContaining('provide() called outside a component scope')
			);
		}

		warnSpy.mockRestore();
	});
});
