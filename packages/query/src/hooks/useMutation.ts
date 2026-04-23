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
import { signal, computed, type Signal, type ReadonlySignal } from '@effuse/core';
import {
	useQueryClient,
	type MutationOptions,
	type CacheEntry,
	type QueryKey,
} from '../client/index.js';
import { buildRetrySchedule, type RetryConfig } from '../execution/index.js';
import { executeMutation } from '../request/index.js';
import { DEFAULT_TIMEOUT_MS } from '../config/index.js';
import { TimeoutError } from '../errors/index.js';

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
): UseMutationResult<TData, TVariables, TContext> => {
	const {
		mutationKey,
		mutationFn,
		retry = { times: 0 },
		timeout = DEFAULT_TIMEOUT_MS,
		onMutate,
		onSuccess,
		onError,
		onSettled,
	} = options;

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

	let activeFiber: Fiber.RuntimeFiber<unknown, unknown> | null = null;

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

	const executeMutationWithContext = async (
		variables: TVariables,
		mutateOptions?: MutateOptions<TData, TVariables>
	): Promise<TData> => {
		if (activeFiber) {
			Effect.runFork(Fiber.interrupt(activeFiber));
			activeFiber = null;
		}

		statusSignal.value = 'pending';
		variablesSignal.value = variables;
		submittedAtSignal.value = Date.now();

		let context: TContext | undefined;
		if (onMutate) {
			try {
				const result = onMutate(variables);
				context = result instanceof Promise ? await result : result;
				contextSignal.value = context;
			} catch (mutateError) {
				errorSignal.value =
					mutateError instanceof Error
						? mutateError
						: new Error(String(mutateError));
				statusSignal.value = 'error';
				if (Predicate.isNotNullable(onError)) {
					onError(errorSignal.value, variables, context);
				}
				if (Predicate.isNotNullable(onSettled)) {
					onSettled(undefined, errorSignal.value, variables, context);
				}
				throw errorSignal.value;
			}
		}

		return new Promise<TData>((resolve, reject) => {
			const effect = buildMutationEffect(variables);

			const fiber = Effect.runFork(
				effect.pipe(
					Effect.tap((data) =>
						Effect.sync(() => {
							dataSignal.value = data;
							errorSignal.value = undefined;
							statusSignal.value = 'success';
							failureCountSignal.value = 0;
							failureReasonSignal.value = undefined;

							if (Predicate.isNotNullable(onSuccess)) {
								onSuccess(data, variables, context);
							}
							if (
								Predicate.isNotNullable(mutateOptions) &&
								Predicate.isNotNullable(mutateOptions.onSuccess)
							) {
								mutateOptions.onSuccess(data, variables);
							}
							if (Predicate.isNotNullable(onSettled)) {
								onSettled(data, undefined, variables, context);
							}
							if (
								Predicate.isNotNullable(mutateOptions) &&
								Predicate.isNotNullable(mutateOptions.onSettled)
							) {
								mutateOptions.onSettled(data, undefined, variables);
							}

							resolve(data);
						})
					),
					Effect.catchAll((error: Error) =>
						Effect.sync(() => {
							errorSignal.value = error;
							statusSignal.value = 'error';

							if (Predicate.isNotNullable(onError)) {
								onError(error, variables, context);
							}
							if (
								Predicate.isNotNullable(mutateOptions) &&
								Predicate.isNotNullable(mutateOptions.onError)
							) {
								mutateOptions.onError(error, variables);
							}
							if (Predicate.isNotNullable(onSettled)) {
								onSettled(undefined, error, variables, context);
							}
							if (
								Predicate.isNotNullable(mutateOptions) &&
								Predicate.isNotNullable(mutateOptions.onSettled)
							) {
								mutateOptions.onSettled(undefined, error, variables);
							}

							reject(error);
						})
					),
					Effect.scoped
				)
			);

			activeFiber = fiber;
		});
	};

	const mutate = (
		variables: TVariables,
		options?: MutateOptions<TData, TVariables>
	): void => {
		executeMutationWithContext(variables, options).catch((error) => {
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
		if (activeFiber) {
			Effect.runFork(Fiber.interrupt(activeFiber));
			activeFiber = null;
		}

		dataSignal.value = undefined;
		errorSignal.value = undefined;
		statusSignal.value = 'idle';
		variablesSignal.value = undefined;
		contextSignal.value = undefined;
		submittedAtSignal.value = undefined;
		failureCountSignal.value = 0;
		failureReasonSignal.value = undefined;
	};

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
	};
};

// Per-query optimistic update config
export interface OptimisticQueryConfig<TData, TVariables> {
	readonly queryKey: QueryKey;
	readonly optimisticUpdate: (
		variables: TVariables,
		current: TData | undefined
	) => TData;
}

// Options for optimistic mutation
export interface OptimisticMutationOptions<TData, TVariables> {
	readonly mutationFn: (variables: TVariables) => Promise<TData>;
	/** Queries to optimistically update. */
	readonly queries: ReadonlyArray<OptimisticQueryConfig<TData, TVariables>>;
	/** Keys to invalidate after successful mutation. */
	readonly invalidateKeys?: ReadonlyArray<QueryKey>;
	readonly timeout?: number;
	readonly client?: import('../client/client.js').QueryClientApi;
}

interface OptimisticContext<TData> {
	readonly snapshots: ReadonlyArray<{
		readonly queryKey: QueryKey;
		readonly snapshot: CacheEntry<TData> | undefined;
	}>;
}

// Optimistic update hook
export const useOptimisticMutation = <TData, TVariables>(
	options: OptimisticMutationOptions<TData, TVariables>
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
				const optimisticData = config.optimisticUpdate(
					variables,
					currentData
				);
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
