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

import { computed, defineHook, signal } from '@effuse/core';
import { useQueryClient, type QueryClientApi } from '../client/index.js';
import type { QueryCountSignal } from './useIsFetching.js';

export interface UseIsMutatingOptions {
	readonly client?: QueryClientApi;
}

/**
 * Returns a reactive signal with the count of currently pending mutations.
 * Useful for global mutation loading indicators.
 */
export const useIsMutating = defineHook<
	UseIsMutatingOptions | undefined,
	QueryCountSignal
>({
	name: 'useIsMutating',
	setup: (ctx) => {
	const client = ctx.config?.client ?? useQueryClient();
	const countSignal = signal<number>(0);

	const updateCount = (): void => {
		countSignal.value = client.mutationCache.pendingCount;
	};

	updateCount();

	const unsubscribe = client.mutationCache.subscribe(updateCount);
	let disposed = false;
	const dispose = (): void => {
		if (disposed) return;
		disposed = true;
		unsubscribe();
	};
	ctx.onCleanup(dispose);

	const result = computed(() => countSignal.value);
	return Object.assign(result, { dispose });
	},
});
