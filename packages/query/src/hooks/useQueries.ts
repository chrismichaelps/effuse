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

import { Effect, Duration } from 'effect';
import { signal, type Signal } from '@effuse/core';
import { type QueryKey } from '../client/index.js';
import { DEFAULT_TIMEOUT_MS } from '../config/index.js';

// Parallel query configuration
export interface UseQueriesOptions<T> {
	readonly queryKey: QueryKey;
	readonly queryFn: () => Promise<T>;
	readonly enabled?: boolean;
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
	const enabledQueries = queries.filter((q) => q.enabled !== false);

	const results: UseQueriesResult<T>[] = queries.map(() => ({
		data: signal<T | undefined>(undefined),
		error: signal<Error | undefined>(undefined),
		isPending: signal<boolean>(true),
		isSuccess: signal<boolean>(false),
		isError: signal<boolean>(false),
	}));

	if (enabledQueries.length === 0) {
		return results;
	}

	const queryIndexMap = new Map<string, number>();
	queries.forEach((q, index) => {
		queryIndexMap.set(JSON.stringify(q.queryKey), index);
	});

	const parallelEffect = Effect.all(
		enabledQueries.map((q) =>
			Effect.tryPromise({
				try: () => q.queryFn(),
				catch: (error) =>
					new Error(error instanceof Error ? error.message : String(error)),
			}).pipe(
				Effect.timeoutFail({
					duration: Duration.millis(DEFAULT_TIMEOUT_MS),
					onTimeout: () => new Error('Query timed out'),
				}),
				Effect.map((data) => ({
					queryKey: q.queryKey,
					data,
					error: undefined as Error | undefined,
				})),
				Effect.catchAll((error: Error) =>
					Effect.succeed({
						queryKey: q.queryKey,
						data: undefined as T | undefined,
						error,
					})
				)
			)
		),
		{ concurrency: 'unbounded' }
	);

	Effect.runFork(
		parallelEffect.pipe(
			Effect.tap((queryResults) =>
				Effect.sync(() => {
					for (const result of queryResults) {
						const index = queryIndexMap.get(JSON.stringify(result.queryKey));
						if (index !== undefined) {
							const r = results[index];
							if (r) {
								if (result.error) {
									r.error.value = result.error;
									r.isError.value = true;
								} else {
									r.data.value = result.data;
									r.isSuccess.value = true;
								}
								r.isPending.value = false;
							}
						}
					}
				})
			)
		)
	);

	return results;
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
