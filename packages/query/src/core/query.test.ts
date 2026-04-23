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

describe('Query', () => {
	const createTestQuery = (overrides?: Partial<Parameters<typeof Query.prototype.fetch>[0]>) =>
		new Query({
			queryKey: ['test'],
			queryFn: async () => 'data',
			...overrides,
		});

	it('should create with initial state', () => {
		const query = createTestQuery();
		expect(query.currentState.status).toBe('pending');
		expect(query.currentState.fetchStatus).toBe('idle');
		expect(query.currentState.data).toBeUndefined();
		expect(query.observerCount).toBe(0);
	});

	it('should dispatch actions to update state', () => {
		const query = createTestQuery();
		query.dispatch({ type: 'success', data: 'hello' });
		expect(query.currentState.status).toBe('success');
		expect(query.currentState.data).toBe('hello');
	});

	it('should track observers', () => {
		const query = createTestQuery();
		const observer = { onQueryUpdate: vi.fn() };
		const unsubscribe = query.addObserver(observer);
		expect(query.observerCount).toBe(1);
		unsubscribe();
		expect(query.observerCount).toBe(0);
	});

	it('should notify observers on state change', () => {
		const query = createTestQuery();
		const observer = { onQueryUpdate: vi.fn() };
		query.addObserver(observer);
		query.dispatch({ type: 'success', data: 'hello' });
		expect(observer.onQueryUpdate).toHaveBeenCalledTimes(1);
	});

	it('should deduplicate concurrent fetches', async () => {
		let callCount = 0;
		const query = new Query({
			queryKey: ['dedup'],
			queryFn: async () => {
				callCount++;
				await new Promise((r) => setTimeout(r, 20));
				return 'result';
			},
		});

		const [r1, r2] = await Promise.all([query.fetch(), query.fetch()]);
		expect(callCount).toBe(1);
		expect(r1).toBe('result');
		expect(r2).toBe('result');
	});

	it('should handle fetch success', async () => {
		const query = createTestQuery();
		const result = await query.fetch();
		expect(result).toBe('data');
		expect(query.currentState.status).toBe('success');
		expect(query.currentState.fetchCount).toBe(1);
	});

	it('should handle fetch error', async () => {
		const query = new Query({
			queryKey: ['error'],
			queryFn: async () => {
				throw new Error('boom');
			},
			retry: false,
		});

		await expect(query.fetch()).rejects.toThrow('boom');
		expect(query.currentState.status).toBe('error');
		expect(query.currentState.error?.message).toBe('boom');
	});

	it('should cancel in-flight fetch', async () => {
		const query = new Query({
			queryKey: ['cancel'],
			queryFn: async ({ signal }) => {
				await new Promise((_, reject) => {
					signal.addEventListener('abort', () => {
						reject(new Error('cancelled'));
					});
				});
				return 'never';
			},
			retry: false,
		});

		const fetchPromise = query.fetch();
		query.cancel();
		await expect(fetchPromise).rejects.toThrow('cancelled');
		expect(query.currentState.fetchStatus).toBe('idle');
	});

	it('should retry on failure', async () => {
		let attempts = 0;
		const query = new Query({
			queryKey: ['retry'],
			queryFn: async () => {
				attempts++;
				if (attempts < 3) throw new Error('fail');
				return 'success';
			},
			retry: 3,
			retryDelay: 10,
		});

		const result = await query.fetch();
		expect(result).toBe('success');
		expect(attempts).toBe(3);
	});

	it('should apply structural sharing on identical data', async () => {
		const data = { id: 1, nested: { a: 1 } };
		const query = new Query({
			queryKey: ['structural'],
			queryFn: async () => data,
		});

		await query.fetch();
		const firstRef = query.currentState.data;
		await query.fetch();
		const secondRef = query.currentState.data;
		expect(secondRef).toBe(firstRef);
	});

	it('should create new reference on different data', async () => {
		let count = 0;
		const query = new Query({
			queryKey: ['structural-diff'],
			queryFn: async () => ({ count: ++count }),
		});

		await query.fetch();
		const firstRef = query.currentState.data;
		await query.fetch();
		const secondRef = query.currentState.data;
		expect(secondRef).not.toBe(firstRef);
	});

	it('should timeout long-running queries', async () => {
		const query = new Query({
			queryKey: ['timeout'],
			queryFn: async () => {
				await new Promise((r) => setTimeout(r, 500));
				return 'late';
			},
			retry: false,
			timeout: 50,
		});

		await expect(query.fetch()).rejects.toThrow('timed out');
	});

	it('should expose snapshot', () => {
		const query = createTestQuery();
		const snap = query.snapshot();
		expect(snap.queryKey).toEqual(['test']);
		expect(snap.isActive).toBe(false);
		expect(snap.observerCount).toBe(0);
	});

	it('should mark stale correctly', () => {
		const query = new Query({
			queryKey: ['stale'],
			queryFn: async () => 'data',
			staleTime: 100,
		});

		expect(query.isStale).toBe(true);
		query.dispatch({ type: 'success', data: 'data' });
		expect(query.isStale).toBe(false);
	});

	it('should invalidate query', () => {
		const query = createTestQuery();
		query.dispatch({ type: 'success', data: 'data' });
		expect(query.isStale).toBe(false);
		query.invalidate();
		expect(query.isStale).toBe(true);
	});
});
