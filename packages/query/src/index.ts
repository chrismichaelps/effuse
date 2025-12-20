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

export {
	DEFAULT_STALE_TIME_MS,
	DEFAULT_CACHE_TIME_MS,
	DEFAULT_RETRY_COUNT,
	DEFAULT_RETRY_DELAY_MS,
	DEFAULT_RETRY_BACKOFF_FACTOR,
	DEFAULT_RETRY_MAX_DELAY_MS,
	DEFAULT_TIMEOUT_MS,
	DEFAULT_GC_TIME_MS,
	DEFAULT_REFETCH_INTERVAL_MS,
} from './config/index.js';

export {
	setGlobalQueryClient,
	createQueryClient,
	invalidateQuery,
	invalidateQueries,
	invalidateAll,
	invalidateQueryAsync,
	invalidateQueriesAsync,
	invalidateAllAsync,
} from './client/index.js';

export type {
	QueryKey,
	QueryStatus as CacheQueryStatus,
	CacheEntry,
	QueryOptions,
	MutationOptions,
} from './client/index.js';

export {
	useQuery,
	useMutation,
	useOptimisticMutation,
	useQueries,
	useCombinedQueries,
	useInfiniteQuery,
	prefetchQuery,
	prefetchQueryAsync,
	fetchQuery,
	ensureQueryData,
	usePrefetch,
} from './hooks/index.js';

export type {
	UseQueryResult,
	FetchStatus,
	QueryStatus,
	UseMutationResult,
	MutationStatus,
	MutateOptions,
	OptimisticMutationOptions,
	UseQueriesOptions,
	UseQueriesResult,
	CombinedQueryResult,
	InfiniteQueryOptions,
	UseInfiniteQueryResult,
	InfiniteData,
	InfiniteQueryPage,
	PrefetchOptions,
} from './hooks/index.js';

export {
	QueryError,
	NetworkError,
	TimeoutError,
	CancellationError,
	MutationError,
} from './errors/index.js';

export type { RetryConfig, BackoffStrategy } from './execution/index.js';
