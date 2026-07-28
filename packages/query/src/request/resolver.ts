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

export interface QueryExecutionScope {
	readonly _tag: 'QueryExecutionScope';
}

const scopeEntries = new WeakMap<
	QueryExecutionScope,
	Map<string, InFlightEntry>
>();

export const createQueryExecutionScope = (): QueryExecutionScope => {
	const scope = Object.freeze({ _tag: 'QueryExecutionScope' as const });
	scopeEntries.set(scope, new Map());
	return scope;
};

const getScopeEntries = (
	scope: QueryExecutionScope
): Map<string, InFlightEntry> => {
	const entries = scopeEntries.get(scope);
	if (!entries) {
		throw new Error('Query execution scope was not created by Effuse Query.');
	}
	return entries;
};

const cleanupStaleEntries = (entries: Map<string, InFlightEntry>): void => {
	const now = Date.now();
	for (const [key, entry] of entries) {
		if (now - entry.timestamp > IN_FLIGHT_TTL_MS) {
			entries.delete(key);
		}
	}
};

const setInFlight = (
	entries: Map<string, InFlightEntry>,
	keyHash: string,
	promise: Promise<unknown>
): void => {
	cleanupStaleEntries(entries);

	if (entries.size >= IN_FLIGHT_MAX_SIZE) {
		// Remove oldest entry when at capacity
		const oldest = entries.entries().next().value;
		if (oldest) {
			entries.delete(oldest[0]);
		}
	}

	entries.set(keyHash, { promise, timestamp: Date.now() });
};

export const executeQuery = <T>(
	queryKey: QueryKey,
	queryFn: QueryFunction<T>,
	scope?: QueryExecutionScope
): Effect.Effect<T, Error, never> => {
	const keyHash = hashQueryKey(queryKey);

	return Effect.gen(function* () {
		const entries = scope ? getScopeEntries(scope) : undefined;
		if (entries) cleanupStaleEntries(entries);
		const existing = entries?.get(keyHash);
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
									message:
										error instanceof Error ? error.message : String(error),
									queryKey,
									cause: error,
								})
					)
				)
			);
		}

		const promise = raw.finally(() => {
			if (entries?.get(keyHash)?.promise === promise) {
				entries.delete(keyHash);
			}
		});

		if (entries) setInFlight(entries, keyHash, promise);

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
	const scope = createQueryExecutionScope();
	return Effect.all(
		queries.map((q) => executeQuery(q.queryKey, q.queryFn, scope)),
		{ concurrency: 'unbounded' }
	);
};

export { QueryRequest, hashQueryKey } from './schema.js';
