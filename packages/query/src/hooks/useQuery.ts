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

import { Effect } from 'effect';
import {
	computed,
	defineHook,
	signal,
	type ReadonlySignal,
	type Signal,
} from '@effuse/core';
import {
	useQueryClient,
	type QueryOptions,
	type FetchStatus,
} from '../client/index.js';
import { QueryObserver } from '../core/index.js';
import type { QueryFunction as CoreQueryFunction } from '../core/types.js';

export type QueryStatus = 'pending' | 'success' | 'error';

export interface UseQueryResult<T> {
	readonly data: Signal<T | undefined>;
	readonly error: Signal<Error | undefined>;

	readonly status: Signal<QueryStatus>;
	readonly fetchStatus: Signal<FetchStatus>;

	readonly isPending: ReadonlySignal<boolean>;
	readonly isLoading: ReadonlySignal<boolean>;
	readonly isSuccess: ReadonlySignal<boolean>;
	readonly isError: ReadonlySignal<boolean>;
	readonly isFetching: ReadonlySignal<boolean>;
	readonly isStale: Signal<boolean>;
	readonly isRefetching: ReadonlySignal<boolean>;
	readonly isPlaceholderData: Signal<boolean>;

	readonly dataUpdatedAt: Signal<number | undefined>;
	readonly errorUpdatedAt: Signal<number | undefined>;

	readonly refetch: () => Promise<void>;
	readonly cancel: () => void;
	readonly dispose: () => void;

	readonly failureCount: Signal<number>;
	readonly failureReason: Signal<Error | undefined>;
}

const wrapQueryFn = <T>(
	queryFn: () => Promise<T> | Effect.Effect<T, Error, never>
): CoreQueryFunction<T> => {
	return ({ signal }: { signal: AbortSignal }) => {
		const result = queryFn();

		if (Effect.isEffect(result)) {
			// For Effect, run it and return the promise
			return Effect.runPromise(result).catch((error) => {
				if (signal.aborted) {
					throw new Error('Query was cancelled');
				}
				throw error;
			});
		}

		return result;
	};
};

const useQueryHook = defineHook<
	QueryOptions<unknown>,
	UseQueryResult<unknown>
