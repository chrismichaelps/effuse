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
import type { QueryFunction, QueryKey } from '../client/types.js';

const IN_FLIGHT_TTL_MS = 30000;
const IN_FLIGHT_MAX_SIZE = 100;

interface InFlightEntry {
	readonly promise: Promise<unknown>;
	readonly timestamp: number;
}

const inFlightRequests = new Map<string, InFlightEntry>();

const cleanupStaleEntries = (): void => {
	const now = Date.now();
	for (const [key, entry] of inFlightRequests) {
		if (now - entry.timestamp > IN_FLIGHT_TTL_MS) {
			inFlightRequests.delete(key);
		}
	}
};

const setInFlight = (keyHash: string, promise: Promise<unknown>): void => {
	cleanupStaleEntries();

	if (inFlightRequests.size >= IN_FLIGHT_MAX_SIZE) {
		// Remove oldest entry when at capacity
		const oldest = inFlightRequests.entries().next().value;
		if (oldest) {
			inFlightRequests.delete(oldest[0]);
		}
	}

	inFlightRequests.set(keyHash, { promise, timestamp: Date.now() });
};

export const executeQuery = <T>(
	queryKey: QueryKey,
	queryFn: QueryFunction<T>
): Effect.Effect<T, Error, never> => {
	const keyHash = hashQueryKey(queryKey);

	return Effect.gen(function* () {
		cleanupStaleEntries();
		const existing = inFlightRequests.get(keyHash);
		if (existing) {
			return yield* Effect.tryPromise({
				try: () => existing.promise as Promise<T>,
				catch: (error) =>
					error instanceof TypeError
						? new NetworkError({ message: String(error) })
						: new QueryError({
								message: error instanceof Error ? error.message : String(error),
								queryKey,
								cause: error,
							}),
			});
		}

		const raw = queryFn();

		if (Effect.isEffect(raw)) {
			return yield* raw.pipe(
				Effect.catchAll((error) =>
					Effect.fail(
						error instanceof TypeError
							? new NetworkError({ message: String(error) })
							: new QueryError({
									message: error instanceof Error ? error.message : String(error),
									queryKey,
									cause: error,
								})
					)
				)
			);
		}

		const promise = raw.finally(() => {
			inFlightRequests.delete(keyHash);
		});

		setInFlight(keyHash, promise);

		return yield* Effect.tryPromise({
			try: () => promise,
			catch: (error) =>
				error instanceof TypeError
					? new NetworkError({ message: String(error) })
					: new QueryError({
							message: error instanceof Error ? error.message : String(error),
							queryKey,
							cause: error,
						}),
		});
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
