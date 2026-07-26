// @vitest-environment jsdom

import { afterEach, describe, expect, expectTypeOf, it, vi } from 'vitest';
import {
	createApp,
	CreateElementNode,
	define,
	EFFUSE_NODE,
} from '@effuse/core';
import { useAsyncTask, type UseAsyncTaskReturn } from './index.js';

const deferred = <T>() => {
	let resolve!: (value: T) => void;
	let reject!: (reason?: unknown) => void;
	const promise = new Promise<T>((resolvePromise, rejectPromise) => {
		resolve = resolvePromise;
		reject = rejectPromise;
	});
	return { promise, resolve, reject };
};

afterEach(() => {
	document.body.innerHTML = '';
	vi.restoreAllMocks();
});

describe('useAsyncTask', () => {
	it('infers argument tuples and result data', async () => {
		const task = useAsyncTask({
			task: async (_signal, id: number, active: boolean) => ({ id, active }),
		});

		expectTypeOf(task.execute).toEqualTypeOf<
			(id: number, active: boolean) => Promise<
				{ id: number; active: boolean } | undefined
			>
		>();
		expectTypeOf(task.data.value).toEqualTypeOf<
			{ id: number; active: boolean } | undefined
		>();
		await expect(task.execute(42, true)).resolves.toEqual({ id: 42, active: true });
	});

	it('starts idle and publishes a successful result', async () => {
		const task = useAsyncTask({
			initialData: 'initial',
			task: async () => 'saved',
		});

		expect(task.status.value).toBe('idle');
		expect(task.data.value).toBe('initial');
		expect(task.error.value).toBeNull();
		const pending = task.execute();
		expect(task.status.value).toBe('pending');
		expect(task.isPending.value).toBe(true);

		await expect(pending).resolves.toBe('saved');
		expect(task.status.value).toBe('success');
		expect(task.data.value).toBe('saved');
		expect(task.isSuccess.value).toBe(true);
	});

	it('records unexpected failures and rejects the caller', async () => {
		const failure = new Error('save failed');
		const task = useAsyncTask({
			task: async () => {
				throw failure;
			},
		});

		await expect(task.execute()).rejects.toBe(failure);
		expect(task.status.value).toBe('error');
		expect(task.error.value).toBe(failure);
		expect(task.isError.value).toBe(true);
	});

	it('does not swallow an unrelated AbortError', async () => {
		const failure = new DOMException('remote aborted', 'AbortError');
		const task = useAsyncTask({
			task: async (signal) => {
				expect(signal.aborted).toBe(false);
				throw failure;
			},
		});

		await expect(task.execute()).rejects.toBe(failure);
		expect(task.status.value).toBe('error');
		expect(task.error.value).toBe(failure);
	});

	it('cancels promptly even when the task ignores its signal', async () => {
		let ownedSignal: AbortSignal | undefined;
		const task = useAsyncTask({
			task: (signal) => {
				ownedSignal = signal;
				return new Promise<string>(() => undefined);
			},
		});

		const execution = task.execute();
		await Promise.resolve();
		task.cancel('user cancelled');

		await expect(execution).resolves.toBeUndefined();
		expect(ownedSignal?.aborted).toBe(true);
		expect(ownedSignal?.reason).toBe('user cancelled');
		expect(task.status.value).toBe('cancelled');
		expect(task.isCancelled.value).toBe(true);
	});

	it('gives state ownership to the latest execution', async () => {
		const runs = [deferred<string>(), deferred<string>()];
		const signals: AbortSignal[] = [];
		const task = useAsyncTask({
			task: (signal, index: number) => {
				signals.push(signal);
				return runs[index]?.promise ?? Promise.reject(new Error('missing run'));
			},
		});

		const first = task.execute(0);
		await Promise.resolve();
		const second = task.execute(1);
		expect(signals[0]?.aborted).toBe(true);
		await expect(first).resolves.toBeUndefined();
		runs[0]?.resolve('stale');
		runs[1]?.resolve('latest');

		await expect(second).resolves.toBe('latest');
		expect(task.data.value).toBe('latest');
		expect(task.status.value).toBe('success');
	});

	it('does not start work cancelled before its queued callback begins', async () => {
		const taskFn = vi.fn(async (_signal: AbortSignal, value: string) => value);
		const task = useAsyncTask({ task: taskFn });

		const skipped = task.execute('skipped');
		const current = task.execute('current');

		await expect(skipped).resolves.toBeUndefined();
		await expect(current).resolves.toBe('current');
		expect(taskFn).toHaveBeenCalledOnce();
		expect(taskFn).toHaveBeenCalledWith(expect.any(AbortSignal), 'current');
	});

	it('observes a late stale rejection without changing newer state', async () => {
		const firstRun = deferred<string>();
		const task = useAsyncTask({
			task: (_signal, run: 'first' | 'second') =>
				run === 'first' ? firstRun.promise : Promise.resolve('current'),
		});

		const first = task.execute('first');
		await Promise.resolve();
		await expect(task.execute('second')).resolves.toBe('current');
		await expect(first).resolves.toBeUndefined();
		firstRun.reject(new Error('late stale failure'));
		await Promise.resolve();

		expect(task.data.value).toBe('current');
		expect(task.error.value).toBeNull();
		expect(task.status.value).toBe('success');
	});

	it('reset cancels work and restores the initial snapshot', async () => {
		const run = deferred<string>();
		const task = useAsyncTask({ initialData: 'initial', task: () => run.promise });
		const execution = task.execute();

		task.reset();
		await expect(execution).resolves.toBeUndefined();
		run.resolve('stale');
		await Promise.resolve();

		expect(task.status.value).toBe('idle');
		expect(task.data.value).toBe('initial');
		expect(task.error.value).toBeNull();
	});

	it('rejects an invalid task at hook creation', () => {
		expect(() => useAsyncTask({ task: undefined as never })).toThrow(
			'task must be a function'
		);
	});

	it('aborts on component unmount and suppresses late state writes', async () => {
		document.body.innerHTML = '<div id="app"></div>';
		const run = deferred<string>();
		let task: UseAsyncTaskReturn<string> | undefined;
		let ownedSignal: AbortSignal | undefined;
		const App = define({
			script: () => {
				task = useAsyncTask({
					task: (signal) => {
						ownedSignal = signal;
						return run.promise;
					},
				});
				return {};
			},
			template: () =>
				CreateElementNode({
					[EFFUSE_NODE]: true,
					tag: 'main',
					props: {},
					children: ['Async task owner'],
				}),
		});
		const mounted = await createApp(App).mount('#app');
		const execution = task?.execute();
		await Promise.resolve();
		expect(task?.status.value).toBe('pending');

		await mounted.unmount();
		await expect(execution).resolves.toBeUndefined();
		expect(ownedSignal?.aborted).toBe(true);
		run.resolve('late');
		await Promise.resolve();

		expect(task?.data.value).toBeUndefined();
		expect(task?.status.value).toBe('pending');
		await expect(task?.execute()).rejects.toMatchObject({ name: 'AbortError' });
	});
});
