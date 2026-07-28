/**
 * MIT License
 *
 * Copyright (c) 2025 Chris M. Perez
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 */

import { Effect, Fiber, Duration, Predicate } from 'effect';
import {
	signal,
	computed,
	defineHook,
	type Signal,
	type ReadonlySignal,
} from '@effuse/core';
import {
	useQueryClient,
	type MutationOptions,
	type CacheEntry,
	type QueryKey,
	type QueryClientApi,
} from '../client/index.js';
import { buildRetrySchedule, type RetryConfig } from '../execution/index.js';
import { executeMutation } from '../request/index.js';
import { DEFAULT_TIMEOUT_MS } from '../config/index.js';
import { CancellationError, TimeoutError } from '../errors/index.js';

// Mutation result status
export type MutationStatus = 'idle' | 'pending' | 'success' | 'error';

// Mutation result data and state
export interface UseMutationResult<TData, TVariables, TContext = unknown> {
	readonly data: Signal<TData | undefined>;
	readonly error: Signal<Error | undefined>;

	readonly status: Signal<MutationStatus>;

	readonly isPending: ReadonlySignal<boolean>;
	readonly isSuccess: ReadonlySignal<boolean>;
	readonly isError: ReadonlySignal<boolean>;
	readonly isIdle: ReadonlySignal<boolean>;

	readonly variables: Signal<TVariables | undefined>;
	readonly context: Signal<TContext | undefined>;

	readonly submittedAt: Signal<number | undefined>;

	readonly mutate: (
		variables: TVariables,
		options?: MutateOptions<TData, TVariables>
	) => void;
	readonly mutateAsync: (
		variables: TVariables,
		options?: MutateOptions<TData, TVariables>
	) => Promise<TData>;
	readonly reset: () => void;
	readonly dispose: () => void;

	readonly failureCount: Signal<number>;
	readonly failureReason: Signal<Error | undefined>;
}

// Mutate function options
export interface MutateOptions<TData, TVariables> {
	readonly onSuccess?: (data: TData, variables: TVariables) => void;
	readonly onError?: (error: Error, variables: TVariables) => void;
	readonly onSettled?: (
		data: TData | undefined,
		error: Error | undefined,
		variables: TVariables
	) => void;
}

// Optimistic mutation options
export interface OptimisticMutationOptions<
	TData,
	TVariables,
	TContext,
> extends MutationOptions<TData, TVariables> {
	readonly onMutate?: (variables: TVariables) => TContext | Promise<TContext>;
	readonly onError?: (
		error: unknown,
		variables: TVariables,
		context?: TContext
	) => void;
	readonly onSuccess?: (
		data: TData,
		variables: TVariables,
		context?: TContext
	) => void;
	readonly onSettled?: (
		data: TData | undefined,
		error: unknown | undefined,
		variables: TVariables,
		context?: TContext
	) => void;
}

const normalizeRetryConfig = (
	retry: RetryConfig | number | boolean | undefined
): RetryConfig | undefined => {
	if (retry === false) return { times: 0 };
	if (retry === true) return undefined;
	if (typeof retry === 'number') return { times: retry };
	return retry;
};

