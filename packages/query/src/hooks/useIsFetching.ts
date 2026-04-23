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

import { signal, computed, type ReadonlySignal } from '@effuse/core';
import { useQueryClient, type QueryClientApi } from '../client/index.js';

export interface UseIsFetchingOptions {
	readonly client?: QueryClientApi;
}

/**
 * Returns a reactive signal with the count of currently fetching queries.
 * Useful for global loading indicators.
 */
export const useIsFetching = (options?: UseIsFetchingOptions): ReadonlySignal<number> => {
	const client = options?.client ?? useQueryClient();
	const countSignal = signal<number>(0);

	const updateCount = (): void => {
		const queries = client.queryCache.getAll();
		countSignal.value = queries.filter((q) => q.isFetching).length;
	};

	updateCount();

	void client.queryCache.subscribe(updateCount);

	const result = computed(() => countSignal.value);

	// Attach cleanup to the computed signal's disposal if supported by the framework layer
	return result;
};
