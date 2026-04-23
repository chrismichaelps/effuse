import { describe, it, expect, vi } from 'vitest';
import { createQueryClient, getGlobalQueryClient } from './client.js';

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

		await client.prefetch(key, fetchFn);

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

		await client.prefetch(key, fetchFn, 5000); // 5s stale time

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

	it('should invalidate queries matching a pattern without deleting', async () => {
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

		await client.invalidateQueries(['todos']);

		expect(client.has(['todos', 1])).toBe(true);
		expect(client.get(['todos', 1])?.isInvalidated).toBe(true);
		expect(client.has(['todos', 2])).toBe(true);
		expect(client.get(['todos', 2])?.isInvalidated).toBe(true);
		expect(client.has(['users', 1])).toBe(true);
		expect(client.get(['users', 1])?.isInvalidated).toBeFalsy();
	});

	it('should get global query client singleton', () => {
		const client1 = getGlobalQueryClient();
		const client2 = getGlobalQueryClient();
		expect(client1).toBe(client2);
	});

	describe('imperative cache API', () => {
		it('setQueryData should write data directly', () => {
			const client = createQueryClient();
			const key = ['post', 1];

			client.setQueryData(key, { title: 'Hello' });
			expect(client.getQueryData(key)).toEqual({ title: 'Hello' });
			expect(client.getQueryState(key)?.status).toBe('success');
		});

		it('setQueryData should support updater function', () => {
			const client = createQueryClient();
			const key = ['counter'];

			client.setQueryData(key, 0);
			client.setQueryData(key, (old) => (old ?? 0) + 1);
			expect(client.getQueryData(key)).toBe(1);
		});

		it('setQueryData should preserve fetchCount', () => {
			const client = createQueryClient();
			const key = ['item'];

			client.set(key, {
				data: 'a',
				status: 'success',
				dataUpdatedAt: Date.now(),
				fetchCount: 5,
			});

			client.setQueryData(key, 'b');
			expect(client.getQueryState(key)?.fetchCount).toBe(5);
		});

		it('getQueryData should return undefined for missing key', () => {
			const client = createQueryClient();
			expect(client.getQueryData(['missing'])).toBeUndefined();
		});

		it('removeQueries should delete matching entries by prefix', () => {
			const client = createQueryClient();
			client.setQueryData(['todos', 1], 'a');
			client.setQueryData(['todos', 2], 'b');
			client.setQueryData(['users', 1], 'c');

			client.removeQueries(['todos']);

			expect(client.has(['todos', 1])).toBe(false);
			expect(client.has(['todos', 2])).toBe(false);
			expect(client.has(['users', 1])).toBe(true);
		});
	});
});
