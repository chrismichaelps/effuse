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

import { signal, computed, type Signal, type ReadonlySignal } from '@effuse/core';
import {
	useQueryClient,
	type QueryKey,
	type CacheEntry,
	type QueryClientApi,
} from '../client/index.js';
import { DEFAULT_STALE_TIME_MS, DEFAULT_TIMEOUT_MS } from '../config/index.js';
import { InfiniteQueryError } from '../errors/index.js';

export interface InfiniteQueryOptions<TData, TPageParam = number> {
	readonly queryKey: QueryKey;
	readonly queryFn: (context: { pageParam: TPageParam; signal: AbortSignal }) => Promise<TData>;
	readonly initialPageParam: TPageParam;
	readonly getNextPageParam: (
		lastPage: TData,
		allPages: readonly TData[]
	) => TPageParam | undefined;
	readonly getPreviousPageParam?: (
		firstPage: TData,
		allPages: readonly TData[]
	) => TPageParam | undefined;
	readonly staleTime?: number;
	readonly timeout?: number;
	readonly retry?: number | boolean;
	readonly retryDelay?: number;
	readonly enabled?: boolean;
	readonly maxPages?: number;
	readonly select?: (data: InfiniteData<TData>) => InfiniteData<TData>;
	readonly initialData?: InfiniteData<TData>;
	readonly placeholderData?: InfiniteData<TData>;
	readonly refetchOnWindowFocus?: boolean;
	readonly refetchOnReconnect?: boolean;
	readonly client?: QueryClientApi;
}

export interface UseInfiniteQueryResult<TData> {
	readonly data: Signal<InfiniteData<TData> | undefined>;
	readonly error: Signal<Error | undefined>;
	readonly status: Signal<'pending' | 'success' | 'error'>;
	readonly fetchStatus: Signal<'idle' | 'fetching'>;

	readonly isPending: ReadonlySignal<boolean>;
	readonly isLoading: ReadonlySignal<boolean>;
	readonly isSuccess: ReadonlySignal<boolean>;
	readonly isError: ReadonlySignal<boolean>;
	readonly isFetching: ReadonlySignal<boolean>;
	readonly isRefetching: ReadonlySignal<boolean>;
	readonly isPlaceholderData: ReadonlySignal<boolean>;

	readonly isFetchingNextPage: ReadonlySignal<boolean>;
	readonly isFetchingPreviousPage: ReadonlySignal<boolean>;
	readonly hasNextPage: ReadonlySignal<boolean>;
	readonly hasPreviousPage: ReadonlySignal<boolean>;

	readonly dataUpdatedAt: Signal<number | undefined>;
	readonly errorUpdatedAt: Signal<number | undefined>;
	readonly failureCount: Signal<number>;
	readonly failureReason: Signal<Error | undefined>;

	readonly fetchNextPage: () => Promise<void>;
	readonly fetchPreviousPage: () => Promise<void>;
	readonly refetch: () => Promise<void>;
	readonly cancel: () => void;
	readonly dispose: () => void;
}

export interface InfiniteData<TData> {
	readonly pages: TData[];
	readonly pageParams: unknown[];
}

const sleep = (ms: number): Promise<void> =>
	new Promise((resolve) => setTimeout(resolve, ms));

const normalizeRetryConfig = (
	retry: number | boolean | undefined
): number => {
	if (retry === false) return 0;
	if (retry === true) return 3;
	if (typeof retry === 'number') return retry;
	return 0;
};

