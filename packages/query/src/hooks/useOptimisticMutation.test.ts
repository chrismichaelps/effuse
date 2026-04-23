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
import { useOptimisticMutation } from './useMutation.js';

describe('useOptimisticMutation', () => {
	describe('single query', () => {
		it('should apply optimistic update and rollback on error', async () => {
			const client = createQueryClient();
			client.set(['posts'], {
				data: [{ id: 1, title: 'hello' }],
				status: 'success',
				dataUpdatedAt: Date.now(),
				fetchCount: 1,
			});

			const result = useOptimisticMutation({
				mutationFn: () => Promise.reject(new Error('fail')),
				queries: [
					{
						queryKey: ['posts'],
						optimisticUpdate: (_vars, current) => [
							...(current ?? []),
							{ id: 2, title: 'new' },
						],
					},
				],
				client,
			});

			expect(client.getQueryData(['posts'])).toEqual([
				{ id: 1, title: 'hello' },
			]);

			try {
				await result.mutateAsync(undefined);
			} catch {
				// expected
			}

			expect(client.getQueryData(['posts'])).toEqual([
				{ id: 1, title: 'hello' },
			]);
		});

		it('should keep optimistic data on success', async () => {
			const client = createQueryClient();
			client.set(['posts'], {
				data: [{ id: 1 }],
				status: 'success',
				dataUpdatedAt: Date.now(),
				fetchCount: 1,
			});

			const result = useOptimisticMutation({
				mutationFn: () => Promise.resolve({ id: 2, title: 'created' }),
				queries: [
					{
						queryKey: ['posts'],
						optimisticUpdate: (_vars, current) => [
							...(current ?? []),
							{ id: 2, title: 'created' },
						],
					},
				],
				client,
			});

			await result.mutateAsync(undefined);

			expect(client.getQueryData(['posts'])).toEqual([
				{ id: 1 },
				{ id: 2, title: 'created' },
			]);
		});
	});

	describe('multiple queries', () => {
		it('should update multiple queries optimistically', async () => {
			const client = createQueryClient();
			client.set(['posts'], {
				data: [{ id: 1 }],
				status: 'success',
				dataUpdatedAt: Date.now(),
				fetchCount: 1,
			});
			client.set(['users', 'alice'], {
				data: { name: 'alice', postCount: 1 },
				status: 'success',
				dataUpdatedAt: Date.now(),
				fetchCount: 1,
			});

			const result = useOptimisticMutation({
				mutationFn: () => Promise.resolve({ id: 2, title: 'new' }),
				queries: [
					{
						queryKey: ['posts'],
						optimisticUpdate: (_vars, current) => [
							...(current ?? []),
							{ id: 2, title: 'new' },
						],
					},
					{
						queryKey: ['users', 'alice'],
						optimisticUpdate: (_vars, current) => ({
							...(current ?? { name: 'alice' }),
							postCount: (current?.postCount ?? 0) + 1,
						}),
					},
				],
				client,
			});

			await result.mutateAsync(undefined);

			expect(client.getQueryData(['posts'])).toEqual([
				{ id: 1 },
				{ id: 2, title: 'new' },
			]);
			expect(client.getQueryData(['users', 'alice'])).toEqual({
				name: 'alice',
				postCount: 2,
			});
		});

		it('should rollback ALL queries on error', async () => {
			const client = createQueryClient();
			client.set(['posts'], {
				data: [{ id: 1 }],
				status: 'success',
				dataUpdatedAt: Date.now(),
				fetchCount: 1,
			});
			client.set(['users', 'alice'], {
				data: { name: 'alice', postCount: 1 },
				status: 'success',
				dataUpdatedAt: Date.now(),
				fetchCount: 1,
			});

			const result = useOptimisticMutation({
				mutationFn: () => Promise.reject(new Error('fail')),
				queries: [
					{
						queryKey: ['posts'],
						optimisticUpdate: (_vars, current) => [
							...(current ?? []),
							{ id: 2 },
						],
					},
					{
						queryKey: ['users', 'alice'],
						optimisticUpdate: (_vars, current) => ({
							...(current ?? {}),
							postCount: (current?.postCount ?? 0) + 1,
						}),
					},
				],
				client,
			});

			try {
				await result.mutateAsync(undefined);
			} catch {
				// expected
			}

			expect(client.getQueryData(['posts'])).toEqual([{ id: 1 }]);
			expect(client.getQueryData(['users', 'alice'])).toEqual({
				name: 'alice',
				postCount: 1,
			});
		});

		it('should invalidate keys on success', async () => {
			const client = createQueryClient();
			client.set(['posts'], {
				data: [{ id: 1 }],
				status: 'success',
				dataUpdatedAt: Date.now(),
				fetchCount: 1,
			});
			client.set(['posts', 'recent'], {
				data: [{ id: 1 }],
				status: 'success',
				dataUpdatedAt: Date.now(),
				fetchCount: 1,
			});

			const invalidateSpy = vi.spyOn(client, 'invalidate');

			const result = useOptimisticMutation({
				mutationFn: () => Promise.resolve({ id: 2 }),
				queries: [
					{
						queryKey: ['posts'],
						optimisticUpdate: (_vars, current) => [
							...(current ?? []),
							{ id: 2 },
						],
					},
				],
				invalidateKeys: [['posts', 'recent']],
				client,
			});

			await result.mutateAsync(undefined);

			expect(invalidateSpy).toHaveBeenCalledWith(['posts', 'recent']);
			invalidateSpy.mockRestore();
		});

		it('should remove optimistic entry on rollback if no prior snapshot', async () => {
			const client = createQueryClient();
			// No prior data for 'comments'

			const result = useOptimisticMutation({
				mutationFn: () => Promise.reject(new Error('fail')),
				queries: [
					{
						queryKey: ['comments'],
						optimisticUpdate: (_vars, _current) => [{ id: 1 }],
					},
				],
				client,
			});

			try {
				await result.mutateAsync(undefined);
			} catch {
				// expected
			}

			expect(client.getQueryData(['comments'])).toBeUndefined();
		});
	});

	describe('edge cases', () => {
		it('should handle empty queries array', async () => {
			const client = createQueryClient();

			const result = useOptimisticMutation({
				mutationFn: () => Promise.resolve('ok'),
				queries: [],
				client,
			});

			await expect(result.mutateAsync(undefined)).resolves.toBe('ok');
		});
	});
});
