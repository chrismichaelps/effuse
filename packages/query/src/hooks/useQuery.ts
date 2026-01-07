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

import { Effect, Fiber, Duration, Exit, Predicate, Option, pipe } from 'effect';
import { signal, type Signal } from '@effuse/core';
import {
	getGlobalQueryClient,
	type QueryOptions,
	type CacheEntry,
} from '../client/index.js';
import {
	buildRetrySchedule,
	buildRefetchSchedule,
	type RetryConfig,
} from '../execution/index.js';
import { executeQuery } from '../request/index.js';
import { DEFAULT_STALE_TIME_MS, DEFAULT_TIMEOUT_MS } from '../config/index.js';
import { TimeoutError } from '../errors/index.js';

// Network request status
export type FetchStatus = 'idle' | 'fetching' | 'paused';

// Query result status
export type QueryStatus = 'pending' | 'success' | 'error';

// Query result data and state
export interface UseQueryResult<T> {
	readonly data: Signal<T | undefined>;
	readonly error: Signal<Error | undefined>;

	readonly status: Signal<QueryStatus>;
	readonly fetchStatus: Signal<FetchStatus>;

	readonly isPending: Signal<boolean>;
	readonly isLoading: Signal<boolean>;
	readonly isSuccess: Signal<boolean>;
	readonly isError: Signal<boolean>;
	readonly isFetching: Signal<boolean>;
	readonly isStale: Signal<boolean>;
	readonly isRefetching: Signal<boolean>;
	readonly isPlaceholderData: Signal<boolean>;

	readonly dataUpdatedAt: Signal<number | undefined>;
	readonly errorUpdatedAt: Signal<number | undefined>;

	readonly refetch: () => Promise<void>;
	readonly cancel: () => void;

	readonly failureCount: Signal<number>;
	readonly failureReason: Signal<Error | undefined>;
}

const normalizeRetryConfig = (
	retry: RetryConfig | number | boolean | undefined
): RetryConfig | undefined => {
	if (retry === false) return { times: 0 };
	if (retry === true) return undefined;
	if (typeof retry === 'number') return { times: retry };
	return retry;
};

const structuralEquals = <T>(a: T, b: T): boolean => {
	return JSON.stringify(a) === JSON.stringify(b);
};