// Reactive mutation hook
export const useMutation = <TData, TVariables = void, TContext = unknown>(
	options: OptimisticMutationOptions<TData, TVariables, TContext>
): UseMutationResult<TData, TVariables, TContext> =>
	defineHook<
		OptimisticMutationOptions<TData, TVariables, TContext>,
		UseMutationResult<TData, TVariables, TContext>
	>({
		name: 'useMutation',
		setup: (ctx) => {
			const {
				mutationKey,
				mutationFn,
				retry = { times: 0 },
				timeout = DEFAULT_TIMEOUT_MS,
				onMutate,
				onSuccess,
				onError,
				onSettled,
			} = ctx.config;

			// Resolved for consistency with other hooks; mutation cache integration is #147
			const dataSignal = signal<TData | undefined>(undefined);
			const errorSignal = signal<Error | undefined>(undefined);
			const statusSignal = signal<MutationStatus>('idle');
			const variablesSignal = signal<TVariables | undefined>(undefined);
			const contextSignal = signal<TContext | undefined>(undefined);
			const submittedAtSignal = signal<number | undefined>(undefined);

			const failureCountSignal = signal<number>(0);
			const failureReasonSignal = signal<Error | undefined>(undefined);

			// Derived state — automatically reactive via computed()
			const isPendingSignal = computed(() => statusSignal.value === 'pending');
			const isSuccessSignal = computed(() => statusSignal.value === 'success');
			const isErrorSignal = computed(() => statusSignal.value === 'error');
			const isIdleSignal = computed(() => statusSignal.value === 'idle');

			interface ActiveMutationRequest {
				readonly token: number;
				readonly reject: (error: Error) => void;
				fiber: Fiber.RuntimeFiber<unknown, unknown> | null;
				settled: boolean;
			}

			let generation = 0;
			let disposed = false;
			let activeRequest: ActiveMutationRequest | null = null;

			const cancellationError = (reason: string): CancellationError =>
				new CancellationError({
					reason,
					...(mutationKey ? { queryKey: mutationKey } : {}),
				});

			const isCurrent = (request: ActiveMutationRequest): boolean =>
				!disposed &&
				!request.settled &&
				activeRequest === request &&
				generation === request.token;

			const cancelActive = (reason: string): void => {
				const request = activeRequest;
				activeRequest = null;
				if (!request || request.settled) return;

				request.settled = true;
				if (request.fiber) {
					Effect.runFork(Fiber.interrupt(request.fiber));
					request.fiber = null;
				}
				request.reject(cancellationError(reason));
			};

			const buildMutationEffect = (
				variables: TVariables
			): Effect.Effect<TData, Error, never> => {
				const retryConfig = normalizeRetryConfig(retry);
				const schedule = buildRetrySchedule(retryConfig);

				let effect: Effect.Effect<TData, Error, never> = executeMutation(
					mutationKey,
					mutationFn,
					variables
				);

				effect = effect.pipe(
					Effect.timeoutFail({
						duration: Duration.millis(timeout),
						onTimeout: () => new TimeoutError({ durationMs: timeout }),
					})
				);

				if (retryConfig && retryConfig.times > 0) {
					effect = effect.pipe(
						Effect.retry(schedule),
						Effect.tapError((error) =>
							Effect.sync(() => {
								failureCountSignal.value += 1;
								failureReasonSignal.value = error;
							})
						)
					);
				}

				return effect;
			};

			const executeMutationWithContext = (
				variables: TVariables,
				mutateOptions?: MutateOptions<TData, TVariables>
			): Promise<TData> => {
				if (disposed) {
					return Promise.reject(
						cancellationError('Mutation hook was disposed')
					);
				}

				generation += 1;
				cancelActive('Mutation was superseded by a newer call');
				const token = generation;

				statusSignal.value = 'pending';
				variablesSignal.value = variables;
				submittedAtSignal.value = Date.now();
				errorSignal.value = undefined;

				return new Promise<TData>((resolve, reject) => {
					const request: ActiveMutationRequest = {
						token,
						reject,
						fiber: null,
						settled: false,
					};
					activeRequest = request;

					const finishError = (
						error: Error,
						context: TContext | undefined
					): void => {
						if (!isCurrent(request)) return;
						request.settled = true;
						request.fiber = null;
						activeRequest = null;
						errorSignal.value = error;
						statusSignal.value = 'error';

						try {
							if (Predicate.isNotNullable(onError)) {
								onError(error, variables, context);
							}
							mutateOptions?.onError?.(error, variables);
							if (Predicate.isNotNullable(onSettled)) {
								onSettled(undefined, error, variables, context);
							}
							mutateOptions?.onSettled?.(undefined, error, variables);
						} finally {
							reject(error);
						}
					};

					const finishSuccess = (
						data: TData,
						context: TContext | undefined
					): void => {
						if (!isCurrent(request)) return;
						request.settled = true;
						request.fiber = null;
						activeRequest = null;
						dataSignal.value = data;
						errorSignal.value = undefined;
						statusSignal.value = 'success';
						failureCountSignal.value = 0;
						failureReasonSignal.value = undefined;

						try {
							if (Predicate.isNotNullable(onSuccess)) {
								onSuccess(data, variables, context);
							}
							mutateOptions?.onSuccess?.(data, variables);
							if (Predicate.isNotNullable(onSettled)) {
								onSettled(data, undefined, variables, context);
							}
							mutateOptions?.onSettled?.(data, undefined, variables);
						} finally {
							resolve(data);
						}
					};

					void (async () => {
						let context: TContext | undefined;
						if (onMutate) {
							try {
								context = await onMutate(variables);
							} catch (mutateError) {
								if (!isCurrent(request)) return;
								finishError(
									mutateError instanceof Error
										? mutateError
										: new Error(String(mutateError)),
									context
								);
								return;
							}
						}

						if (!isCurrent(request)) return;
						contextSignal.value = context;
						const effect = buildMutationEffect(variables);
						request.fiber = Effect.runFork(
							effect.pipe(
								Effect.tap((data) =>
									Effect.sync(() => finishSuccess(data, context))
								),
								Effect.catchAll((error: Error) =>
									Effect.sync(() => finishError(error, context))
								),
								Effect.scoped
							)
						);
					})();
				});
			};

			const mutate = (
				variables: TVariables,
				options?: MutateOptions<TData, TVariables>
			): void => {
				executeMutationWithContext(variables, options).catch((error) => {
					if (error instanceof CancellationError) return;
					// Errors are already written to errorSignal and onError is called.
					// Re-throw so unhandled rejections can be caught by global handlers.
					throw error;
				});
			};

			const mutateAsync = (
				variables: TVariables,
				options?: MutateOptions<TData, TVariables>
			): Promise<TData> => {
				return executeMutationWithContext(variables, options);
			};

			const reset = (): void => {
				generation += 1;
				cancelActive('Mutation was reset');

				dataSignal.value = undefined;
				errorSignal.value = undefined;
				statusSignal.value = 'idle';
				variablesSignal.value = undefined;
				contextSignal.value = undefined;
				submittedAtSignal.value = undefined;
				failureCountSignal.value = 0;
				failureReasonSignal.value = undefined;
			};

			const dispose = (): void => {
				if (disposed) return;
				disposed = true;
				generation += 1;
				cancelActive('Mutation hook was disposed');
			};

			ctx.onCleanup(dispose);

			return {
				data: dataSignal,
				error: errorSignal,
				status: statusSignal,
				isPending: isPendingSignal,
				isSuccess: isSuccessSignal,
				isError: isErrorSignal,
				isIdle: isIdleSignal,
				variables: variablesSignal,
				context: contextSignal,
				submittedAt: submittedAtSignal,
				failureCount: failureCountSignal,
				failureReason: failureReasonSignal,
				mutate,
				mutateAsync,
				reset,
				dispose,
			};
		},
	})(options);

