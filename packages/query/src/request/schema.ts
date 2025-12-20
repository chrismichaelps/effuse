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

import { Request } from 'effect';
import type { QueryKey } from '../client/types.js';

export class QueryRequest<T> extends Request.TaggedClass('QueryRequest')<
	T,
	Error,
	{
		readonly queryKey: QueryKey;
		readonly queryFn: () => Promise<T>;
	}
> {}

export class MutationRequest<TData, TVariables> extends Request.TaggedClass(
	'MutationRequest'
)<
	TData,
	Error,
	{
		readonly mutationKey: QueryKey | undefined;
		readonly mutationFn: (variables: TVariables) => Promise<TData>;
		readonly variables: TVariables;
	}
> {}

export const makeQueryRequest = <T>(
	queryKey: QueryKey,
	queryFn: () => Promise<T>
): QueryRequest<T> =>
	new QueryRequest({
		queryKey,
		queryFn,
	});

export const makeMutationRequest = <TData, TVariables>(
	mutationKey: QueryKey | undefined,
	mutationFn: (variables: TVariables) => Promise<TData>,
	variables: TVariables
): MutationRequest<TData, TVariables> =>
	new MutationRequest({
		mutationKey,
		mutationFn,
		variables,
	});

export const hashQueryKey = (key: QueryKey): string => JSON.stringify(key);

export const isEqualQueryRequest = <T>(
	a: QueryRequest<T>,
	b: QueryRequest<T>
): boolean => hashQueryKey(a.queryKey) === hashQueryKey(b.queryKey);
