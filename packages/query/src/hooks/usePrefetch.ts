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

import { Effect, Predicate, Option, pipe } from 'effect';
import { getGlobalQueryClient, type QueryKey } from '../client/index.js';
import { DEFAULT_STALE_TIME_MS } from '../config/index.js';

// Prefetch options
export interface PrefetchOptions {
	readonly staleTime?: number;
}

// Prefetch query data
export const prefetchQuery = <T>(
	queryKey: QueryKey,
	queryFn: () => Promise<T>,
	options?: PrefetchOptions
): void => {
	const client = getGlobalQueryClient();
	const staleTime = pipe(
		Option.fromNullable(options),
		Option.flatMap((o) => Option.fromNullable(o.staleTime)),
		Option.getOrElse(() => DEFAULT_STALE_TIME_MS)
	);

	Effect.runFork(client.prefetch(queryKey, queryFn, staleTime));
};

// Prefetch query data
export const prefetchQueryAsync = async <T>(
	queryKey: QueryKey,
	queryFn: () => Promise<T>,
	options?: PrefetchOptions
): Promise<void> => {
	const client = getGlobalQueryClient();
	const staleTime = pipe(
		Option.fromNullable(options),
		Option.flatMap((o) => Option.fromNullable(o.staleTime)),
		Option.getOrElse(() => DEFAULT_STALE_TIME_MS)
	);

	await Effect.runPromise(client.prefetch(queryKey, queryFn, staleTime));
};

// Fetch and cache query data
export const fetchQuery = async <T>(
	queryKey: QueryKey,
	queryFn: () => Promise<T>,
	options?: PrefetchOptions
): Promise<T> => {
	const client = getGlobalQueryClient();
	const staleTime = pipe(
		Option.fromNullable(options),
		Option.flatMap((o) => Option.fromNullable(o.staleTime)),
		Option.getOrElse(() => DEFAULT_STALE_TIME_MS)
	);

	if (!client.isStale(queryKey, staleTime)) {
		const cached = client.get<T>(queryKey);
		if (
			Predicate.isNotNullable(cached) &&
			Predicate.isNotNullable(cached.data)
		) {
			return cached.data;
		}
	}

	const data = await queryFn();

	client.set(queryKey, {
		data,
		dataUpdatedAt: Date.now(),
		status: 'success',
		fetchCount:
			pipe(
				Option.fromNullable(client.get<T>(queryKey)),
				Option.flatMap((e) => Option.fromNullable(e.fetchCount)),
				Option.getOrElse(() => 0)
			) + 1,
	});

	return data;
};

// Ensure query data exists in cache
export const ensureQueryData = async <T>(
	queryKey: QueryKey,
	queryFn: () => Promise<T>,
	options?: PrefetchOptions
): Promise<T> => {
	const client = getGlobalQueryClient();
	const staleTime = pipe(
		Option.fromNullable(options),
		Option.flatMap((o) => Option.fromNullable(o.staleTime)),
		Option.getOrElse(() => DEFAULT_STALE_TIME_MS)
	);

	if (!client.isStale(queryKey, staleTime)) {
		const cached = client.get<T>(queryKey);
		if (
			Predicate.isNotNullable(cached) &&
			Predicate.isNotNullable(cached.data)
		) {
			return cached.data;
		}
	}

	return fetchQuery(queryKey, queryFn, options);
};

// Reactive prefetch hook
export const usePrefetch = () => {
	return {
		prefetchQuery,
		prefetchQueryAsync,
		fetchQuery,
		ensureQueryData,
	};
};
