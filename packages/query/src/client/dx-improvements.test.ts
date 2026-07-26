import { describe, it, expect, vi } from 'vitest';
import { Effect } from 'effect';
import { createQueryClient } from './client.js';
import { queryOptions, keepPreviousData } from './query-options.js';
import { useQuery } from '../hooks/useQuery.js';

describe('DX improvements', () => {
	describe('queryOptions', () => {
		it('should return typed options', () => {
			const options = queryOptions({
				queryKey: ['users'],
				queryFn: () => Promise.resolve(['alice', 'bob']),
				staleTime: 5000,
			});

			expect(options.queryKey).toEqual(['users']);
			expect(options.staleTime).toBe(5000);
		});

		it('should support initialData in options', () => {
			const options = queryOptions({
				queryKey: ['config'],
				queryFn: () => Promise.resolve({ theme: 'dark' }),
				initialData: { theme: 'light' },
			});

			expect(options.initialData).toEqual({ theme: 'light' });
		});

		it('should support initialData as function', () => {
			const options = queryOptions({
				queryKey: ['timestamp'],
				queryFn: () => Promise.resolve(Date.now()),
				initialData: () => 0,
			});

			expect(typeof options.initialData).toBe('function');
		});
	});

	describe('keepPreviousData', () => {
		it('should return previous data unchanged', () => {
			const prev = { count: 5 };
			expect(keepPreviousData(prev)).toBe(prev);
		});

		it('should return undefined for undefined input', () => {
			expect(keepPreviousData(undefined)).toBeUndefined();
		});
	});

	describe('Effect queryFn', () => {
		it('should accept Effect.Effect as queryFn', async () => {
			const client = createQueryClient();
			const queryFn = () => Effect.succeed(42);

			const result = useQuery({
				queryKey: ['effect-test'],
				queryFn,
				client,
			});

			// Wait for the effect to resolve
			await new Promise((resolve) => setTimeout(resolve, 10));

			expect(result.data.value).toBe(42);
			expect(result.status.value).toBe('success');
		});

		it('should handle Effect failures', async () => {
			const client = createQueryClient();
			const queryFn = () => Effect.fail(new Error('boom'));

			const result = useQuery({
				queryKey: ['effect-fail'],
				queryFn,
				client,
				retry: false,
			});

			// Poll until status changes from pending
			for (let i = 0; i < 50 && result.status.value === 'pending'; i++) {
				await new Promise((resolve) => setTimeout(resolve, 10));
			}

			expect(result.status.value).toBe('error');
			expect(result.error.value?.message).toBe('boom');
		});
	});

	describe('initialData', () => {
		it('should use initialData when no cache exists', () => {
			const client = createQueryClient();

			const result = useQuery({
				queryKey: ['init'],
				queryFn: () => Promise.resolve('fetched'),
				initialData: 'seed',
				client,
			});

			expect(result.data.value).toBe('seed');
			expect(result.status.value).toBe('success');
		});

		it('should prefer cached data over initialData', () => {
			const client = createQueryClient();
			client.set(['init'], {
				data: 'cached',
				status: 'success',
				dataUpdatedAt: Date.now(),
				fetchCount: 1,
			});

			const result = useQuery({
				queryKey: ['init'],
				queryFn: () => Promise.resolve('fetched'),
				initialData: 'seed',
				client,
			});

			expect(result.data.value).toBe('cached');
		});
	});

	describe('placeholderData with previous data', () => {
		it('should accept function form for placeholderData', () => {
			const client = createQueryClient();

			const result = useQuery({
				queryKey: ['ph'],
				queryFn: () => Promise.resolve('real'),
				placeholderData: (previous) => previous ?? 'fallback',
				client,
			});

			expect(result.data.value).toBe('fallback');
			expect(result.isPlaceholderData.value).toBe(true);
		});
	});
});
