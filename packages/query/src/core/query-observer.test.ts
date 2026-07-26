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
import { Query } from './query.js';
import { QueryObserver } from './query-observer.js';

describe('QueryObserver', () => {
	const createQuery = (overrides?: Partial<ConstructorParameters<typeof Query>[0]>) =>
		new Query({
			queryKey: ['observer-test'],
			queryFn: async () => 'data',
			...overrides,
		});

	it('should compute initial result from query state', () => {
		const query = createQuery();
		const observer = new QueryObserver(query, {
			queryKey: ['observer-test'],
			queryFn: async () => 'data',
		});

		const result = observer.getCurrentResult();
		expect(result.status).toBe('pending');
		expect(result.isPending).toBe(true);
		expect(result.isFetching).toBe(false);
	});

	it('should update result when query succeeds', async () => {
		const query = createQuery();
		const observer = new QueryObserver(query, {
			queryKey: ['observer-test'],
			queryFn: async () => 'data',
		});

		const listener = vi.fn();
		observer.subscribe(listener);

		await query.fetch();

		expect(listener).toHaveBeenCalled();
		const result = observer.getCurrentResult();
		expect(result.data).toBe('data');
		expect(result.status).toBe('success');
		expect(result.isSuccess).toBe(true);
	});

	it('should memoize select function', async () => {
		const query = createQuery({ queryFn: async () => ({ count: 1 }) });
		const select = vi.fn((data: { count: number }) => data.count);

		const observer = new QueryObserver(query, {
			queryKey: ['observer-test'],
			queryFn: async () => ({ count: 1 }),
			select,
		});

		await query.fetch();
		expect(select).toHaveBeenCalledTimes(1);

		// Fetch again with same data
		await query.fetch();
		expect(select).toHaveBeenCalledTimes(1);

		// Fetch with different data
		query.options = { ...query.options, queryFn: async () => ({ count: 2 }) };
		await query.fetch();
		expect(select).toHaveBeenCalledTimes(2);
	});

	it('should handle initialData', () => {
		const query = createQuery();
		const observer = new QueryObserver(query, {
			queryKey: ['observer-test'],
			queryFn: async () => 'fetched',
			initialData: 'seed',
		});

		const result = observer.getCurrentResult();
		expect(result.data).toBe('seed');
		expect(result.status).toBe('success');
		expect(result.isSuccess).toBe(true);
		expect(result.isPending).toBe(false);
	});

	it('should prefer cached data over initialData', async () => {
		const query = createQuery();
		query.dispatch({ type: 'success', data: 'cached' });

		const observer = new QueryObserver(query, {
			queryKey: ['observer-test'],
			queryFn: async () => 'fetched',
			initialData: 'seed',
		});

		const result = observer.getCurrentResult();
		expect(result.data).toBe('cached');
	});

	it('should handle placeholderData', () => {
		const query = createQuery();
		const observer = new QueryObserver(query, {
			queryKey: ['observer-test'],
			queryFn: async () => 'real',
			placeholderData: 'placeholder',
		});

		const result = observer.getCurrentResult();
		expect(result.data).toBe('placeholder');
		expect(result.isPlaceholderData).toBe(true);
	});

	it('should handle placeholderData as function', () => {
		const query = createQuery();
		const observer = new QueryObserver(query, {
			queryKey: ['observer-test'],
			queryFn: async () => 'real',
			placeholderData: (prev) => prev ?? 'fallback',
		});

		const result = observer.getCurrentResult();
		expect(result.data).toBe('fallback');
		expect(result.isPlaceholderData).toBe(true);
	});

	it('should support select with initialData', () => {
		const query = createQuery();
		const observer = new QueryObserver(query, {
			queryKey: ['observer-test'],
			queryFn: async () => ({ value: 10 }),
			initialData: { value: 5 },
			select: (data) => data.value,
		});

		const result = observer.getCurrentResult();
		expect(result.data).toBe(5);
		expect(result.status).toBe('success');
	});

	it('should only notify when tracked props change', async () => {
		const query = createQuery();
		const observer = new QueryObserver(query, {
			queryKey: ['observer-test'],
			queryFn: async () => 'data',
			notifyOnChangeProps: ['data'],
		});

		const listener = vi.fn();
		observer.subscribe(listener);

		// First fetch - data changes
		await query.fetch();
		expect(listener).toHaveBeenCalledTimes(1);

		// Second fetch with same data - no notification
		await query.fetch();
		expect(listener).toHaveBeenCalledTimes(1);
	});

	it('should handle select errors gracefully', () => {
		const query = createQuery();
		query.dispatch({ type: 'success', data: 'data' });

		const observer = new QueryObserver(query, {
			queryKey: ['observer-test'],
			queryFn: async () => 'data',
			select: () => {
				throw new Error('select failed');
			},
		});

		const result = observer.getCurrentResult();
		expect(result.status).toBe('error');
		expect(result.error?.message).toBe('select failed');
	});

	it('should support refetch through observer', async () => {
		const query = createQuery();
		const observer = new QueryObserver(query, {
			queryKey: ['observer-test'],
			queryFn: async () => 'data',
		});

		await observer.refetch();
		expect(observer.getCurrentResult().data).toBe('data');
	});

	it('should clean up on destroy', () => {
		const query = createQuery();
		const observer = new QueryObserver(query, {
			queryKey: ['observer-test'],
			queryFn: async () => 'data',
		});

		expect(query.observerCount).toBe(1);
		observer.destroy();
		expect(query.observerCount).toBe(0);
	});

	it('should update result when options change', async () => {
		const query = createQuery({ queryFn: async () => ({ value: 1 }) });
		const observer = new QueryObserver(query, {
			queryKey: ['observer-test'],
			queryFn: async () => ({ value: 1 }),
		});

		await query.fetch();
		expect(observer.getCurrentResult().data).toEqual({ value: 1 });

		observer.setOptions({
			select: (data: { value: number }) => data.value * 10,
		});

		expect(observer.getCurrentResult().data).toBe(10);
	});

	it('should handle error state', async () => {
		const query = new Query({
			queryKey: ['error'],
			queryFn: async () => {
				throw new Error('boom');
			},
			retry: false,
		});

		const observer = new QueryObserver(query, {
			queryKey: ['error'],
			queryFn: async () => {
				throw new Error('boom');
			},
		});

		try {
			await query.fetch();
		} catch {
			// expected
		}

		const result = observer.getCurrentResult();
		expect(result.status).toBe('error');
		expect(result.isError).toBe(true);
		expect(result.error?.message).toBe('boom');
	});
});
