import { afterEach, describe, expect, it, vi } from 'vitest';
import { define, type ComponentLifecycle } from '@effuse/core';
import { CancellationError } from '../errors/index.js';
import { useMutation } from './useMutation.js';

const setupComponentHook = <T>(setup: () => T) => {
	let hook: T | undefined;
	const Owner = define({
		script: () => {
			hook = setup();
			return {};
		},
		template: () => null,
	});
	const state = Owner.state?.({}) as
		| { readonly lifecycle: ComponentLifecycle }
		| undefined;
	if (!hook || !state) throw new Error('Hook owner setup failed');
	return { hook, lifecycle: state.lifecycle };
};

const outcomeWithin = async <T>(promise: Promise<T>) =>
	Promise.race([
		promise.then(
			(value) => ({ status: 'resolved' as const, value }),
			(error: unknown) => ({ status: 'rejected' as const, error })
		),
		new Promise<{ status: 'pending' }>((resolve) => {
			setTimeout(() => resolve({ status: 'pending' }), 10);
		}),
	]);

describe('mutation hook lifecycle ownership', () => {
	afterEach(() => {
		vi.unstubAllGlobals();
		vi.restoreAllMocks();
	});

	it('settles pending work as cancelled during component cleanup', async () => {
		let resolveMutation: ((value: string) => void) | undefined;
		const onSuccess = vi.fn();
		const onError = vi.fn();
		const onSettled = vi.fn();
		const { hook, lifecycle } = setupComponentHook(() =>
			useMutation<string, string>({
				mutationFn: () =>
					new Promise<string>((resolve) => {
						resolveMutation = resolve;
					}),
				onSuccess,
				onError,
				onSettled,
			})
		);
		const pending = hook.mutateAsync('save');
		await Promise.resolve();

		lifecycle.runCleanup();
		const outcome = await outcomeWithin(pending);
		expect(outcome.status).toBe('rejected');
		if (outcome.status === 'rejected') {
			expect(outcome.error).toBeInstanceOf(CancellationError);
		}
		const statusAfterCleanup = hook.status.value;
		resolveMutation?.('late');
		await Promise.resolve();
		await Promise.resolve();
		expect(hook.status.value).toBe(statusAfterCleanup);
		expect(hook.data.value).toBeUndefined();
		expect(onSuccess).not.toHaveBeenCalled();
		expect(onError).not.toHaveBeenCalled();
		expect(onSettled).not.toHaveBeenCalled();
	});

	it('cancels an overlapping mutation and keeps the latest result', async () => {
		const resolvers = new Map<string, (value: string) => void>();
		const result = useMutation<string, string>({
			mutationFn: (value) =>
				new Promise<string>((resolve) => {
					resolvers.set(value, resolve);
				}),
		});

		const first = result.mutateAsync('first');
		await Promise.resolve();
		const second = result.mutateAsync('second');
		await Promise.resolve();
		const firstOutcome = await outcomeWithin(first);
		expect(firstOutcome.status).toBe('rejected');
		if (firstOutcome.status === 'rejected') {
			expect(firstOutcome.error).toBeInstanceOf(CancellationError);
		}

		resolvers.get('second')?.('second-result');
		await expect(second).resolves.toBe('second-result');
		resolvers.get('first')?.('late-first-result');
		await Promise.resolve();
		expect(result.data.value).toBe('second-result');
		result.dispose();
	});

	it('cancels while async onMutate is pending without starting mutation work', async () => {
		let resolveContext: ((value: { snapshot: string }) => void) | undefined;
		const mutationFn = vi.fn(async () => 'saved');
		const { hook, lifecycle } = setupComponentHook(() =>
			useMutation<string, string, { snapshot: string }>({
				mutationFn,
				onMutate: () =>
					new Promise((resolve) => {
						resolveContext = resolve;
					}),
			})
		);
		const pending = hook.mutateAsync('save');
		lifecycle.runCleanup();
		resolveContext?.({ snapshot: 'before' });

		const outcome = await outcomeWithin(pending);
		expect(outcome.status).toBe('rejected');
		if (outcome.status === 'rejected') {
			expect(outcome.error).toBeInstanceOf(CancellationError);
		}
		expect(mutationFn).not.toHaveBeenCalled();
	});

	it('exposes idempotent standalone disposal and rejects later mutations', async () => {
		const result = useMutation<string, void>({
			mutationFn: async () => 'saved',
		});

		result.dispose();
		result.dispose();
		await expect(result.mutateAsync()).rejects.toBeInstanceOf(
			CancellationError
		);
	});

	it('settles active work before resetting state', async () => {
		let resolveMutation: ((value: string) => void) | undefined;
		const result = useMutation<string, void>({
			mutationFn: () =>
				new Promise((resolve) => {
					resolveMutation = resolve;
				}),
		});
		const pending = result.mutateAsync();
		await Promise.resolve();

		result.reset();
		await expect(pending).rejects.toBeInstanceOf(CancellationError);
		expect(result.status.value).toBe('idle');
		resolveMutation?.('late');
		await Promise.resolve();
		expect(result.status.value).toBe('idle');
		expect(result.data.value).toBeUndefined();
		result.dispose();
	});
});
