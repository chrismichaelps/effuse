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

import { Effect, Fiber, Duration } from 'effect';
import { signal, type Signal } from '@effuse/core';
import { getGlobalQueryClient, type QueryKey } from '../client/index.js';
import { buildRetrySchedule, type RetryConfig } from '../execution/index.js';
import { DEFAULT_STALE_TIME_MS, DEFAULT_TIMEOUT_MS } from '../config/index.js';

// Paginated query page data
export interface InfiniteQueryPage<TData> {
	readonly data: TData;
}

// Infinite query configuration
export interface InfiniteQueryOptions<TData, TPageParam = number> {
	readonly queryKey: QueryKey;
	readonly queryFn: (context: { pageParam: TPageParam }) => Promise<TData>;
	readonly initialPageParam: TPageParam;
	readonly getNextPageParam: (
		lastPage: TData,
		allPages: TData[]
	) => TPageParam | undefined;
	readonly getPreviousPageParam?: (
		firstPage: TData,
		allPages: TData[]
	) => TPageParam | undefined;
	readonly staleTime?: number;
	readonly timeout?: number;
	readonly retry?: RetryConfig | number | boolean;
	readonly enabled?: boolean;
	readonly maxPages?: number;
}

// Infinite query result state
export interface UseInfiniteQueryResult<TData> {
	readonly data: Signal<InfiniteData<TData> | undefined>;
	readonly error: Signal<Error | undefined>;

	readonly status: Signal<'pending' | 'success' | 'error'>;
	readonly isFetching: Signal<boolean>;
	readonly isFetchingNextPage: Signal<boolean>;
	readonly isFetchingPreviousPage: Signal<boolean>;
	readonly hasNextPage: Signal<boolean>;
	readonly hasPreviousPage: Signal<boolean>;

	readonly isPending: Signal<boolean>;
	readonly isSuccess: Signal<boolean>;
	readonly isError: Signal<boolean>;

	readonly fetchNextPage: () => Promise<void>;
	readonly fetchPreviousPage: () => Promise<void>;
	readonly refetch: () => Promise<void>;

	readonly allPagesData: Signal<TData[] | undefined>;
}

// Infinite query page collection
export interface InfiniteData<TData> {
	readonly pages: TData[];
	readonly pageParams: unknown[];
}

const normalizeRetryConfig = (
	retry: RetryConfig | number | boolean | undefined
): RetryConfig | undefined => {
	if (retry === false) return { times: 0 };
	if (retry === true) return undefined;
	if (typeof retry === 'number') return { times: retry };
	return retry;
};

