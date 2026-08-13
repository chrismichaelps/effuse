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

import { describe, it, expect, vi } from 'vitest';
import { createQueryClient } from '../client/client.js';
import { useInfiniteQuery } from './useInfiniteQuery.js';

describe('useInfiniteQuery', () => {
	it('starts in pending state', () => {
		const client = createQueryClient();
		const result = useInfiniteQuery({
			queryKey: ['items'],
			queryFn: async () => [{ id: 1 }],
			initialPageParam: 1,
			getNextPageParam: () => undefined,
			enabled: false,
			client,
		});

		expect(result.status.value).toBe('pending');
		expect(result.isPending.value).toBe(true);
		expect(result.isLoading.value).toBe(false);
		expect(result.isFetching.value).toBe(false);
		expect(result.data.value).toBeUndefined();
	});

	it('fetches initial page and sets success state', async () => {
		const client = createQueryClient();
		const result = useInfiniteQuery({
			queryKey: ['items'],
			queryFn: async ({ pageParam }) => [{ id: pageParam }],
			initialPageParam: 1,
			getNextPageParam: () => undefined,
			client,
		});

		expect(result.isFetching.value).toBe(true);
		expect(result.isLoading.value).toBe(true);

		await new Promise((resolve) => setTimeout(resolve, 10));

		expect(result.status.value).toBe('success');
		expect(result.isSuccess.value).toBe(true);
		expect(result.data.value?.pages).toEqual([[{ id: 1 }]]);
		expect(result.dataUpdatedAt.value).toBeDefined();
	});

	it('fetches next page and appends to data', async () => {
		const client = createQueryClient();
		const result = useInfiniteQuery({
			queryKey: ['items'],
			queryFn: async ({ pageParam }) => [{ id: pageParam }],
			initialPageParam: 1,
			getNextPageParam: (_lastPage, allPages) =>
				allPages.length < 3 ? allPages.length + 1 : undefined,
			client,
		});

		await new Promise((resolve) => setTimeout(resolve, 10));
		expect(result.data.value?.pages).toHaveLength(1);

		await result.fetchNextPage();
		expect(result.data.value?.pages).toHaveLength(2);

		await result.fetchNextPage();
		expect(result.data.value?.pages).toHaveLength(3);
		expect(result.hasNextPage.value).toBe(false);
	});

	it('tracks isFetchingNextPage during next page fetch', async () => {
		// The in-flight window is held open explicitly rather than timed. Waiting
		// a few milliseconds and hoping the fetch is still running asserts
		// nothing on a loaded machine: timers fire late, so the fetch this is
		// meant to observe mid-flight can already have settled.
		const gates = new Map<number, () => void>();
		const pending = new Map<number, Promise<void>>();
		const gateFor = (page: number): Promise<void> => {
			const existing = pending.get(page);
			if (existing) return existing;
			const gate = new Promise<void>((resolve) => {
				gates.set(page, resolve);
			});
			pending.set(page, gate);
			return gate;
		};
		const release = async (page: number): Promise<void> => {
			gateFor(page);
			gates.get(page)?.();
			for (let index = 0; index < 8; index += 1) await Promise.resolve();
		};

		const client = createQueryClient();
		const result = useInfiniteQuery({
			queryKey: ['items'],
			queryFn: async ({ pageParam }) => {
				await gateFor(pageParam as number);
				return [{ id: pageParam }];
			},
			initialPageParam: 1,
			getNextPageParam: (_lastPage, allPages) =>
				allPages.length < 2 ? allPages.length + 1 : undefined,
			client,
		});

		await release(1);
		expect(result.data.value?.pages).toHaveLength(1);

		const nextPromise = result.fetchNextPage();
		// Page two is provably unresolved: its gate has not been opened.
		for (let index = 0; index < 8; index += 1) await Promise.resolve();
		expect(result.isFetchingNextPage.value).toBe(true);
		expect(result.isFetching.value).toBe(true);

		await release(2);
		await nextPromise;
		expect(result.isFetchingNextPage.value).toBe(false);
		expect(result.isFetching.value).toBe(false);
		expect(result.data.value?.pages).toHaveLength(2);
	});

	it('fetches previous page and prepends to data', async () => {
		const client = createQueryClient();
		const result = useInfiniteQuery({
			queryKey: ['items'],
			queryFn: async ({ pageParam }) => [{ id: pageParam }],
			initialPageParam: 2,
			getNextPageParam: () => undefined,
			getPreviousPageParam: (_firstPage, allPages) =>
				allPages.length < 2 ? 1 : undefined,
			client,
		});

		await new Promise((resolve) => setTimeout(resolve, 10));
		expect(result.data.value?.pages).toHaveLength(1);

		await result.fetchPreviousPage();
		expect(result.data.value?.pages).toHaveLength(2);
		expect(result.data.value?.pages[0]).toEqual([{ id: 1 }]);
	});

	it('handles errors and tracks failure count', async () => {
		const client = createQueryClient();
		const result = useInfiniteQuery({
			queryKey: ['items'],
			queryFn: async () => {
				throw new Error('fail');
			},
			initialPageParam: 1,
			getNextPageParam: () => undefined,
			retry: 0,
			client,
		});

		await new Promise((resolve) => setTimeout(resolve, 10));

		expect(result.status.value).toBe('error');
		expect(result.isError.value).toBe(true);
		expect(result.error.value).toBeInstanceOf(Error);
		expect(result.failureCount.value).toBe(1);
		expect(result.failureReason.value).toBeInstanceOf(Error);
		expect(result.errorUpdatedAt.value).toBeDefined();
	});

	it('retries and eventually succeeds', async () => {
		let attempts = 0;
		const client = createQueryClient();
		const result = useInfiniteQuery({
			queryKey: ['items'],
			queryFn: async () => {
				attempts++;
				if (attempts < 3) throw new Error('retry');
				return [{ id: 1 }];
			},
			initialPageParam: 1,
			getNextPageParam: () => undefined,
			retry: 2,
			retryDelay: 10,
			client,
		});

		await new Promise((resolve) => setTimeout(resolve, 100));

		expect(result.status.value).toBe('success');
		expect(attempts).toBe(3);
		expect(result.failureCount.value).toBe(0);
	});

	it('cancels in-flight fetch', async () => {
		const client = createQueryClient();
		const result = useInfiniteQuery({
			queryKey: ['items'],
			queryFn: async ({ signal }) => {
				await new Promise((resolve, reject) => {
					signal.addEventListener('abort', () => reject(new Error('cancelled')));
					setTimeout(resolve, 100);
				});
				return [{ id: 1 }];
			},
			initialPageParam: 1,
			getNextPageParam: () => undefined,
			client,
		});

		await new Promise((resolve) => setTimeout(resolve, 10));
		result.cancel();

		await new Promise((resolve) => setTimeout(resolve, 10));
		expect(result.fetchStatus.value).toBe('idle');
	});

	it('uses initialData when provided', () => {
		const client = createQueryClient();
		const initialData = {
			pages: [[{ id: 1 }]],
			pageParams: [1],
		};

		const result = useInfiniteQuery({
			queryKey: ['items'],
			queryFn: async () => [{ id: 2 }],
			initialPageParam: 1,
			getNextPageParam: () => undefined,
			initialData,
			client,
		});

		expect(result.status.value).toBe('success');
		expect(result.data.value).toEqual(initialData);
		expect(result.isPlaceholderData.value).toBe(false);
	});

	it('uses placeholderData when no initialData', () => {
		const client = createQueryClient();
		const placeholderData = {
			pages: [[{ id: 99 }]],
			pageParams: [99],
		};

		const result = useInfiniteQuery({
			queryKey: ['items'],
			queryFn: async () => [{ id: 1 }],
			initialPageParam: 1,
			getNextPageParam: () => undefined,
			placeholderData,
			enabled: false,
			client,
		});

		expect(result.data.value).toEqual(placeholderData);
		expect(result.isPlaceholderData.value).toBe(true);
	});

	it('applies select function to transform data', async () => {
		const client = createQueryClient();
		const result = useInfiniteQuery({
			queryKey: ['items'],
			queryFn: async ({ pageParam }) => ({ items: [{ id: pageParam }] }),
			initialPageParam: 1,
			getNextPageParam: () => undefined,
			select: (data) => ({
				pages: data.pages.map((page) => page.items),
				pageParams: data.pageParams,
			}),
			client,
		});

		await new Promise((resolve) => setTimeout(resolve, 10));

		expect(result.data.value?.pages).toEqual([[{ id: 1 }]]);
	});

	it('respects maxPages limit', async () => {
		const client = createQueryClient();
		const result = useInfiniteQuery({
			queryKey: ['items'],
			queryFn: async ({ pageParam }) => [{ id: pageParam }],
			initialPageParam: 1,
			getNextPageParam: (_lastPage, allPages) => allPages.length + 1,
			maxPages: 2,
			client,
		});

		await new Promise((resolve) => setTimeout(resolve, 10));
		await result.fetchNextPage();
		await result.fetchNextPage();
		await result.fetchNextPage();

		expect(result.data.value?.pages).toHaveLength(2);
	});

	it('refetches from initial page', async () => {
		const client = createQueryClient();
		let pageParam = 0;
		const result = useInfiniteQuery({
			queryKey: ['items'],
			queryFn: async ({ pageParam }) => {
				return [{ id: pageParam }];
			},
			initialPageParam: 1,
			getNextPageParam: (_lastPage, allPages) =>
				allPages.length < 2 ? allPages.length + 1 : undefined,
			client,
		});

		await new Promise((resolve) => setTimeout(resolve, 10));
		await result.fetchNextPage();
		expect(result.data.value?.pages).toHaveLength(2);

		await result.refetch();
		expect(result.data.value?.pages).toHaveLength(1);
		expect(result.data.value?.pages[0]).toEqual([{ id: 1 }]);
	});

	it('restores from cache on subsequent hook creation', async () => {
		const client = createQueryClient();

		const result1 = useInfiniteQuery({
			queryKey: ['items'],
			queryFn: async ({ pageParam }) => [{ id: pageParam }],
			initialPageParam: 1,
			getNextPageParam: () => undefined,
			client,
		});

		await new Promise((resolve) => setTimeout(resolve, 10));
		expect(result1.status.value).toBe('success');

		const result2 = useInfiniteQuery({
			queryKey: ['items'],
			queryFn: async ({ pageParam }) => [{ id: pageParam }],
			initialPageParam: 1,
			getNextPageParam: () => undefined,
			client,
		});

		expect(result2.status.value).toBe('success');
		expect(result2.data.value?.pages).toEqual([[{ id: 1 }]]);
	});
});
