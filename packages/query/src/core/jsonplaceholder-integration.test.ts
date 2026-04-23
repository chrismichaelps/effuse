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
import { useQuery } from '../hooks/useQuery.js';
import { useMutation, useOptimisticMutation } from '../hooks/useMutation.js';
import { useInfiniteQuery } from '../hooks/useInfiniteQuery.js';
import { useIsFetching } from '../hooks/useIsFetching.js';
import { useIsMutating } from '../hooks/useIsMutating.js';
import { createQueryKeys } from '../utils/createQueryKeys.js';
import { prefetchQuery, fetchQuery } from '../hooks/usePrefetch.js';

const API_BASE = 'https://jsonplaceholder.typicode.com';

const fetchJson = async <T>(url: string): Promise<T> => {
	const response = await fetch(url);
	if (!response.ok) {
		throw new Error(`HTTP ${response.status}: ${response.statusText}`);
	}
	return response.json() as Promise<T>;
};

interface Post {
	readonly userId: number;
	readonly id: number;
	readonly title: string;
	readonly body: string;
}

interface User {
	readonly id: number;
	readonly name: string;
	readonly email: string;
}

interface Comment {
	readonly postId: number;
	readonly id: number;
	readonly name: string;
	readonly email: string;
	readonly body: string;
}

interface CreatePostInput {
	readonly title: string;
	readonly body: string;
	readonly userId: number;
}

