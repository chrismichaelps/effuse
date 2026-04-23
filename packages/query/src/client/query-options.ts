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

import type { QueryOptions } from './types.js';

/**
 * Options where `initialData` is provided.
 * The query data is guaranteed to be defined.
 */
export interface DefinedInitialDataOptions<T>
	extends Omit<QueryOptions<T>, 'initialData'> {
	readonly initialData: T | (() => T);
}

/**
 * Options where `initialData` is NOT provided.
 * The query data may be undefined.
 */
export interface UndefinedInitialDataOptions<T>
	extends Omit<QueryOptions<T>, 'initialData'> {
	readonly initialData?: never;
}

/**
 * Factory for creating type-safe query options outside of components.
 *
 * When `initialData` is provided, the returned type carries a guarantee
 * that `data` will be defined. When omitted, `data` may be undefined.
 *
 * @example
 * ```ts
 * const userOptions = (id: string) =>
 *   queryOptions({
 *     queryKey: ['users', id],
 *     queryFn: () => fetchUser(id),
 *     staleTime: 5 * 60 * 1000,
 *   });
 *
 * const { data } = useQuery(userOptions('123'));
 * ```
 */
export function queryOptions<T>(
	options: DefinedInitialDataOptions<T>
): DefinedInitialDataOptions<T>;

export function queryOptions<T>(
	options: UndefinedInitialDataOptions<T>
): UndefinedInitialDataOptions<T>;

export function queryOptions<T>(options: QueryOptions<T>): QueryOptions<T> {
	return options;
}

/**
 * Helper for `placeholderData` that keeps the previous query's data
 * while a new query loads. Useful for pagination transitions.
 *
 * @example
 * ```ts
 * const { data, isPlaceholderData } = useQuery({
 *   queryKey: ['projects', page],
 *   queryFn: () => fetchProjects(page),
 *   placeholderData: keepPreviousData,
 * });
 * ```
 */
export const keepPreviousData = <T>(
	previousData: T | undefined
): T | undefined => previousData;