// Reactive infinite query hook
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
		enabled = true,
		maxPages,
	} = options;

	const client = getGlobalQueryClient();

	const dataSignal = signal<InfiniteData<TData> | undefined>(undefined);
	const errorSignal = signal<Error | undefined>(undefined);
	const statusSignal = signal<'pending' | 'success' | 'error'>('pending');
	const isFetchingSignal = signal<boolean>(false);
	const isFetchingNextPageSignal = signal<boolean>(false);
	const isFetchingPreviousPageSignal = signal<boolean>(false);
	const hasNextPageSignal = signal<boolean>(false);
	const hasPreviousPageSignal = signal<boolean>(false);

	const isPendingSignal = signal<boolean>(true);
	const isSuccessSignal = signal<boolean>(false);
	const isErrorSignal = signal<boolean>(false);

	const allPagesDataSignal = signal<TData[] | undefined>(undefined);

	let currentPageParams: TPageParam[] = [];

	let activeFiber: Fiber.RuntimeFiber<unknown, unknown> | null = null;

	let isInternalUpdate = false;

	const updateDerivedState = (): void => {
		const status = statusSignal.value;
		isPendingSignal.value = status === 'pending';
		isSuccessSignal.value = status === 'success';
		isErrorSignal.value = status === 'error';

		const currentData = dataSignal.value;
		allPagesDataSignal.value = currentData?.pages;
	};

	const fetchPage = (
		pageParam: TPageParam
	): Effect.Effect<TData, Error, never> => {
		const retryConfig = normalizeRetryConfig(retry);
		const schedule = buildRetrySchedule(retryConfig);

		let effect: Effect.Effect<TData, Error, never> = Effect.tryPromise({
			try: () => queryFn({ pageParam }),
			catch: (error) =>
				new Error(error instanceof Error ? error.message : String(error)),
		});

		effect = effect.pipe(
			Effect.timeoutFail({
				duration: Duration.millis(timeout),
				onTimeout: () => new Error(`Query timed out after ${timeout}ms`),
			})
		);

		if (retryConfig?.times !== 0) {
			effect = effect.pipe(Effect.retry(schedule));
		}

		return effect;
	};

	const fetchNextPage = async (): Promise<void> => {
		if (!enabled || isFetchingSignal.value) return;

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

		isFetchingSignal.value = true;
		isFetchingNextPageSignal.value = true;

		try {
			const newPage = await Effect.runPromise(fetchPage(nextPageParam));

			isInternalUpdate = true;
			const newData: InfiniteData<TData> = {
				pages: [...currentData.pages, newPage],
				pageParams: [...currentData.pageParams, nextPageParam],
			};

			dataSignal.value = newData;
			currentPageParams = [...currentPageParams, nextPageParam];

			const nextNext = getNextPageParam(newPage, newData.pages);
			hasNextPageSignal.value = nextNext !== undefined;

			statusSignal.value = 'success';
			updateDerivedState();
			isInternalUpdate = false;
		} catch (error) {
			errorSignal.value =
				error instanceof Error ? error : new Error(String(error));
			statusSignal.value = 'error';
			updateDerivedState();
		} finally {
			isFetchingSignal.value = false;
			isFetchingNextPageSignal.value = false;
		}
	};

	const fetchPreviousPage = async (): Promise<void> => {
		if (!enabled || isFetchingSignal.value || !getPreviousPageParam) return;

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

		isFetchingSignal.value = true;
		isFetchingPreviousPageSignal.value = true;

		try {
			const newPage = await Effect.runPromise(fetchPage(prevPageParam));

			isInternalUpdate = true;
			const newData: InfiniteData<TData> = {
				pages: [newPage, ...currentData.pages],
				pageParams: [prevPageParam, ...currentData.pageParams],
			};

			dataSignal.value = newData;
			currentPageParams = [prevPageParam, ...currentPageParams];

			const prevPrev = getPreviousPageParam(newPage, newData.pages);
			hasPreviousPageSignal.value = prevPrev !== undefined;

			statusSignal.value = 'success';
			updateDerivedState();
			isInternalUpdate = false;
		} catch (error) {
			errorSignal.value =
				error instanceof Error ? error : new Error(String(error));
			statusSignal.value = 'error';
			updateDerivedState();
		} finally {
			isFetchingSignal.value = false;
			isFetchingPreviousPageSignal.value = false;
		}
	};

	const refetch = async (): Promise<void> => {
		if (!enabled) return;

		if (activeFiber) {
			Effect.runFork(Fiber.interrupt(activeFiber));
			activeFiber = null;
		}

		isFetchingSignal.value = true;

		try {
			const initialPage = await Effect.runPromise(fetchPage(initialPageParam));

			isInternalUpdate = true;
			const newData: InfiniteData<TData> = {
				pages: [initialPage],
				pageParams: [initialPageParam],
			};

			dataSignal.value = newData;
			currentPageParams = [initialPageParam];

			const nextParam = getNextPageParam(initialPage, [initialPage]);
			hasNextPageSignal.value = nextParam !== undefined;

			if (getPreviousPageParam) {
				const prevParam = getPreviousPageParam(initialPage, [initialPage]);
				hasPreviousPageSignal.value = prevParam !== undefined;
			}

			statusSignal.value = 'success';
			errorSignal.value = undefined;
			updateDerivedState();
			isInternalUpdate = false;
		} catch (error) {
			errorSignal.value =
				error instanceof Error ? error : new Error(String(error));
			statusSignal.value = 'error';
			updateDerivedState();
		} finally {
			isFetchingSignal.value = false;
		}
	};

	const cacheKey = [...queryKey, 'infinite'];
	const cached = client.get<InfiniteData<TData>>(cacheKey);
	if (cached) {
		dataSignal.value = cached.data;

		if (cached.status === 'success') {
			statusSignal.value = 'success';
		} else if (cached.status === 'error') {
			statusSignal.value = 'error';
		} else {
			statusSignal.value = 'pending';
		}
		updateDerivedState();
	}

	client.subscribe(cacheKey, () => {
		if (enabled && !isInternalUpdate) {
			refetch();
		}
	});

	if (enabled && (!cached || client.isStale(cacheKey, staleTime))) {
		refetch();
	}

	return {
		data: dataSignal,
		error: errorSignal,
		status: statusSignal,
		isFetching: isFetchingSignal,
		isFetchingNextPage: isFetchingNextPageSignal,
		isFetchingPreviousPage: isFetchingPreviousPageSignal,
		hasNextPage: hasNextPageSignal,
		hasPreviousPage: hasPreviousPageSignal,
		isPending: isPendingSignal,
		isSuccess: isSuccessSignal,
		isError: isErrorSignal,
		fetchNextPage,
		fetchPreviousPage,
		refetch,
		allPagesData: allPagesDataSignal,
	};
};