export const useInfiniteQuery = <TData, TPageParam = number>(
	options: InfiniteQueryOptions<TData, TPageParam>
): UseInfiniteQueryResult<TData> => {
	const {
		queryKey,
		queryFn,
		initialPageParam,
		getNextPageParam,
		getPreviousPageParam,
		staleTime = DEFAULT_STALE_TIME_MS,
		timeout = DEFAULT_TIMEOUT_MS,
		retry,
		retryDelay = 1000,
		enabled = true,
		maxPages,
		select,
		initialData,
		placeholderData,
		refetchOnWindowFocus = true,
		refetchOnReconnect = true,
	} = options;

	const client = options.client ?? useQueryClient();

	const cacheKey = [...queryKey, 'infinite'];

	const dataSignal = signal<InfiniteData<TData> | undefined>(initialData ?? placeholderData ?? undefined);
	const errorSignal = signal<Error | undefined>(undefined);
	const statusSignal = signal<'pending' | 'success' | 'error'>(initialData ? 'success' : 'pending');
	const fetchStatusSignal = signal<'idle' | 'fetching'>('idle');
	const isFetchingNextPageSignal = signal<boolean>(false);
	const isFetchingPreviousPageSignal = signal<boolean>(false);
	const hasNextPageSignal = signal<boolean>(false);
	const hasPreviousPageSignal = signal<boolean>(false);
	const dataUpdatedAtSignal = signal<number | undefined>(initialData ? Date.now() : undefined);
	const errorUpdatedAtSignal = signal<number | undefined>(undefined);
	const failureCountSignal = signal<number>(0);
	const failureReasonSignal = signal<Error | undefined>(undefined);
	const isPlaceholderDataSignal = signal<boolean>(!!placeholderData && !initialData);

	const isPendingSignal = computed(() => statusSignal.value === 'pending');
	const isLoadingSignal = computed(() => statusSignal.value === 'pending' && fetchStatusSignal.value === 'fetching');
	const isSuccessSignal = computed(() => statusSignal.value === 'success');
	const isErrorSignal = computed(() => statusSignal.value === 'error');
	const isFetchingSignal = computed(() => fetchStatusSignal.value === 'fetching');
	const isRefetchingSignal = computed(() => dataSignal.value !== undefined && fetchStatusSignal.value === 'fetching');

	let currentAbortController: AbortController | null = null;
	let currentPageParams: TPageParam[] = initialData ? [...initialData.pageParams] as TPageParam[] : [];

	const writeCache = (data: InfiniteData<TData>): void => {
		const existing = client.get<InfiniteData<TData>>(cacheKey);
		const entry: CacheEntry<InfiniteData<TData>> = {
			data,
			dataUpdatedAt: Date.now(),
			status: 'success',
			fetchCount: (existing?.fetchCount ?? 0) + 1,
		};
		client.set(cacheKey, entry);
	};

	const runWithRetry = async (
		pageParam: TPageParam,
		maxRetries: number
	): Promise<TData> => {
		let lastError: Error | undefined;
		currentAbortController = new AbortController();
		const signal = currentAbortController.signal;

		for (let attempt = 0; attempt <= maxRetries; attempt++) {
			if (signal.aborted) {
				throw new Error('Query was cancelled');
			}

			try {
				const promise = queryFn({ pageParam, signal });

				if (timeout > 0) {
					const timeoutPromise = new Promise<never>((_, reject) => {
						const timer = setTimeout(() => {
							reject(new Error(`Query timed out after ${timeout}ms`));
						}, timeout);
						signal.addEventListener('abort', () => {
							clearTimeout(timer);
							reject(new Error('Query was cancelled'));
						});
					});

					return await Promise.race([promise, timeoutPromise]);
				}

				return await promise;
			} catch (error) {
				if (signal.aborted) {
					throw new Error('Query was cancelled');
				}

				lastError = error instanceof Error ? error : new Error(String(error));

				if (attempt < maxRetries) {
					const delay = retryDelay * Math.pow(2, attempt);
					await sleep(delay);
				}
			}
		}

		throw lastError;
	};

	const fetchPage = async (pageParam: TPageParam): Promise<TData> => {
		const maxRetries = normalizeRetryConfig(retry);
		return runWithRetry(pageParam, maxRetries);
	};

	const fetchNextPage = async (): Promise<void> => {
		if (!enabled || fetchStatusSignal.value === 'fetching') return;

		const currentData = dataSignal.value;
		if (!currentData || currentData.pages.length === 0) {
			await refetch();
			return;
		}

		const lastPage = currentData.pages[currentData.pages.length - 1];
		if (!lastPage) return;

		const nextPageParam = getNextPageParam(lastPage, currentData.pages);

		if (nextPageParam === undefined) {
			hasNextPageSignal.value = false;
			return;
		}

		if (maxPages !== undefined && currentData.pages.length >= maxPages) {
			return;
		}

		fetchStatusSignal.value = 'fetching';
		isFetchingNextPageSignal.value = true;

		try {
			const newPage = await fetchPage(nextPageParam);

			const newData: InfiniteData<TData> = {
				pages: [...currentData.pages, newPage],
				pageParams: [...currentData.pageParams, nextPageParam],
			};

			const selectedData = select ? select(newData) : newData;
			dataSignal.value = selectedData;
			currentPageParams = [...currentPageParams, nextPageParam];

			const nextNext = getNextPageParam(newPage, newData.pages);
			hasNextPageSignal.value = nextNext !== undefined;

			statusSignal.value = 'success';
			isPlaceholderDataSignal.value = false;
			dataUpdatedAtSignal.value = Date.now();
			errorSignal.value = undefined;
			failureCountSignal.value = 0;
			failureReasonSignal.value = undefined;
			writeCache(newData);
		} catch (error) {
			const err = error instanceof Error ? error : new InfiniteQueryError({ message: String(error), cause: error });
			errorSignal.value = err;
			statusSignal.value = 'error';
			errorUpdatedAtSignal.value = Date.now();
			failureCountSignal.value += 1;
			failureReasonSignal.value = err;
		} finally {
			fetchStatusSignal.value = 'idle';
			isFetchingNextPageSignal.value = false;
		}
	};

	const fetchPreviousPage = async (): Promise<void> => {
		if (!enabled || fetchStatusSignal.value === 'fetching' || !getPreviousPageParam) return;

		const currentData = dataSignal.value;
		if (!currentData || currentData.pages.length === 0) {
			return;
		}

		const firstPage = currentData.pages[0];
		if (!firstPage) return;

		const prevPageParam = getPreviousPageParam(firstPage, currentData.pages);

		if (prevPageParam === undefined) {
			hasPreviousPageSignal.value = false;
			return;
		}

		fetchStatusSignal.value = 'fetching';
		isFetchingPreviousPageSignal.value = true;

		try {
			const newPage = await fetchPage(prevPageParam);

			const newData: InfiniteData<TData> = {
				pages: [newPage, ...currentData.pages],
				pageParams: [prevPageParam, ...currentData.pageParams],
			};

			const selectedData = select ? select(newData) : newData;
			dataSignal.value = selectedData;
			currentPageParams = [prevPageParam, ...currentPageParams];

			const prevPrev = getPreviousPageParam(newPage, newData.pages);
			hasPreviousPageSignal.value = prevPrev !== undefined;

			statusSignal.value = 'success';
			isPlaceholderDataSignal.value = false;
			dataUpdatedAtSignal.value = Date.now();
			errorSignal.value = undefined;
			failureCountSignal.value = 0;
			failureReasonSignal.value = undefined;
			writeCache(newData);
		} catch (error) {
			const err = error instanceof Error ? error : new InfiniteQueryError({ message: String(error), cause: error });
			errorSignal.value = err;
			statusSignal.value = 'error';
			errorUpdatedAtSignal.value = Date.now();
			failureCountSignal.value += 1;
			failureReasonSignal.value = err;
		} finally {
			fetchStatusSignal.value = 'idle';
			isFetchingPreviousPageSignal.value = false;
		}
	};

	const refetch = async (): Promise<void> => {
		if (!enabled) return;

		cancel();
		fetchStatusSignal.value = 'fetching';

		try {
			const initialPage = await fetchPage(initialPageParam);

			const newData: InfiniteData<TData> = {
				pages: [initialPage],
				pageParams: [initialPageParam],
			};

			const selectedData = select ? select(newData) : newData;
			dataSignal.value = selectedData;
			currentPageParams = [initialPageParam];

			const nextParam = getNextPageParam(initialPage, [initialPage]);
			hasNextPageSignal.value = nextParam !== undefined;

			if (getPreviousPageParam) {
				const prevParam = getPreviousPageParam(initialPage, [initialPage]);
				hasPreviousPageSignal.value = prevParam !== undefined;
			}

			statusSignal.value = 'success';
			isPlaceholderDataSignal.value = false;
			dataUpdatedAtSignal.value = Date.now();
			errorSignal.value = undefined;
			failureCountSignal.value = 0;
			failureReasonSignal.value = undefined;
			writeCache(newData);
		} catch (error) {
			const err = error instanceof Error ? error : new InfiniteQueryError({ message: String(error), cause: error });
			errorSignal.value = err;
			statusSignal.value = 'error';
			errorUpdatedAtSignal.value = Date.now();
			failureCountSignal.value += 1;
			failureReasonSignal.value = err;
		} finally {
			fetchStatusSignal.value = 'idle';
		}
	};

	const cancel = (): void => {
		if (currentAbortController) {
			currentAbortController.abort();
			currentAbortController = null;
		}
	};

	// Initialize from cache
	const cached = client.get<InfiniteData<TData>>(cacheKey);
	if (cached && cached.data) {
		dataSignal.value = cached.data;
		if (cached.status === 'success') {
			statusSignal.value = 'success';
			dataUpdatedAtSignal.value = cached.dataUpdatedAt;
		} else if (cached.status === 'error') {
			statusSignal.value = 'error';
		}

		const pages = cached.data.pages;
		if (pages.length > 0) {
			const lastPage = pages[pages.length - 1]!;
			const nextParam = getNextPageParam(lastPage, pages);
			hasNextPageSignal.value = nextParam !== undefined;

			if (getPreviousPageParam) {
				const firstPage = pages[0]!;
				const prevParam = getPreviousPageParam(firstPage, pages);
				hasPreviousPageSignal.value = prevParam !== undefined;
			}
		}
	}

	// Initial fetch
	if (enabled && !initialData && (!cached || client.isStale(cacheKey, staleTime))) {
		refetch();
	}

	// Window focus refetch
	const cleanupFns: Array<() => void> = [];

	if (refetchOnWindowFocus && typeof window !== 'undefined') {
		const handleFocus = (): void => {
			if (enabled && (!cached || client.isStale(cacheKey, staleTime))) {
				refetch().catch(() => {
					// Errors handled internally
				});
			}
		};
		window.addEventListener('focus', handleFocus);
		cleanupFns.push(() => window.removeEventListener('focus', handleFocus));
	}

	// Reconnect refetch
	if (refetchOnReconnect && typeof window !== 'undefined') {
		const handleOnline = (): void => {
			if (enabled && (!cached || client.isStale(cacheKey, staleTime))) {
				refetch().catch(() => {
					// Errors handled internally
				});
			}
		};
		window.addEventListener('online', handleOnline);
		cleanupFns.push(() => window.removeEventListener('online', handleOnline));
	}

	const dispose = (): void => {
		cancel();
		for (const fn of cleanupFns) {
			fn();
		}
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
		isRefetching: isRefetchingSignal,
		isPlaceholderData: isPlaceholderDataSignal,
		isFetchingNextPage: isFetchingNextPageSignal,
		isFetchingPreviousPage: isFetchingPreviousPageSignal,
		hasNextPage: hasNextPageSignal,
		hasPreviousPage: hasPreviousPageSignal,
		dataUpdatedAt: dataUpdatedAtSignal,
		errorUpdatedAt: errorUpdatedAtSignal,
		failureCount: failureCountSignal,
		failureReason: failureReasonSignal,
		fetchNextPage,
		fetchPreviousPage,
		refetch,
		cancel,
		dispose,
	};
};
