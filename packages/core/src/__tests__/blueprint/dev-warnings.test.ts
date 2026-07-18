/**
 * MIT License
 *
 * Copyright (c) 2025 Chris M. Perez
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { instantiateBlueprint } from '../../blueprint/blueprint.js';
import { define } from '../../blueprint/define.js';
import { useCallback, useMemo } from '../../blueprint/hooks.js';
import { createReactiveProps } from '../../blueprint/reactive-props.js';
import { provide, inject, createProvideScope, runWithProvideScope } from '../../blueprint/provide-inject.js';
import { withActiveLifecycle, createComponentLifecycleSync } from '../../blueprint/lifecycle.js';

describe('dev warnings', () => {
	let warnSpy: ReturnType<typeof vi.spyOn>;

	beforeEach(() => {
		warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
	});

	afterEach(() => {
		warnSpy.mockRestore();
	});

	describe('missing prop key', () => {
		it('should warn when accessing a prop key that was not provided', () => {
			const { proxy } = createReactiveProps<{ name: string }>(
				{ name: 'Effuse' },
				{ warnOnMissing: true }
			);

			// @ts-expect-error — accessing missing prop
			void proxy.missingKey;

			if (process.env.NODE_ENV !== 'production') {
				expect(warnSpy).toHaveBeenCalledWith(
					expect.stringContaining('Accessed missing prop "missingKey"')
				);
			}
		});

		it('should not warn when accessing an existing prop key', () => {
			const { proxy } = createReactiveProps<{ name: string }>({ name: 'Effuse' });

			void proxy.name;

			expect(warnSpy).not.toHaveBeenCalled();
		});

		it('should not warn by default when optional prop keys are absent', () => {
			const { proxy } = createReactiveProps<{
				name: string;
				className?: string;
			}>({ name: 'Effuse' });

			void proxy.className;

			expect(warnSpy).not.toHaveBeenCalledWith(
				expect.stringContaining('Accessed missing prop')
			);
		});

		it('should not warn when templates read optional props', () => {
			const Component = define<{
				className?: string;
				children?: unknown;
			}>({
				script: () => ({}),
				template: (ctx) => {
					void ctx.className;
					void ctx.children;
					return null;
				},
			});
			const blueprint = Component as unknown as Parameters<typeof instantiateBlueprint>[0];
			const context = instantiateBlueprint(blueprint, {}, {});

			blueprint.view(context);

			expect(warnSpy).not.toHaveBeenCalledWith(
				expect.stringContaining('Accessed missing prop')
			);
		});
	});

	describe('hooks outside lifecycle', () => {
		it('should warn when useCallback is called outside a lifecycle', () => {
			useCallback(() => 42);

			if (process.env.NODE_ENV !== 'production') {
				expect(warnSpy).toHaveBeenCalledWith(
					expect.stringContaining('useCallback() called outside a component lifecycle')
				);
			}
		});

		it('should warn when useMemo is called outside a lifecycle', () => {
			useMemo(() => 42);

			if (process.env.NODE_ENV !== 'production') {
				expect(warnSpy).toHaveBeenCalledWith(
					expect.stringContaining('useMemo() called outside a component lifecycle')
				);
			}
		});

		it('should not warn when useCallback is called inside an active lifecycle', () => {
			const lifecycle = createComponentLifecycleSync();
			withActiveLifecycle(lifecycle, () => {
				useCallback(() => 42);
			});

			expect(warnSpy).not.toHaveBeenCalled();
		});

		it('should not warn when useMemo is called inside an active lifecycle', () => {
			const lifecycle = createComponentLifecycleSync();
			withActiveLifecycle(lifecycle, () => {
				useMemo(() => 42);
			});

			expect(warnSpy).not.toHaveBeenCalled();
		});
	});

	describe('inject without provider', () => {
		it('should warn when inject() returns undefined with no default and no scope', () => {
			inject('theme');

			if (process.env.NODE_ENV !== 'production') {
				expect(warnSpy).toHaveBeenCalledWith(
					expect.stringContaining('inject("theme") returned undefined')
				);
			}
		});

		it('should warn when inject() returns undefined with no default inside a scope', () => {
			const scope = createProvideScope();
			runWithProvideScope(scope, () => {
				inject('theme');
			});

			if (process.env.NODE_ENV !== 'production') {
				expect(warnSpy).toHaveBeenCalledWith(
					expect.stringContaining('inject("theme") returned undefined')
				);
			}
		});

		it('should not warn when inject() has a default value', () => {
			inject('theme', 'dark');

			expect(warnSpy).not.toHaveBeenCalled();
		});

		it('should not warn when inject() finds a provided value', () => {
			const scope = createProvideScope();
			runWithProvideScope(scope, () => {
				provide('theme', 'dark');
				inject('theme');
			});

			expect(warnSpy).not.toHaveBeenCalled();
		});
	});
});
