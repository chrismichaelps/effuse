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
import { Query, QueryObserver, QueryCache } from '../core/index.js';

const BASE_URL = 'https://jsonplaceholder.typicode.com';

const fetchPosts = async ({ signal }: { signal: AbortSignal }) => {
	const response = await fetch(`${BASE_URL}/posts`, { signal });
	if (!response.ok) throw new Error(`HTTP ${response.status}`);
	return response.json() as Promise<Array<{ id: number; title: string }>>;
};

const fetchPost = async (id: number, { signal }: { signal: AbortSignal }) => {
	const response = await fetch(`${BASE_URL}/posts/${id}`, { signal });
	if (!response.ok) throw new Error(`HTTP ${response.status}`);
	return response.json() as Promise<{ id: number; title: string; body: string }>;
};

const fetchUsers = async ({ signal }: { signal: AbortSignal }) => {
	const response = await fetch(`${BASE_URL}/users`, { signal });
	if (!response.ok) throw new Error(`HTTP ${response.status}`);
	return response.json() as Promise<
		Array<{ id: number; name: string; email: string }>
	>;
};

describe('Query — real-world integration (jsonplaceholder.typicode.com)', () => {
	describe('basic fetch', () => {
		it('should fetch posts successfully', async () => {
			const query = new Query({
				queryKey: ['posts'],
				queryFn: fetchPosts,
				retry: false,
			});

			const data = await query.fetch();
			expect(Array.isArray(data)).toBe(true);
			expect(data.length).toBeGreaterThan(0);
			expect(data[0]).toHaveProperty('id');
			expect(data[0]).toHaveProperty('title');
			expect(query.currentState.status).toBe('success');
			expect(query.currentState.fetchCount).toBe(1);
		});

		it('should fetch a single post', async () => {
			const query = new Query({
				queryKey: ['post', 1],
				queryFn: ({ signal }: { signal: AbortSignal }) => fetchPost(1, { signal }),
				retry: false,
			});

			const data = await query.fetch();
			expect(data.id).toBe(1);
			expect(data.title).toBeTruthy();
			expect(data.body).toBeTruthy();
		});

		it('should fetch users successfully', async () => {
			const query = new Query({
				queryKey: ['users'],
				queryFn: fetchUsers,
				retry: false,
			});

			const data = await query.fetch();
			expect(Array.isArray(data)).toBe(true);
			expect(data.length).toBeGreaterThan(0);
			expect(data[0]).toHaveProperty('name');
			expect(data[0]).toHaveProperty('email');
		});
	});

	describe('error handling', () => {
		it('should handle 404 gracefully', async () => {
			const query = new Query({
				queryKey: ['not-found'],
				queryFn: async ({ signal }: { signal: AbortSignal }) => {
					const response = await fetch(`${BASE_URL}/posts/999999`, { signal });
					if (!response.ok) throw new Error(`HTTP ${response.status}`);
					return response.json();
				},
				retry: false,
			});

			await expect(query.fetch()).rejects.toThrow();
			expect(query.currentState.status).toBe('error');
			expect(query.currentState.error).toBeTruthy();
		});

		it('should handle network-level failures', async () => {
			const query = new Query({
				queryKey: ['network-fail'],
				queryFn: async () => {
					const response = await fetch('https://this-domain-does-not-exist-12345.invalid');
					return response.json();
				},
				retry: false,
			});

			await expect(query.fetch()).rejects.toThrow();
			expect(query.currentState.status).toBe('error');
		});
	});

	describe('retry with real network', () => {
		it('should succeed after transient failure', async () => {
			let attempt = 0;
			const query = new Query({
				queryKey: ['retry-transient'],
				queryFn: async ({ signal }: { signal: AbortSignal }) => {
					attempt++;
					if (attempt < 2) {
						throw new Error('transient');
					}
					return fetchPosts({ signal });
				},
				retry: 2,
				retryDelay: 100,
			});

			const data = await query.fetch();
			expect(Array.isArray(data)).toBe(true);
			expect(attempt).toBe(2);
			expect(query.currentState.status).toBe('success');
		});
	});

	describe('AbortSignal cancellation', () => {
		it('should abort in-flight fetch', async () => {
			const query = new Query({
				queryKey: ['abort'],
				queryFn: async ({ signal }: { signal: AbortSignal }) => {
					await new Promise((resolve) => setTimeout(resolve, 200));
					if (signal.aborted) throw new Error('cancelled');
					return fetchPosts({ signal });
				},
				retry: false,
			});

			const fetchPromise = query.fetch();
			setTimeout(() => query.cancel(), 50);

			await expect(fetchPromise).rejects.toThrow('cancelled');
			expect(query.currentState.fetchStatus).toBe('idle');
		});
	});

	describe('concurrent fetch deduplication', () => {
		it('should only make one network request for concurrent fetches', async () => {
			let requestCount = 0;
			const query = new Query({
				queryKey: ['dedup'],
				queryFn: async ({ signal }: { signal: AbortSignal }) => {
					requestCount++;
					return fetchPosts({ signal });
				},
				retry: false,
			});

			const [r1, r2, r3] = await Promise.all([
				query.fetch(),
				query.fetch(),
				query.fetch(),
			]);

			expect(requestCount).toBe(1);
			expect(r1).toBe(r2);
			expect(r2).toBe(r3);
		});
	});

	describe('timeout with real network', () => {
		it('should timeout slow requests', async () => {
			const query = new Query({
				queryKey: ['timeout'],
				queryFn: async ({ signal }: { signal: AbortSignal }) => {
					await new Promise((resolve) => setTimeout(resolve, 500));
					if (signal.aborted) throw new Error('cancelled');
					return fetchPosts({ signal });
				},
				retry: false,
				timeout: 100,
			});

			await expect(query.fetch()).rejects.toThrow('timed out');
		});

		it('should succeed before timeout', async () => {
			const query = new Query({
				queryKey: ['no-timeout'],
				queryFn: fetchPosts,
				retry: false,
				timeout: 10000,
			});

			const data = await query.fetch();
			expect(Array.isArray(data)).toBe(true);
		});
	});

	describe('invalidation and refetch', () => {
		it('should mark stale after invalidation', async () => {
			const query = new Query({
				queryKey: ['invalidate'],
				queryFn: fetchPosts,
				staleTime: 60000,
				retry: false,
			});

			await query.fetch();
			expect(query.isStale).toBe(false);

			query.invalidate();
			expect(query.isStale).toBe(true);
			expect(query.currentState.isInvalidated).toBe(true);
		});

		it('should refetch after invalidation', async () => {
			const query = new Query({
				queryKey: ['refetch-after-invalidate'],
				queryFn: fetchPosts,
				staleTime: 60000,
				retry: false,
			});

			await query.fetch();
			const firstCount = query.currentState.fetchCount;

			query.invalidate();
			await query.fetch();

			expect(query.currentState.fetchCount).toBe(firstCount + 1);
			expect(query.currentState.status).toBe('success');
			expect(query.isStale).toBe(false);
		});
	});

	describe('structural sharing with real data', () => {
		it('should reuse reference on identical data', async () => {
			const query = new Query({
				queryKey: ['structural'],
				queryFn: fetchPosts,
				retry: false,
			});

			await query.fetch();
			const firstRef = query.currentState.data;

			// Fetch again — jsonplaceholder returns same data
			await query.fetch();
			const secondRef = query.currentState.data;

			expect(secondRef).toBe(firstRef);
		});
	});
});

