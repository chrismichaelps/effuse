import { describe, expect, it, vi } from 'vitest';
import {
	createComponentLifecycleSync,
	installLifecycleErrorHandler,
	withActiveLifecycle,
} from '../../blueprint/lifecycle.js';
import { createHookContext } from '../../hooks/context.js';
import { defineHook } from '../../hooks/defineHook.js';
import { signal } from '../../reactivity/signal.js';

describe('defineHook lifecycle ownership', () => {
	it('runs effect cleanup before reruns and stops the effect on disposal', async () => {
		const source = signal(0);
		const cleanup = vi.fn();
		const executions: number[] = [];
		const { ctx, dispose } = createHookContext(undefined, [], 'useOwnedEffect');

		const handle = ctx.watchEffect(() => {
			executions.push(source.value);
			return cleanup;
		});

		expect(handle.stop).toBeTypeOf('function');
		source.value = 1;
		expect(executions).toEqual([0, 1]);
		expect(cleanup).toHaveBeenCalledTimes(1);

		await dispose();
		expect(cleanup).toHaveBeenCalledTimes(2);
		source.value = 2;
		expect(executions).toEqual([0, 1]);
	});

	it('disposes component-owned effects synchronously on unmount', () => {
		const lifecycle = createComponentLifecycleSync();
		const source = signal(0);
		const cleanup = vi.fn();
		const effect = vi.fn(() => {
			source.value;
			return cleanup;
		});
		const useOwnedEffect = defineHook({
			name: 'useOwnedEffect',
			setup(ctx) {
				ctx.watchEffect(effect);
				return {};
			},
		});

		withActiveLifecycle(lifecycle, () => useOwnedEffect());
		lifecycle.runCleanup();

		expect(cleanup).toHaveBeenCalledOnce();
		source.value = 1;
		expect(effect).toHaveBeenCalledOnce();
	});

	it('runs standalone onMount work immediately under manual scope ownership', async () => {
		const mounted = vi.fn();
		const cleanup = vi.fn();
		const { ctx, dispose } = createHookContext(undefined, [], 'useStandalone');

		ctx.onMount(() => {
			mounted();
			return cleanup;
		});

		expect(mounted).toHaveBeenCalledOnce();
		await dispose();
		expect(cleanup).toHaveBeenCalledOnce();
	});

	it('disposes finalizers once in LIFO order and aggregates failures', async () => {
		const { ctx } = createHookContext(undefined, [], 'useFinalizers');
		const order: string[] = [];
		const firstFailure = new Error('first');
		const secondFailure = new Error('second');

		ctx.scope.addFinalizer(() => {
			order.push('first');
			throw firstFailure;
		});
		ctx.scope.addFinalizer(async () => {
			order.push('second');
			throw secondFailure;
		});
		ctx.scope.addFinalizer(() => {
			order.push('third');
		});

		const firstDisposal = ctx.scope.dispose();
		expect(ctx.scope.dispose()).toBe(firstDisposal);
		await expect(firstDisposal).rejects.toMatchObject({
			errors: [secondFailure, firstFailure],
		});
		expect(order).toEqual(['third', 'second', 'first']);
		expect(() => ctx.scope.addFinalizer(() => undefined)).toThrow(
			'Cannot add a hook finalizer after disposal has started'
		);
	});

	it('stops effects when setup fails and preserves the setup error', () => {
		const source = signal(0);
		const effect = vi.fn(() => {
			source.value;
		});
		const setupError = new Error('setup failed');
		const useFailingHook = defineHook({
			name: 'useFailingHook',
			setup(ctx) {
				ctx.watchEffect(effect);
				throw setupError;
			},
		});

		expect(() => useFailingHook()).toThrow(setupError);
		source.value = 1;
		expect(effect).toHaveBeenCalledOnce();
	});

	it('reports asynchronous unmount disposal failures through lifecycle errors', async () => {
		const lifecycle = createComponentLifecycleSync();
		const failure = new Error('async cleanup failed');
		const reported = vi.fn();
		const uninstall = installLifecycleErrorHandler(reported);
		const useFailingCleanup = defineHook({
			name: 'useFailingCleanup',
			setup(ctx) {
				ctx.scope.addFinalizer(async () => {
					throw failure;
				});
				return {};
			},
		});

		try {
			withActiveLifecycle(lifecycle, () => useFailingCleanup());
			lifecycle.runCleanup();
			await vi.waitFor(() => expect(reported).toHaveBeenCalledOnce());
			expect(reported.mock.calls[0]?.[0]).toMatchObject({
				name: 'LifecycleError',
				phase: 'cleanup',
			});
		} finally {
			uninstall();
		}
	});
});