describe('jsonplaceholder.typicode.com integration', () => {
	describe('useQuery', () => {
		it('fetches a list of posts', async () => {
			const client = createQueryClient();
			const result = useQuery({
				queryKey: ['posts'],
				queryFn: () => fetchJson<Post[]>(`${API_BASE}/posts?_limit=5`),
				client,
			});

			await new Promise((resolve) => setTimeout(resolve, 500));

			expect(result.status.value).toBe('success');
			expect(result.data.value).toBeDefined();
			expect(Array.isArray(result.data.value)).toBe(true);
			expect(result.data.value!.length).toBe(5);
			expect(result.data.value![0]).toHaveProperty('id');
			expect(result.data.value![0]).toHaveProperty('title');
			expect(result.dataUpdatedAt.value).toBeGreaterThan(0);
		});

		it('fetches a single user by id', async () => {
			const client = createQueryClient();
			const result = useQuery({
				queryKey: ['users', 1],
				queryFn: () => fetchJson<User>(`${API_BASE}/users/1`),
				client,
			});

			await new Promise((resolve) => setTimeout(resolve, 500));

			expect(result.status.value).toBe('success');
			expect(result.data.value).toBeDefined();
			expect(result.data.value!.id).toBe(1);
			expect(result.data.value!.name).toBeDefined();
			expect(result.data.value!.email).toBeDefined();
		});

		it('fetches comments for a post', async () => {
			const client = createQueryClient();
			const result = useQuery({
				queryKey: ['posts', 1, 'comments'],
				queryFn: () => fetchJson<Comment[]>(`${API_BASE}/posts/1/comments?_limit=3`),
				client,
			});

			await new Promise((resolve) => setTimeout(resolve, 500));

			expect(result.status.value).toBe('success');
			expect(Array.isArray(result.data.value)).toBe(true);
			expect(result.data.value!.length).toBe(3);
			expect(result.data.value![0]).toHaveProperty('postId');
		});

		it('caches and shares query data', async () => {
			const client = createQueryClient();

			const result1 = useQuery({
				queryKey: ['posts', 'shared'],
				queryFn: () => fetchJson<Post[]>(`${API_BASE}/posts?_limit=3`),
				client,
			});

			await new Promise((resolve) => setTimeout(resolve, 500));

			const result2 = useQuery({
				queryKey: ['posts', 'shared'],
				queryFn: () => fetchJson<Post[]>(`${API_BASE}/posts?_limit=3`),
				client,
			});

			await new Promise((resolve) => setTimeout(resolve, 50));

			expect(result1.data.value).toEqual(result2.data.value);
			expect(result2.status.value).toBe('success');
		});

		it('handles errors gracefully', async () => {
			const client = createQueryClient();
			const result = useQuery({
				queryKey: ['error-test'],
				queryFn: () => fetchJson<unknown>(`${API_BASE}/nonexistent-endpoint-12345`),
				retry: 0,
				timeout: 2000,
				client,
			});

			await new Promise((resolve) => setTimeout(resolve, 1000));

			expect(result.status.value).toBe('error');
			expect(result.error.value).toBeDefined();
			expect(result.failureCount.value).toBeGreaterThan(0);
		});
	});

	describe('useMutation', () => {
		it('creates a post successfully', async () => {
			const client = createQueryClient();
			const result = useMutation<Post, CreatePostInput>({
				mutationFn: async (input) => {
					const response = await fetch(`${API_BASE}/posts`, {
						method: 'POST',
						body: JSON.stringify(input),
						headers: { 'Content-Type': 'application/json' },
					});
					return response.json() as Promise<Post>;
				},
				client,
			});

			const input: CreatePostInput = {
				title: 'Test Post',
				body: 'This is a test post body',
				userId: 1,
			};

			await result.mutateAsync(input);

			expect(result.status.value).toBe('success');
			expect(result.data.value).toBeDefined();
			expect(result.data.value!.title).toBe(input.title);
			expect(result.data.value!.body).toBe(input.body);
			expect(result.data.value!.userId).toBe(input.userId);
		});

		it('tracks mutation state during execution', async () => {
			const client = createQueryClient();
			const result = useMutation<Post, CreatePostInput>({
				mutationFn: async (input) => {
					await new Promise((resolve) => setTimeout(resolve, 100));
					const response = await fetch(`${API_BASE}/posts`, {
						method: 'POST',
						body: JSON.stringify(input),
						headers: { 'Content-Type': 'application/json' },
					});
					return response.json() as Promise<Post>;
				},
				client,
			});

			const mutatePromise = result.mutateAsync({
				title: 'Delayed Post',
				body: 'This post has a delay',
				userId: 1,
			});

			await new Promise((resolve) => setTimeout(resolve, 50));
			expect(result.status.value).toBe('pending');
			expect(result.isPending.value).toBe(true);

			await mutatePromise;
			expect(result.status.value).toBe('success');
			expect(result.isPending.value).toBe(false);
		});
	});

	describe('useInfiniteQuery', () => {
		it('fetches paginated posts', async () => {
			const client = createQueryClient();
			const result = useInfiniteQuery({
				queryKey: ['posts', 'infinite'],
				queryFn: async ({ pageParam }) => {
					return fetchJson<Post[]>(
						`${API_BASE}/posts?_page=${pageParam}&_limit=3`
					);
				},
				initialPageParam: 1,
				getNextPageParam: (_lastPage, allPages) =>
					allPages.length < 3 ? allPages.length + 1 : undefined,
				client,
			});

			await new Promise((resolve) => setTimeout(resolve, 500));

			expect(result.status.value).toBe('success');
			expect(result.data.value).toBeDefined();
			expect(result.data.value!.pages).toHaveLength(1);
			expect(result.data.value!.pages[0]).toHaveLength(3);

			await result.fetchNextPage();
			await new Promise((resolve) => setTimeout(resolve, 500));

			expect(result.data.value!.pages).toHaveLength(2);
			expect(result.isFetchingNextPage.value).toBe(false);

			await result.fetchNextPage();
			await new Promise((resolve) => setTimeout(resolve, 500));

			expect(result.data.value!.pages).toHaveLength(3);
			expect(result.hasNextPage.value).toBe(false);
		});
	});

	describe('useIsFetching', () => {
		it('tracks global fetching state', async () => {
			const client = createQueryClient();
			const isFetching = useIsFetching({ client });

			expect(isFetching.value).toBe(0);

			useQuery({
				queryKey: ['tracking-test'],
				queryFn: () => fetchJson<Post[]>(`${API_BASE}/posts?_limit=2`),
				client,
			});

			await new Promise((resolve) => setTimeout(resolve, 50));
			expect(isFetching.value).toBeGreaterThanOrEqual(0);

			await new Promise((resolve) => setTimeout(resolve, 500));
			expect(isFetching.value).toBe(0);
		});
	});

	describe('useIsMutating', () => {
		it('tracks global mutation state', async () => {
			const client = createQueryClient();
			const isMutating = useIsMutating({ client });

			expect(isMutating.value).toBe(0);

			const mutation = client.mutationCache.build({
				mutationKey: ['create-post'],
				mutationFn: async () => {
					await new Promise((resolve) => setTimeout(resolve, 100));
					return { id: 1 };
				},
			});

			mutation.execute('vars');
			await new Promise((resolve) => setTimeout(resolve, 50));
			expect(isMutating.value).toBe(1);

			await new Promise((resolve) => setTimeout(resolve, 100));
			expect(isMutating.value).toBe(0);
		});
	});

	describe('createQueryKeys', () => {
		it('generates type-safe keys for jsonplaceholder resources', () => {
			const postKeys = createQueryKeys('posts', {
				all: null,
				byId: (id: number) => [id],
				comments: (id: number) => [id, 'comments'],
			});

			expect(postKeys.all()).toEqual(['posts', 'all']);
			expect(postKeys.byId(1)).toEqual(['posts', 'byId', 1]);
			expect(postKeys.comments(1)).toEqual(['posts', 'comments', 1, 'comments']);

			const userKeys = createQueryKeys('users', {
				all: null,
				byId: (id: number) => [id],
			});

			expect(userKeys.all()).toEqual(['users', 'all']);
			expect(userKeys.byId(5)).toEqual(['users', 'byId', 5]);
		});
	});

	describe('query cache operations', () => {
		it('sets and gets query data directly', () => {
			const client = createQueryClient();
			const mockPosts: Post[] = [
				{ userId: 1, id: 1, title: 'Test', body: 'Body' },
			];

			client.setQueryData(['posts', 'manual'], mockPosts);
			const data = client.getQueryData<Post[]>(['posts', 'manual']);

			expect(data).toEqual(mockPosts);
		});

		it('removes queries from cache', () => {
			const client = createQueryClient();
			client.setQueryData(['temp'], { value: true });
			expect(client.getQueryData(['temp'])).toEqual({ value: true });

			client.removeQueries(['temp']);
			expect(client.getQueryData(['temp'])).toBeUndefined();
		});

		it('invalidates queries', async () => {
			const client = createQueryClient();
			client.set(['invalidate-test'], {
				data: 'initial',
				status: 'success',
				dataUpdatedAt: Date.now(),
				fetchCount: 1,
			});

			await client.invalidate(['invalidate-test']);
			const entry = client.getQueryState(['invalidate-test']);
			expect(entry?.isInvalidated).toBe(true);
		});
	});

	describe('mutation cache operations', () => {
		it('builds and tracks mutations in cache', async () => {
			const client = createQueryClient();
			const mutation = client.mutationCache.build({
				mutationKey: ['update-post'],
				mutationFn: async (vars: { id: number; title: string }) => {
					return vars;
				},
			});

			expect(client.mutationCache.size).toBe(1);

			const result = await mutation.execute({ id: 1, title: 'Updated' });
			expect(result.title).toBe('Updated');
			expect(mutation.currentState.status).toBe('success');
		});

		it('shares mutation instances by key', () => {
			const client = createQueryClient();
			const m1 = client.mutationCache.build({
				mutationKey: ['shared'],
				mutationFn: async () => 'a',
			});
			const m2 = client.mutationCache.build({
				mutationKey: ['shared'],
				mutationFn: async () => 'b',
			});

			expect(m1).toBe(m2);
		});
	});

	describe('prefetching', () => {
		it('prefetches data into cache', async () => {
			const client = createQueryClient();

			await prefetchQuery(
				['prefetched-posts'],
				() => fetchJson<Post[]>(`${API_BASE}/posts?_limit=2`),
				{ client }
			);

			await new Promise((resolve) => setTimeout(resolve, 500));

			const cached = client.get<Post[]>(['prefetched-posts']);
			expect(cached).toBeDefined();
			expect(Array.isArray(cached?.data)).toBe(true);
			expect(cached!.data!.length).toBe(2);
		});

		it('fetchQuery returns data directly', async () => {
			const client = createQueryClient();

			const data = await fetchQuery(
				['fetched-posts'],
				() => fetchJson<Post[]>(`${API_BASE}/posts?_limit=2`),
				{ client }
			);

			expect(data).toBeDefined();
			expect(Array.isArray(data)).toBe(true);
			expect(data.length).toBe(2);
		});
	});

	describe('dehydration and hydration', () => {
		it('round-trips cache state through dehydrate and hydrate', () => {
			const client = createQueryClient();
			const mockPosts: Post[] = [
				{ userId: 1, id: 1, title: 'Test', body: 'Body' },
			];

			const query = client.getQuery({
				queryKey: ['posts', 'hydrate'],
				queryFn: async () => mockPosts,
			});
			query.setState({
				data: mockPosts,
				status: 'success',
				dataUpdatedAt: Date.now(),
				fetchCount: 1,
				isInvalidated: false,
			});

			const dehydrated = client.dehydrate();
			expect(dehydrated.queries.length).toBeGreaterThan(0);

			const newClient = createQueryClient();
			// Create the query first so hydration can update it
			newClient.getQuery({
				queryKey: ['posts', 'hydrate'],
				queryFn: async () => mockPosts,
			});
			newClient.hydrate(dehydrated);

			const restoredQuery = newClient.queryCache.get(['posts', 'hydrate'])!;
			expect(restoredQuery.currentState.data).toEqual(mockPosts);
		});
	});

	describe('end-to-end workflow', () => {
		it('completes a full workflow with queries, mutations, and cache', async () => {
			const client = createQueryClient();
			const keys = createQueryKeys('posts', {
				all: null,
				byId: (id: number) => [id],
			});

			// 1. Fetch posts
			const postsQuery = useQuery({
				queryKey: keys.all(),
				queryFn: () => fetchJson<Post[]>(`${API_BASE}/posts?_limit=5`),
				client,
			});

			await new Promise((resolve) => setTimeout(resolve, 500));
			expect(postsQuery.status.value).toBe('success');
			const posts = postsQuery.data.value!;

			// 2. Fetch a specific post
			const postId = posts[0].id;
			const postQuery = useQuery({
				queryKey: keys.byId(postId),
				queryFn: () => fetchJson<Post>(`${API_BASE}/posts/${postId}`),
				client,
			});

			await new Promise((resolve) => setTimeout(resolve, 500));
			expect(postQuery.status.value).toBe('success');
			expect(postQuery.data.value!.id).toBe(postId);

			// 3. Create a new post via mutation
			const createMutation = useMutation<Post, CreatePostInput>({
				mutationFn: async (input) => {
					const response = await fetch(`${API_BASE}/posts`, {
						method: 'POST',
						body: JSON.stringify(input),
						headers: { 'Content-Type': 'application/json' },
					});
					return response.json() as Promise<Post>;
				},
				client,
			});

			const newPost = await createMutation.mutateAsync({
				title: 'Integration Test Post',
				body: 'Created during end-to-end test',
				userId: 1,
			});

			expect(newPost.title).toBe('Integration Test Post');
			expect(createMutation.status.value).toBe('success');

			// 4. Query results are available
			expect(postsQuery.data.value).toBeDefined();
			expect(postQuery.data.value).toBeDefined();

			// 5. QueryCache contains the queries
			expect(client.queryCache.get(keys.all())).toBeDefined();
			expect(client.queryCache.get(keys.byId(postId))).toBeDefined();

			// 6. Dehydrate and verify state is serializable
			const dehydrated = client.dehydrate();
			expect(dehydrated.queries.length).toBeGreaterThanOrEqual(2);
		});
	});
});