// Reactive query hook
export const useQuery = <TData>(
	options: QueryOptions<TData>
): UseQueryResult<TData> => {
	const {
		queryKey,
		queryFn,
		staleTime = DEFAULT_STALE_TIME_MS,
		retry,
		timeout = DEFAULT_TIMEOUT_MS,
		enabled = true,
		refetchOnWindowFocus = true,
		refetchOnReconnect = true,
		refetchInterval = false,
		onSuccess,
		onError,
		onSettled,
		select,
		placeholderData,
	} = options;

	const client = getGlobalQueryClient();

	const dataSignal = signal<TData | undefined>(undefined);
	const errorSignal = signal<Error | undefined>(undefined);
	const statusSignal = signal<QueryStatus>('pending');
	const fetchStatusSignal = signal<FetchStatus>('idle');

	const isPendingSignal = signal<boolean>(true);
	const isLoadingSignal = signal<boolean>(true);
	const isSuccessSignal = signal<boolean>(false);
	const isErrorSignal = signal<boolean>(false);
	const isFetchingSignal = signal<boolean>(false);
	const isStaleSignal = signal<boolean>(true);
	const isRefetchingSignal = signal<boolean>(false);
	const isPlaceholderDataSignal = signal<boolean>(false);

	const dataUpdatedAtSignal = signal<number | undefined>(undefined);
	const errorUpdatedAtSignal = signal<number | undefined>(undefined);

	const failureCountSignal = signal<number>(0);
	const failureReasonSignal = signal<Error | undefined>(undefined);

	let activeFiber: Fiber.RuntimeFiber<unknown, unknown> | null = null;
	let refetchIntervalFiber: Fiber.RuntimeFiber<unknown, unknown> | null = null;
	let isInternalUpdate = false;

	const updateDerivedState = (): void => {
		const status = statusSignal.value;
		const fetchStatus = fetchStatusSignal.value;
		const hasData = dataSignal.value !== undefined;

		isPendingSignal.value = status === 'pending';
		isLoadingSignal.value = status === 'pending' && fetchStatus === 'fetching';
		isSuccessSignal.value = status === 'success';
		isErrorSignal.value = status === 'error';
		isFetchingSignal.value = fetchStatus === 'fetching';
		isRefetchingSignal.value = hasData && fetchStatus === 'fetching';
		isStaleSignal.value = client.isStale(queryKey, staleTime);
	};

	const buildFetchEffect = (): Effect.Effect<TData, Error, never> => {
		const retryConfig = normalizeRetryConfig(retry);
		const schedule = buildRetrySchedule(retryConfig);

		let effect: Effect.Effect<TData, Error, never> = executeQuery(
			queryKey,
			queryFn
		);

		effect = effect.pipe(
			Effect.timeoutFail({
				duration: Duration.millis(timeout),
				onTimeout: () => new TimeoutError({ durationMs: timeout }),
			})
		);

		if (!Predicate.isNotNullable(retryConfig) || retryConfig.times !== 0) {
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

		if (select) {
			effect = effect.pipe(Effect.map(select));
		}

		return effect;
	};

	const executeFetch = async (): Promise<void> => {
		if (activeFiber) {
			Effect.runFork(Fiber.interrupt(activeFiber));
			activeFiber = null;
		}

		fetchStatusSignal.value = 'fetching';
		updateDerivedState();

		const effect = buildFetchEffect();

		const fiber = Effect.runFork(
			effect.pipe(
				Effect.tap((data) =>
					Effect.sync(() => {
						const shouldUpdate =
							!dataSignal.value ||
							!structuralEquals(dataSignal.value as TData, data as TData);

						if (shouldUpdate) {
							const entry: CacheEntry<TData> = {
								data,
								dataUpdatedAt: Date.now(),
								status: 'success',
								fetchCount:
									pipe(
										Option.fromNullable(client.get<TData>(queryKey)),
										Option.flatMap((e) => Option.fromNullable(e.fetchCount)),
										Option.getOrElse(() => 0)
									) + 1,
							};
							isInternalUpdate = true;
							client.set(queryKey, entry);
							isInternalUpdate = false;
							dataSignal.value = data;
						}

						errorSignal.value = undefined;
						statusSignal.value = 'success';
						fetchStatusSignal.value = 'idle';
						dataUpdatedAtSignal.value = Date.now();
						isPlaceholderDataSignal.value = false;
						failureCountSignal.value = 0;
						failureReasonSignal.value = undefined;
						updateDerivedState();

						if (Predicate.isNotNullable(onSuccess)) {
							onSuccess(data);
						}
						if (Predicate.isNotNullable(onSettled)) {
							onSettled(data, undefined);
						}
					})
				),
				Effect.catchAll((error: Error) =>
					Effect.sync(() => {
						const entry: CacheEntry<TData> = {
							data: dataSignal.value as TData,
							dataUpdatedAt: Date.now(),
							status: 'error',
							error,
							fetchCount:
								pipe(
									Option.fromNullable(client.get<TData>(queryKey)),
									Option.flatMap((e) => Option.fromNullable(e.fetchCount)),
									Option.getOrElse(() => 0)
								) + 1,
						};
						isInternalUpdate = true;
						client.set(queryKey, entry);
						isInternalUpdate = false;

						errorSignal.value = error;
						statusSignal.value = 'error';
						fetchStatusSignal.value = 'idle';
						errorUpdatedAtSignal.value = Date.now();
						updateDerivedState();

						if (Predicate.isNotNullable(onError)) {
							onError(error);
						}
						if (Predicate.isNotNullable(onSettled)) {
							onSettled(undefined, error);
						}
					})
				),
				Effect.scoped
			)
		);

		activeFiber = fiber;

		const exit = await Effect.runPromiseExit(Fiber.join(fiber));
		if (Exit.isFailure(exit)) {
			fetchStatusSignal.value = 'idle';
			updateDerivedState();
		}
	};

	const cancel = (): void => {
		if (activeFiber) {
			Effect.runFork(Fiber.interrupt(activeFiber));
			activeFiber = null;
		}
		if (refetchIntervalFiber) {
			Effect.runFork(Fiber.interrupt(refetchIntervalFiber));
			refetchIntervalFiber = null;
		}
		fetchStatusSignal.value = 'idle';
		updateDerivedState();
	};

	const refetch = async (): Promise<void> => {
		if (!enabled) return;
		await executeFetch();
	};

	const cached = client.get<TData>(queryKey);
	if (cached) {
		dataSignal.value = cached.data;

		if (cached.status === 'success') {
			statusSignal.value = 'success';
		} else if (cached.status === 'error') {
			statusSignal.value = 'error';
		} else {
			statusSignal.value = 'pending';
		}
		dataUpdatedAtSignal.value = cached.dataUpdatedAt;
		if (cached.error) {
			errorSignal.value = cached.error as Error;
		}
		updateDerivedState();
	} else if (placeholderData !== undefined) {
		const placeholder =
			typeof placeholderData === 'function'
				? (placeholderData as () => TData)()
				: placeholderData;
		dataSignal.value = placeholder;
		isPlaceholderDataSignal.value = true;
	}

	client.subscribe(queryKey, () => {
		if (isInternalUpdate) return;
		isStaleSignal.value = true;
		if (enabled) {
			executeFetch();
		}
	});

	if (refetchOnWindowFocus && typeof window !== 'undefined') {
		const handleFocus = (): void => {
			if (enabled && client.isStale(queryKey, staleTime)) {
				executeFetch();
			}
		};
		window.addEventListener('focus', handleFocus);
	}

	if (refetchOnReconnect && typeof window !== 'undefined') {
		const handleOnline = (): void => {
			if (enabled && client.isStale(queryKey, staleTime)) {
				executeFetch();
			}
		};
		window.addEventListener('online', handleOnline);
	}

	if (refetchInterval !== false && refetchInterval > 0) {
		const intervalEffect = Effect.repeat(
			Effect.sync(() => {
				if (enabled) {
					executeFetch();
				}
			}),
			buildRefetchSchedule(refetchInterval)
		);
		refetchIntervalFiber = Effect.runFork(intervalEffect);
	}

	if (enabled && client.isStale(queryKey, staleTime)) {
		executeFetch();
	}

	return {
		data: dataSignal,
		error: errorSignal,
		status: statusSignal,
		fetchStatus: fetchStatusSignal,
		isPending: isPendingSignal,
		isLoading: isLoadingSignal,
		isSuccess: isSuccessSignal,
		isError: isErrorSignal,
		isFetching: isFetchingSignal,
		isStale: isStaleSignal,
		isRefetching: isRefetchingSignal,
		isPlaceholderData: isPlaceholderDataSignal,
		dataUpdatedAt: dataUpdatedAtSignal,
		errorUpdatedAt: errorUpdatedAtSignal,
		failureCount: failureCountSignal,
		failureReason: failureReasonSignal,
		refetch,
		cancel,
	};
};