// Per-query optimistic update config
export interface OptimisticQueryConfig<TData, TVariables> {
	readonly queryKey: QueryKey;
	readonly optimisticUpdate: (
		variables: TVariables,
		current: TData | undefined
	) => TData;
}

// Options for optimistic mutation hook
export interface OptimisticMutationHookOptions<TData, TVariables> {
	readonly mutationFn: (variables: TVariables) => Promise<TData>;
	/** Queries to optimistically update. */
	readonly queries: ReadonlyArray<OptimisticQueryConfig<TData, TVariables>>;
	/** Keys to invalidate after successful mutation. */
	readonly invalidateKeys?: ReadonlyArray<QueryKey>;
	readonly timeout?: number;
	readonly client?: QueryClientApi;
}

interface OptimisticContext<TData> {
	readonly snapshots: ReadonlyArray<{
		readonly queryKey: QueryKey;
		readonly snapshot: CacheEntry<TData> | undefined;
	}>;
}

// Optimistic update hook
export const useOptimisticMutation = <TData, TVariables>(
	options: OptimisticMutationHookOptions<TData, TVariables>
): UseMutationResult<TData, TVariables, OptimisticContext<TData>> => {
	const {
		mutationFn,
		queries,
		invalidateKeys,
		timeout = DEFAULT_TIMEOUT_MS,
	} = options;
	const client = options.client ?? useQueryClient();

	return useMutation<TData, TVariables, OptimisticContext<TData>>({
		mutationFn,
		timeout,
		onMutate: (variables) => {
			const snapshots = queries.map((config) => {
				const snapshot = client.getSnapshot<TData>(config.queryKey);

				const existing = client.get<TData>(config.queryKey);
				const currentData = Predicate.isNotNullable(existing)
					? existing.data
					: undefined;
				const optimisticData = config.optimisticUpdate(variables, currentData);
				client.setOptimistic(config.queryKey, optimisticData);

				return { queryKey: config.queryKey, snapshot };
			});

			return { snapshots };
		},
		onError: (_error, _variables, context) => {
			if (context) {
				for (const entry of context.snapshots) {
					if (entry.snapshot) {
						client.rollback(entry.queryKey, entry.snapshot);
					} else {
						// No prior snapshot — remove the optimistic entry
						client.remove(entry.queryKey);
					}
				}
			}
		},
		onSuccess: (_data, _variables) => {
			if (invalidateKeys) {
				for (const key of invalidateKeys) {
					void client.invalidate(key);
				}
			}
		},
	});
};