describe('QueryObserver — real-world integration', () => {
	describe('observer with real fetch', () => {
		it('should produce result after fetch', async () => {
			const query = new Query({
				queryKey: ['observer-posts'],
				queryFn: fetchPosts,
				retry: false,
			});

			const observer = new QueryObserver(query, {
				queryKey: ['observer-posts'],
				queryFn: fetchPosts,
			});

			const listener = vi.fn();
			observer.subscribe(listener);

			await query.fetch();

			expect(listener).toHaveBeenCalled();
			const result = observer.getCurrentResult();
			expect(result.status).toBe('success');
			expect(Array.isArray(result.data)).toBe(true);
		});

		it('should memoize select with real data', async () => {
			const query = new Query({
				queryKey: ['select-memo'],
				queryFn: fetchPosts,
				retry: false,
			});

			const select = vi.fn((posts: Array<{ id: number; title: string }>) =>
				posts.map((p) => p.id)
			);

			const observer = new QueryObserver(query, {
				queryKey: ['select-memo'],
				queryFn: fetchPosts,
				select,
			});

			await query.fetch();
			expect(select).toHaveBeenCalledTimes(1);
			expect(observer.getCurrentResult().data).toBeInstanceOf(Array);

			// Fetch again with same data — select should not re-run
			await query.fetch();
			expect(select).toHaveBeenCalledTimes(1);
		});

		it('should use initialData before fetch', () => {
			const query = new Query({
				queryKey: ['initial'],
				queryFn: fetchPosts,
				retry: false,
			});

			const observer = new QueryObserver(query, {
				queryKey: ['initial'],
				queryFn: fetchPosts,
				initialData: [{ id: 0, title: 'seed' }],
			});

			const result = observer.getCurrentResult();
			expect(result.data).toEqual([{ id: 0, title: 'seed' }]);
			expect(result.status).toBe('success');
		});

		it('should replace initialData after fetch', async () => {
			const query = new Query({
				queryKey: ['replace-initial'],
				queryFn: fetchPosts,
				retry: false,
			});

			const observer = new QueryObserver(query, {
				queryKey: ['replace-initial'],
				queryFn: fetchPosts,
				initialData: [{ id: 0, title: 'seed' }],
			});

			expect(observer.getCurrentResult().data).toEqual([{ id: 0, title: 'seed' }]);

			await query.fetch();
			const result = observer.getCurrentResult();
			expect(result.data).not.toEqual([{ id: 0, title: 'seed' }]);
			expect(Array.isArray(result.data)).toBe(true);
			expect((result.data as Array<{ id: number }>).length).toBeGreaterThan(1);
		});

		it('should use placeholderData while loading', async () => {
			const query = new Query({
				queryKey: ['placeholder'],
				queryFn: fetchPosts,
				retry: false,
			});

			const observer = new QueryObserver(query, {
				queryKey: ['placeholder'],
				queryFn: fetchPosts,
				placeholderData: [{ id: 0, title: 'loading...' }],
			});

			const result = observer.getCurrentResult();
			expect(result.data).toEqual([{ id: 0, title: 'loading...' }]);
			expect(result.isPlaceholderData).toBe(true);
		});

		it('should track only selected props', async () => {
			const query = new Query({
				queryKey: ['track-props'],
				queryFn: fetchPosts,
				retry: false,
			});

			const observer = new QueryObserver(query, {
				queryKey: ['track-props'],
				queryFn: fetchPosts,
				notifyOnChangeProps: ['status'],
			});

			const listener = vi.fn();
			observer.subscribe(listener);

			await query.fetch();
			// Should be called because status changed from pending → success
			expect(listener).toHaveBeenCalledTimes(1);

			// Fetch again — data changes but status stays success
			await query.fetch();
			// Should NOT be called because status didn't change
			expect(listener).toHaveBeenCalledTimes(1);
		});
	});

	describe('multiple observers on same query', () => {
		it('should share query and notify both', async () => {
			const query = new Query({
				queryKey: ['shared'],
				queryFn: fetchPosts,
				retry: false,
			});

			const observer1 = new QueryObserver(query, {
				queryKey: ['shared'],
				queryFn: fetchPosts,
			});
			const observer2 = new QueryObserver(query, {
				queryKey: ['shared'],
				queryFn: fetchPosts,
				select: (posts: Array<{ id: number }>) => posts.length,
			});

			const listener1 = vi.fn();
			const listener2 = vi.fn();
			observer1.subscribe(listener1);
			observer2.subscribe(listener2);

			await query.fetch();

			expect(listener1).toHaveBeenCalled();
			expect(listener2).toHaveBeenCalled();
			expect(observer1.getCurrentResult().data).toBeInstanceOf(Array);
			expect(typeof observer2.getCurrentResult().data).toBe('number');
		});

		it('should only make one network request with multiple observers', async () => {
			let requestCount = 0;
			const query = new Query({
				queryKey: ['dedup-observers'],
				queryFn: async ({ signal }: { signal: AbortSignal }) => {
					requestCount++;
					return fetchPosts({ signal });
				},
				retry: false,
			});

			const observer1 = new QueryObserver(query, {
				queryKey: ['dedup-observers'],
				queryFn: query.options.queryFn,
			});
			const observer2 = new QueryObserver(query, {
				queryKey: ['dedup-observers'],
				queryFn: query.options.queryFn,
			});

			await Promise.all([observer1.refetch(), observer2.refetch()]);
			expect(requestCount).toBe(1);
		});
	});

	describe('observer error recovery', () => {
		it('should transition from error to success', async () => {
			let shouldFail = true;
			const query = new Query({
				queryKey: ['error-recovery'],
				queryFn: async ({ signal }: { signal: AbortSignal }) => {
					if (shouldFail) throw new Error('fail');
					return fetchPosts({ signal });
				},
				retry: false,
			});

			const observer = new QueryObserver(query, {
				queryKey: ['error-recovery'],
				queryFn: query.options.queryFn,
			});

			try {
				await query.fetch();
			} catch {
				// expected
			}
			expect(observer.getCurrentResult().status).toBe('error');

			shouldFail = false;
			await query.fetch();
			expect(observer.getCurrentResult().status).toBe('success');
			expect(observer.getCurrentResult().error).toBeNull();
		});
	});
});

