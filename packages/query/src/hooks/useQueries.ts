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
import { signal, type Signal } from '@effuse/core';
import { useQuery } from './useQuery.js';
import type { QueryKey, QueryClientApi } from '../client/index.js';

// Parallel query configuration
export interface UseQueriesOptions<T> {
	readonly queryKey: QueryKey;
	readonly queryFn: () => Promise<T>;
	readonly enabled?: boolean;
	/**
	 * Explicit QueryClient instance. If omitted, the hook will inject
	 * from the nearest Effuse component scope via provideQueryClient(),
	 * falling back to the global singleton.
	 */
	readonly client?: QueryClientApi;
}

// Parallel query result
export interface UseQueriesResult<T> {
	readonly data: Signal<T | undefined>;
	readonly error: Signal<Error | undefined>;
	readonly isPending: Signal<boolean>;
	readonly isSuccess: Signal<boolean>;
	readonly isError: Signal<boolean>;
}

// Reactive parallel queries hook
export const useQueries = <T>(
	queries: ReadonlyArray<UseQueriesOptions<T>>
): UseQueriesResult<T>[] => {
	return queries.map((q) => {
		const result = useQuery<T>({
			queryKey: q.queryKey,
			queryFn: q.queryFn,
			...(q.enabled !== undefined ? { enabled: q.enabled } : {}),
			...(q.client !== undefined ? { client: q.client } : {}),
		});

		return {
			data: result.data,
			error: result.error,
			isPending: result.isPending,
			isSuccess: result.isSuccess,
			isError: result.isError,
		};
	});
};

// Combined query result state
export interface CombinedQueryResult<T> {
	readonly data: Signal<T[] | undefined>;
	readonly errors: Signal<Error[]>;
	readonly isPending: Signal<boolean>;
	readonly isSuccess: Signal<boolean>;
	readonly isError: Signal<boolean>;
	readonly isPartialSuccess: Signal<boolean>;
}

// Reactive combined queries hook
export const useCombinedQueries = <T>(
	queries: ReadonlyArray<UseQueriesOptions<T>>
): CombinedQueryResult<T> => {
	const results = useQueries(queries);

	const combinedData = signal<T[] | undefined>(undefined);
	const combinedErrors = signal<Error[]>([]);
	const isPending = signal<boolean>(true);
	const isSuccess = signal<boolean>(false);
	const isError = signal<boolean>(false);
	const isPartialSuccess = signal<boolean>(false);

	const combineEffect = Effect.sync(() => {
		const data: T[] = [];
		const errors: Error[] = [];
		let pendingCount = 0;
		let successCount = 0;
		let errorCount = 0;

		for (const result of results) {
			if (result.isPending.value) {
				pendingCount++;
			} else if (result.isError.value && result.error.value) {
				errorCount++;
				errors.push(result.error.value);
			} else if (result.isSuccess.value && result.data.value !== undefined) {
				successCount++;
				data.push(result.data.value);
			}
		}

		combinedErrors.value = errors;
		isPending.value = pendingCount > 0;
		isSuccess.value = successCount === results.length && pendingCount === 0;
		isError.value = errorCount === results.length && pendingCount === 0;
		isPartialSuccess.value =
			successCount > 0 && errorCount > 0 && pendingCount === 0;

		if (!isPending.value && successCount > 0) {
			combinedData.value = data;
		}
	});

	Effect.runSync(combineEffect);

	return {
		data: combinedData,
		errors: combinedErrors,
		isPending,
		isSuccess,
		isError,
		isPartialSuccess,
	};
};