>({
	name: 'useQuery',
	setup: (ctx) => {
	const options = ctx.config;
	const {
		queryKey,
		queryFn,
		staleTime,
		cacheTime,
		retry,
		timeout,
		enabled = true,
		refetchOnWindowFocus = true,
		refetchOnReconnect = true,
		refetchInterval = false,
		onSuccess,
		onError,
		onSettled,
		select,
		placeholderData,
		initialData,
	} = options;

	const client = options.client ?? useQueryClient();

	// Signals mirroring the observer result
	const dataSignal = signal<unknown>(undefined);
	const errorSignal = signal<Error | undefined>(undefined);
	const statusSignal = signal<QueryStatus>('pending');
	const fetchStatusSignal = signal<FetchStatus>('idle');
	const isStaleSignal = signal<boolean>(true);
	const isPlaceholderDataSignal = signal<boolean>(false);
	const dataUpdatedAtSignal = signal<number | undefined>(undefined);
	const errorUpdatedAtSignal = signal<number | undefined>(undefined);
	const failureCountSignal = signal<number>(0);
	const failureReasonSignal = signal<Error | undefined>(undefined);

	// Derived state
	const isPendingSignal = computed(() => statusSignal.value === 'pending');
	const isLoadingSignal = computed(
		() => statusSignal.value === 'pending' && fetchStatusSignal.value === 'fetching'
	);
	const isSuccessSignal = computed(() => statusSignal.value === 'success');
	const isErrorSignal = computed(() => statusSignal.value === 'error');
	const isFetchingSignal = computed(() => fetchStatusSignal.value === 'fetching');
	const isRefetchingSignal = computed(
		() => dataSignal.value !== undefined && fetchStatusSignal.value === 'fetching'
	);

	// Get or create the query
	const query = client.getQuery<unknown, Error>({
		queryKey,
		queryFn: wrapQueryFn(queryFn),
		...(staleTime !== undefined && { staleTime }),
		...(cacheTime !== undefined && { gcTime: cacheTime }),
		...(retry !== undefined && { retry }),
		...(timeout !== undefined && { timeout }),
	});

	// Create the observer
	const observer = new QueryObserver(query, {
		queryKey,
		queryFn: wrapQueryFn(queryFn),
		...(staleTime !== undefined && { staleTime }),
		...(cacheTime !== undefined && { gcTime: cacheTime }),
		...(retry !== undefined && { retry }),
		...(timeout !== undefined && { timeout }),
		enabled,
		...(select !== undefined && { select }),
		...(placeholderData !== undefined && { placeholderData }),
		...(initialData !== undefined && { initialData }),
		refetchOnWindowFocus,
		refetchOnReconnect,
		...(refetchInterval !== false && { refetchInterval }),
	});

	// Sync signals from observer result
	const syncResult = (result: ReturnType<typeof observer.getCurrentResult>): void => {
		dataSignal.value = result.data;
		errorSignal.value = result.error ?? undefined;
		statusSignal.value = result.status;
		fetchStatusSignal.value = result.fetchStatus;
		isStaleSignal.value = result.isStale;
		isPlaceholderDataSignal.value = result.isPlaceholderData;
		dataUpdatedAtSignal.value = result.dataUpdatedAt || undefined;
		errorUpdatedAtSignal.value = result.errorUpdatedAt || undefined;

		if (result.isError && result.error) {
			failureCountSignal.value += 1;
			failureReasonSignal.value = result.error;
		} else if (result.isSuccess) {
			failureCountSignal.value = 0;
			failureReasonSignal.value = undefined;
		}

		if (result.isSuccess && onSuccess) {
			onSuccess(result.data);
		}
		if (result.isError && onError && result.error) {
			onError(result.error);
		}
		if (onSettled) {
			onSettled(
				result.isSuccess ? result.data : undefined,
				result.isError ? result.error : undefined
			);
		}
	};

	// Initial sync
	syncResult(observer.getCurrentResult());

	// Subscribe to changes
	const unsubscribe = observer.subscribe((result) => {
		syncResult(result);
	});

	const cleanupFns: Array<() => void> = [unsubscribe];
	let intervalId: ReturnType<typeof setInterval> | null = null;
	let mountedCleanup: (() => void) | null = null;
	let disposed = false;

	const cancel = (): void => {
		query.cancel();
	};

	const dispose = (): void => {
		if (disposed) return;
		disposed = true;
		mountedCleanup?.();
		mountedCleanup = null;
		observer.destroy();
		for (const fn of cleanupFns) {
			fn();
		}
		if (intervalId) {
			clearInterval(intervalId);
			intervalId = null;
		}
	};

	ctx.onMount(() => {
		if (disposed) return undefined;
		const mountedCleanups: Array<() => void> = [];
		if (enabled && query.isStale) {
			query.fetch().catch(() => {
				// Errors are handled by the observer.
			});
		}
		if (refetchOnWindowFocus && typeof window !== 'undefined') {
			const handleFocus = (): void => {
				if (enabled && query.isStale) {
					query.fetch().catch(() => {
						// Errors are handled by the observer.
					});
				}
			};
			window.addEventListener('focus', handleFocus);
			mountedCleanups.push(() =>
				window.removeEventListener('focus', handleFocus)
			);
		}
		if (refetchOnReconnect && typeof window !== 'undefined') {
			const handleOnline = (): void => {
				if (enabled && query.isStale) {
					query.fetch().catch(() => {
						// Errors are handled by the observer.
					});
				}
			};
			window.addEventListener('online', handleOnline);
			mountedCleanups.push(() =>
				window.removeEventListener('online', handleOnline)
			);
		}
		if (refetchInterval !== false && refetchInterval > 0) {
			intervalId = setInterval(() => {
				if (enabled) {
					query.fetch().catch(() => {
						// Errors are handled by the observer.
					});
				}
			}, refetchInterval);
		}
		mountedCleanup = () => {
			for (const cleanup of mountedCleanups) cleanup();
			if (intervalId !== null) {
				clearInterval(intervalId);
				intervalId = null;
			}
		};
		return () => {
			mountedCleanup?.();
			mountedCleanup = null;
		};
	});
	ctx.onCleanup(dispose);

	const refetch = async (): Promise<void> => {
		if (!enabled) return;
		await query.fetch();
	};

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
		dispose,
	};
	},
});

export const useQuery = useQueryHook as <TData>(
	options: QueryOptions<TData>
) => UseQueryResult<TData>;
