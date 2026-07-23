import { defineHook, type ReadonlySignal } from '@effuse/core';
import { traceAsyncTask } from './telemetry.js';

export type AsyncTaskStatus =
	| 'idle'
	| 'pending'
	| 'success'
	| 'error'
	| 'cancelled';

export type AsyncTask<
	Result,
	Args extends readonly unknown[] = readonly [],
> = (signal: AbortSignal, ...args: Args) => Promise<Result>;

export interface UseAsyncTaskConfig<
	Result,
	Args extends readonly unknown[] = readonly [],
> {
	readonly task: AsyncTask<Result, Args>;
	readonly initialData?: Result;
}

export interface UseAsyncTaskReturn<
	Result,
	Args extends readonly unknown[] = readonly [],
> {
	readonly status: ReadonlySignal<AsyncTaskStatus>;
	readonly data: ReadonlySignal<Result | undefined>;
	readonly error: ReadonlySignal<unknown>;
	readonly isPending: ReadonlySignal<boolean>;
	readonly isSuccess: ReadonlySignal<boolean>;
	readonly isError: ReadonlySignal<boolean>;
	readonly isCancelled: ReadonlySignal<boolean>;
	readonly execute: (...args: Args) => Promise<Result | undefined>;
	readonly cancel: (reason?: unknown) => void;
	readonly reset: () => void;
}

interface InternalAsyncTaskConfig {
	readonly task: AsyncTask<unknown, readonly unknown[]>;
	readonly initialData?: unknown;
}

const CANCELLED = Symbol('effuse.async-task.cancelled');

const runUntilAbort = async <Result>(
	task: () => Promise<Result>,
	signal: AbortSignal
): Promise<Result | typeof CANCELLED> => {
	let onAbort: (() => void) | undefined;
	const aborted = new Promise<typeof CANCELLED>((resolve) => {
		onAbort = () => {
			resolve(CANCELLED);
		};
		signal.addEventListener('abort', onAbort, { once: true });
	});

	try {
		const operation = Promise.resolve().then<Result | typeof CANCELLED>(() =>
			signal.aborted ? CANCELLED : task()
		);
		return await Promise.race([operation, aborted]);
	} finally {
		if (onAbort) signal.removeEventListener('abort', onAbort);
	}
};

const useAsyncTaskHook = defineHook<
	InternalAsyncTaskConfig,
	UseAsyncTaskReturn<unknown, readonly unknown[]>
>({
	name: 'useAsyncTask',
	setup: (ctx) => {
		const { task, initialData } = ctx.config;
		if (typeof task !== 'function') {
			throw new TypeError('[useAsyncTask] task must be a function.');
		}

		const status = ctx.signal<AsyncTaskStatus>('idle');
		const data = ctx.signal<unknown>(initialData);
		const error = ctx.signal<unknown>(null);
		const isPending = ctx.computed(() => status.value === 'pending');
		const isSuccess = ctx.computed(() => status.value === 'success');
		const isError = ctx.computed(() => status.value === 'error');
		const isCancelled = ctx.computed(() => status.value === 'cancelled');
		let activeController: AbortController | undefined;
		let generation = 0;
		let disposed = false;

		traceAsyncTask('init');

		const abortActive = (reason?: unknown): boolean => {
			if (!activeController) return false;
			const controller = activeController;
			activeController = undefined;
			generation += 1;
			controller.abort(reason);
			return true;
		};

		const handleOwnerAbort = (): void => {
			disposed = true;
			abortActive(ctx.abortSignal.reason);
			traceAsyncTask('dispose');
		};
		ctx.abortSignal.addEventListener('abort', handleOwnerAbort, { once: true });
		ctx.onCleanup(() => {
			ctx.abortSignal.removeEventListener('abort', handleOwnerAbort);
		});

		const execute = (...args: readonly unknown[]): Promise<unknown> =>
			ctx.runAsync(async () => {
				if (activeController) {
					abortActive();
					traceAsyncTask('replace');
				}

				const controller = new AbortController();
				const currentGeneration = ++generation;
				activeController = controller;
				status.value = 'pending';
				error.value = null;
				traceAsyncTask('execute');

				try {
					const result = await runUntilAbort(
						() => task(controller.signal, ...args),
						controller.signal
					);
					if (
						result === CANCELLED ||
						disposed ||
						currentGeneration !== generation
					) {
						return undefined;
					}

					activeController = undefined;
					data.value = result;
					status.value = 'success';
					traceAsyncTask('success');
					return result;
				} catch (cause) {
					if (
						disposed ||
						controller.signal.aborted ||
						currentGeneration !== generation
					) {
						return undefined;
					}

					activeController = undefined;
					error.value = cause;
					status.value = 'error';
					traceAsyncTask('error');
					throw cause;
				}
			});

		const cancel = (reason?: unknown): void => {
			if (!abortActive(reason)) return;
			if (!disposed) status.value = 'cancelled';
			traceAsyncTask('cancel');
		};

		const reset = (): void => {
			abortActive();
			if (disposed) return;
			status.value = 'idle';
			data.value = initialData;
			error.value = null;
			traceAsyncTask('reset');
		};

		return {
			status,
			data,
			error,
			isPending,
			isSuccess,
			isError,
			isCancelled,
			execute,
			cancel,
			reset,
		};
	},
});

export const useAsyncTask = useAsyncTaskHook as <
	Result,
	Args extends readonly unknown[] = readonly [],
>(
	config: UseAsyncTaskConfig<Result, Args>
) => UseAsyncTaskReturn<Result, Args>;
