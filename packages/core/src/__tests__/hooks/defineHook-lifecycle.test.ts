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

	it('owns a distinct abort signal for each hook invocation', () => {
		const signals: AbortSignal[] = [];
		const useSignal = defineHook({
			setup(ctx) {
				signals.push(ctx.abortSignal);
				return ctx.abortSignal;
			},
		});

		const first = useSignal();
		const second = useSignal();

		expect(first).not.toBe(second);
		expect(signals).toEqual([first, second]);
		expect(first.aborted).toBe(false);
		expect(second.aborted).toBe(false);
	});

	it('aborts before cleanup and preserves LIFO finalizers', async () => {
		const { ctx, dispose } = createHookContext(undefined, [], 'useAbortOrder');
		const order: string[] = [];
		let aborts = 0;
		ctx.abortSignal.addEventListener('abort', () => {
			aborts += 1;
			order.push('abort');
		});
		ctx.onCleanup(() => {
			expect(ctx.abortSignal.aborted).toBe(true);
			order.push('first');
		});
		ctx.onCleanup(() => {
			order.push('second');
		});

		const firstDisposal = dispose();
		expect(ctx.abortSignal.aborted).toBe(true);
		expect(dispose()).toBe(firstDisposal);
		await firstDisposal;

		expect(aborts).toBe(1);
		expect(order).toEqual(['abort', 'second', 'first']);
	});

	it('passes the owned signal to async work without awaiting it on disposal', async () => {
		const { ctx, dispose } = createHookContext(undefined, [], 'useAsyncWork');
		let received: AbortSignal | undefined;
		const pending = ctx.runAsync(
			(signal) =>
				new Promise<void>(() => {
					received = signal;
				})
		);

		expect(received).toBe(ctx.abortSignal);
		await expect(dispose()).resolves.toBeUndefined();
		expect(received?.aborted).toBe(true);
		void pending;
	});

	it('keeps zero-argument async callbacks source compatible', async () => {
		const { ctx, dispose } = createHookContext(undefined, [], 'useLegacyAsync');

		await expect(ctx.runAsync(async () => 'done')).resolves.toBe('done');
		await dispose();
		await expect(ctx.runAsync(async () => 'late')).rejects.toMatchObject({
			name: 'AbortError',
		});
	});

	it('aborts component-owned work on unmount', () => {
		const lifecycle = createComponentLifecycleSync();
		let ownedSignal: AbortSignal | undefined;
		const useAsyncHook = defineHook({
			setup(ctx) {
				ownedSignal = ctx.abortSignal;
				return undefined;
			},
		});

		withActiveLifecycle(lifecycle, () => useAsyncHook());
		expect(ownedSignal?.aborted).toBe(false);
		lifecycle.runCleanup();
		expect(ownedSignal?.aborted).toBe(true);
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
		let setupSignal: AbortSignal | undefined;
		const effect = vi.fn(() => {
			source.value;
		});
		const setupError = new Error('setup failed');
		const useFailingHook = defineHook({
			name: 'useFailingHook',
			setup(ctx) {
				setupSignal = ctx.abortSignal;
				ctx.watchEffect(effect);
				throw setupError;
			},
		});

		expect(() => useFailingHook()).toThrow(setupError);
		expect(setupSignal?.aborted).toBe(true);
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
