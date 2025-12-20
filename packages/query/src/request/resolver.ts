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
import { hashQueryKey } from './schema.js';
import { QueryError, NetworkError } from '../errors/index.js';
import type { QueryKey } from '../client/types.js';

const inFlightRequests = new Map<string, Promise<unknown>>();

export const executeQuery = <T>(
	queryKey: QueryKey,
	queryFn: () => Promise<T>
): Effect.Effect<T, Error, never> => {
	const keyHash = hashQueryKey(queryKey);

	return Effect.tryPromise({
		try: async () => {
			const existing = inFlightRequests.get(keyHash);
			if (existing) {
				return existing as Promise<T>;
			}

			const promise = queryFn().finally(() => {
				inFlightRequests.delete(keyHash);
			});

			inFlightRequests.set(keyHash, promise);
			return promise;
		},
		catch: (error) =>
			error instanceof TypeError
				? new NetworkError({ message: String(error) })
				: new QueryError({
						message: error instanceof Error ? error.message : String(error),
						queryKey,
						cause: error,
					}),
	});
};

export const executeMutation = <TData, TVariables>(
	mutationKey: QueryKey | undefined,
	mutationFn: (variables: TVariables) => Promise<TData>,
	variables: TVariables
): Effect.Effect<TData, Error, never> => {
	return Effect.tryPromise({
		try: () => mutationFn(variables),
		catch: (error) =>
			new QueryError({
				message: error instanceof Error ? error.message : String(error),
				queryKey: mutationKey ?? [],
				cause: error,
			}),
	});
};

export const executeQueries = <T>(
	queries: ReadonlyArray<{
		queryKey: QueryKey;
		queryFn: () => Promise<T>;
	}>
): Effect.Effect<T[], Error, never> => {
	return Effect.all(
		queries.map((q) => executeQuery(q.queryKey, q.queryFn)),
		{ concurrency: 'unbounded' }
	);
};

export { QueryRequest, hashQueryKey } from './schema.js';