describe('QueryCache — real-world integration', () => {
	describe('cache sharing', () => {
		it('should share queries by key', async () => {
			const cache = new QueryCache();

			const q1 = cache.getOrCreate({
				queryKey: ['cached-posts'],
				queryFn: fetchPosts,
				retry: false,
			});

			const q2 = cache.getOrCreate({
				queryKey: ['cached-posts'],
				queryFn: fetchPosts,
				retry: false,
			});

			expect(q1).toBe(q2);
		});

		it('should persist query state in cache', async () => {
			const cache = new QueryCache();

			const query = cache.getOrCreate({
				queryKey: ['persist'],
				queryFn: fetchPosts,
				retry: false,
			});

			await query.fetch();
			expect(query.currentState.status).toBe('success');

			// Get same query from cache
			const sameQuery = cache.get(['persist']);
			expect(sameQuery).toBe(query);
			expect(sameQuery?.currentState.status).toBe('success');
			expect(sameQuery?.currentState.data).toBe(query.currentState.data);
		});

		it('should remove queries from cache', () => {
			const cache = new QueryCache();

			cache.getOrCreate({
				queryKey: ['remove'],
				queryFn: fetchPosts,
				retry: false,
			});

			expect(cache.get(['remove'])).toBeDefined();
			cache.remove(['remove']);
			expect(cache.get(['remove'])).toBeUndefined();
		});

		it('should report all snapshots', async () => {
			const cache = new QueryCache();

			cache.getOrCreate({
				queryKey: ['snap1'],
				queryFn: fetchPosts,
				retry: false,
			});
			cache.getOrCreate({
				queryKey: ['snap2'],
				queryFn: fetchUsers,
				retry: false,
			});

			const snapshots = cache.getAllSnapshots();
			expect(snapshots).toHaveLength(2);
			expect(snapshots.map((s) => s.queryKey)).toContainEqual(['snap1']);
			expect(snapshots.map((s) => s.queryKey)).toContainEqual(['snap2']);
		});
	});

	describe('cache with observers', () => {
		it('should support multiple observers on cached query', async () => {
			const cache = new QueryCache();

			const query = cache.getOrCreate({
				queryKey: ['multi-observer'],
				queryFn: fetchPosts,
				retry: false,
			});

			const observer1 = new QueryObserver(query, {
				queryKey: ['multi-observer'],
				queryFn: fetchPosts,
			});
			const observer2 = new QueryObserver(query, {
				queryKey: ['multi-observer'],
				queryFn: fetchPosts,
			});

			const listener1 = vi.fn();
			const listener2 = vi.fn();
			observer1.subscribe(listener1);
			observer2.subscribe(listener2);

			await query.fetch();

			expect(listener1).toHaveBeenCalled();
			expect(listener2).toHaveBeenCalled();
			expect(query.observerCount).toBe(2);
		});
	});
});

