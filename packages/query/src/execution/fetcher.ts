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
import { NetworkError, QueryError } from '../errors/index.js';

type QueryFn<T> = () => Promise<T>;

const wrapFetcher = <T>(
	queryFn: QueryFn<T>,
	queryKey: readonly unknown[]
): Effect.Effect<T, QueryError | NetworkError> =>
	Effect.tryPromise({
		try: () => queryFn(),
		catch: (error) => {
			if (
				error instanceof TypeError &&
				String(error.message).includes('fetch')
			) {
				return new NetworkError({
					message: String(error.message),
				});
			}
			return new QueryError({
				message: error instanceof Error ? error.message : String(error),
				queryKey,
				cause: error,
			});
		},
	});

const wrapFetcherWithSignal = <T>(
	queryFn: (signal: AbortSignal) => Promise<T>,
	queryKey: readonly unknown[],
	signal: AbortSignal
): Effect.Effect<T, QueryError | NetworkError> =>
	Effect.tryPromise({
		try: () => queryFn(signal),
		catch: (error) => {
			if (error instanceof DOMException && error.name === 'AbortError') {
				return new QueryError({
					message: 'Query was cancelled',
					queryKey,
					cause: error,
				});
			}
			if (
				error instanceof TypeError &&
				String(error.message).includes('fetch')
			) {
				return new NetworkError({
					message: String(error.message),
				});
			}
			return new QueryError({
				message: error instanceof Error ? error.message : String(error),
				queryKey,
				cause: error,
			});
		},
	});

export { wrapFetcher, wrapFetcherWithSignal, type QueryFn };
