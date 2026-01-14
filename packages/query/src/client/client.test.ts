import { describe, it, expect, vi } from 'vitest';
import { createQueryClient, getGlobalQueryClient } from './client.js';
import { Effect } from 'effect';

describe('QueryClient Integration', () => {
	it('should be able to set and get cache entries', () => {
		const client = createQueryClient();
		const key = ['test', 1];
		const data = { id: 1, name: 'Test' };

		client.set(key, {
			data,
			status: 'success',
			dataUpdatedAt: Date.now(),
			fetchCount: 0,
		});

		const entry = client.get(key);
		expect(entry).toBeDefined();
		expect(entry?.data).toEqual(data);
	});

	it('should prefetch data correctly', async () => {
		const client = createQueryClient();
		const key = ['users'];
		const fetchFn = vi.fn().mockResolvedValue(['alice', 'bob']);

		await Effect.runPromise(client.prefetch(key, fetchFn));

		expect(fetchFn).toHaveBeenCalled();
		const entry = client.get(key);
		expect(entry?.data).toEqual(['alice', 'bob']);
		expect(entry?.status).toBe('success');
	});

	it('should not prefetch if data is fresh', async () => {
		const client = createQueryClient();
		const key = ['users'];
		const fetchFn = vi.fn().mockResolvedValue(['alice', 'bob']);

		client.set(key, {
			data: ['existing'],
			status: 'success',
			dataUpdatedAt: Date.now(),
			fetchCount: 1,
		});

		await Effect.runPromise(client.prefetch(key, fetchFn, 5000)); // 5s stale time

		expect(fetchFn).not.toHaveBeenCalled();
	});

	it('should handle optimistic updates and rollback', () => {
		const client = createQueryClient();
		const key = ['todo', 1];

		client.set(key, {
			data: 'original',
			status: 'success',
			dataUpdatedAt: Date.now(),
			fetchCount: 1,
		});

		const prev = client.setOptimistic(key, 'optimistic');

		expect(client.get(key)?.data).toBe('optimistic');
		expect(prev?.data).toBe('original');

		if (prev) {
			client.rollback(key, prev);
		}

		expect(client.get(key)?.data).toBe('original');
	});

	it('should invalidate queries matching a pattern', async () => {
		const client = createQueryClient();

		client.set(['todos', 1], {
			data: '1',
			dataUpdatedAt: Date.now(),
			status: 'success',
			fetchCount: 1,
		});
		client.set(['todos', 2], {
			data: '2',
			dataUpdatedAt: Date.now(),
			status: 'success',
			fetchCount: 1,
		});
		client.set(['users', 1], {
			data: 'u1',
			dataUpdatedAt: Date.now(),
			status: 'success',
			fetchCount: 1,
		});

		await Effect.runPromise(client.invalidateQueries(['todos']));

		expect(client.has(['todos', 1])).toBe(false);
		expect(client.has(['todos', 2])).toBe(false);
		expect(client.has(['users', 1])).toBe(true);
	});

	it('should get global query client singleton', () => {
		const client1 = getGlobalQueryClient();
		const client2 = getGlobalQueryClient();
		expect(client1).toBe(client2);
	});
});