describe('Regression tests — existing behavior preserved', () => {
	describe('Query', () => {
		it('should still create with initial pending state', () => {
			const query = new Query({
				queryKey: ['regression-pending'],
				queryFn: async () => 'data',
			});
			expect(query.currentState.status).toBe('pending');
			expect(query.currentState.fetchStatus).toBe('idle');
		});

		it('should still dispatch success action', () => {
			const query = new Query({
				queryKey: ['regression-success'],
				queryFn: async () => 'data',
			});
			query.dispatch({ type: 'success', data: 'hello' });
			expect(query.currentState.status).toBe('success');
			expect(query.currentState.data).toBe('hello');
		});

		it('should still track observer count', () => {
			const query = new Query({
				queryKey: ['regression-observers'],
				queryFn: async () => 'data',
			});
			const observer = { onQueryUpdate: vi.fn() };
			const unsub = query.addObserver(observer);
			expect(query.observerCount).toBe(1);
			unsub();
			expect(query.observerCount).toBe(0);
		});

		it('should still deduplicate fetches', async () => {
			let calls = 0;
			const query = new Query({
				queryKey: ['regression-dedup'],
				queryFn: async () => {
					calls++;
					await new Promise((r) => setTimeout(r, 20));
					return 'result';
				},
				retry: false,
			});

			await Promise.all([query.fetch(), query.fetch()]);
			expect(calls).toBe(1);
		});
	});

	describe('QueryObserver', () => {
		it('should still compute isPending initially', () => {
			const query = new Query({
				queryKey: ['regression-isPending'],
				queryFn: async () => 'data',
			});
			const observer = new QueryObserver(query, {
				queryKey: ['regression-isPending'],
				queryFn: async () => 'data',
			});
			expect(observer.getCurrentResult().isPending).toBe(true);
		});

		it('should still notify on state change', async () => {
			const query = new Query({
				queryKey: ['regression-notify'],
				queryFn: async () => 'data',
				retry: false,
			});
			const observer = new QueryObserver(query, {
				queryKey: ['regression-notify'],
				queryFn: async () => 'data',
			});

			const listener = vi.fn();
			observer.subscribe(listener);
			await query.fetch();
			expect(listener).toHaveBeenCalled();
		});

		it('should still support initialData', () => {
			const query = new Query({
				queryKey: ['regression-initial'],
				queryFn: async () => 'fetched',
			});
			const observer = new QueryObserver(query, {
				queryKey: ['regression-initial'],
				queryFn: async () => 'fetched',
				initialData: 'seed',
			});
			expect(observer.getCurrentResult().data).toBe('seed');
			expect(observer.getCurrentResult().status).toBe('success');
		});

		it('should still prefer cached data over initialData', () => {
			const query = new Query({
				queryKey: ['regression-prefer-cache'],
				queryFn: async () => 'fetched',
			});
			query.dispatch({ type: 'success', data: 'cached' });

			const observer = new QueryObserver(query, {
				queryKey: ['regression-prefer-cache'],
				queryFn: async () => 'fetched',
				initialData: 'seed',
			});
			expect(observer.getCurrentResult().data).toBe('cached');
		});

		it('should still handle select errors', () => {
			const query = new Query({
				queryKey: ['regression-select-error'],
				queryFn: async () => 'data',
			});
			query.dispatch({ type: 'success', data: 'data' });

			const observer = new QueryObserver(query, {
				queryKey: ['regression-select-error'],
				queryFn: async () => 'data',
				select: () => {
					throw new Error('select boom');
				},
			});
			expect(observer.getCurrentResult().status).toBe('error');
			expect(observer.getCurrentResult().error?.message).toBe('select boom');
		});
	});

	describe('QueryCache', () => {
		it('should still create queries on demand', () => {
			const cache = new QueryCache();
			const query = cache.getOrCreate({
				queryKey: ['regression-create'],
				queryFn: async () => 'data',
			});
			expect(query).toBeInstanceOf(Query);
		});

		it('should still return same query for same key', () => {
			const cache = new QueryCache();
			const q1 = cache.getOrCreate({
				queryKey: ['regression-same'],
				queryFn: async () => 'data',
			});
			const q2 = cache.getOrCreate({
				queryKey: ['regression-same'],
				queryFn: async () => 'data',
			});
			expect(q1).toBe(q2);
		});
	});
});
