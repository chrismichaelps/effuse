import { describe, it, expect, vi } from 'vitest';
import { createQueryClient } from './client.js';

describe('QueryFilters API', () => {
	const setupClient = () => {
		const client = createQueryClient();
		client.set(['todos'], {
			data: 'todos-list',
			status: 'success',
			dataUpdatedAt: Date.now() - 10000,
			fetchCount: 1,
		});
		client.set(['todos', 1], {
			data: 't1',
			status: 'success',
			dataUpdatedAt: Date.now() - 10000, // stale
			fetchCount: 1,
		});
		client.set(['todos', 2], {
			data: 't2',
			status: 'success',
			dataUpdatedAt: Date.now(), // fresh
			fetchCount: 1,
		});
		client.set(['users', 1], {
			data: 'u1',
			status: 'success',
			dataUpdatedAt: Date.now() - 10000,
			fetchCount: 1,
		});
		return client;
	};

	it('invalidateQueries with exact key matching', async () => {
		const client = setupClient();
		await client.invalidateQueries({ queryKey: ['todos'], exact: true });

		expect(client.get(['todos'])?.isInvalidated).toBe(true);
		expect(client.get(['todos', 1])?.isInvalidated).toBeFalsy();
		expect(client.get(['todos', 2])?.isInvalidated).toBeFalsy();
	});

	it('invalidateQueries with predicate filtering', async () => {
		const client = setupClient();
		await client.invalidateQueries({
			predicate: (query) => query.queryKey[0] === 'todos',
		});

		expect(client.get(['todos', 1])?.isInvalidated).toBe(true);
		expect(client.get(['todos', 2])?.isInvalidated).toBe(true);
		expect(client.get(['users', 1])?.isInvalidated).toBeFalsy();
	});

	it('invalidateQueries with stale filter', async () => {
		const client = setupClient();
		await client.invalidateQueries({ stale: true });

		expect(client.get(['todos', 1])?.isInvalidated).toBe(true);
		expect(client.get(['todos', 2])?.isInvalidated).toBeFalsy(); // fresh
		expect(client.get(['users', 1])?.isInvalidated).toBe(true);
	});

	it('invalidateQueries with refetchType none', async () => {
		const client = setupClient();
		const cb = vi.fn();
		client.subscribe(['todos', 1], cb);

		await client.invalidateQueries({
			queryKey: ['todos'],
			refetchType: 'none',
		});

		expect(client.get(['todos', 1])?.isInvalidated).toBe(true);
		expect(cb).not.toHaveBeenCalled();
	});

	it('invalidateQueries with refetchType active', async () => {
		const client = setupClient();
		const activeCb = vi.fn();
		const inactiveKey = ['todos', 2];

		client.subscribe(['todos', 1], activeCb);

		await client.invalidateQueries({
			queryKey: ['todos'],
			refetchType: 'active',
		});

		expect(activeCb).toHaveBeenCalled();
		// todos/2 has no subscribers, so it should not be notified
		expect(client.get(inactiveKey)?.isInvalidated).toBe(true);
	});

	it('refetchQueries notifies matching subscribers', () => {
		const client = setupClient();
		const cb1 = vi.fn();
		const cb2 = vi.fn();
		client.subscribe(['todos', 1], cb1);
		client.subscribe(['users', 1], cb2);

		client.refetchQueries({ queryKey: ['todos'] });

		expect(cb1).toHaveBeenCalled();
		expect(cb2).not.toHaveBeenCalled();
	});

	it('removeQueries with exact matching', () => {
		const client = setupClient();
		client.removeQueries({ queryKey: ['todos'], exact: true });

		expect(client.has(['todos'])).toBe(false);
		expect(client.has(['todos', 1])).toBe(true);
		expect(client.has(['todos', 2])).toBe(true);
	});

	it('removeQueries with predicate', () => {
		const client = setupClient();
		client.removeQueries({
			predicate: (query) => query.queryKey[0] === 'users',
		});

		expect(client.has(['users', 1])).toBe(false);
		expect(client.has(['todos', 1])).toBe(true);
		expect(client.has(['todos', 2])).toBe(true);
	});

	it('backward compatible: invalidateQueries accepts plain queryKey array', async () => {
		const client = setupClient();
		await client.invalidateQueries(['todos']);

		expect(client.get(['todos', 1])?.isInvalidated).toBe(true);
		expect(client.get(['todos', 2])?.isInvalidated).toBe(true);
		expect(client.get(['users', 1])?.isInvalidated).toBeFalsy();
	});
});
