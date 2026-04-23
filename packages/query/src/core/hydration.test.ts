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

import { describe, it, expect } from 'vitest';
import { QueryCache, Query } from './index.js';
import { dehydrate, hydrate } from './hydration.js';

describe('hydration', () => {
	describe('dehydrate', () => {
		it('should serialize query state', () => {
			const cache = new QueryCache();
			const query = cache.getOrCreate({
				queryKey: ['users'],
				queryFn: async () => 'data',
			});
			query.dispatch({ type: 'success', data: 'hello' });

			const state = cache.dehydrate();
			expect(state.queries).toHaveLength(1);
			expect(state.queries[0].queryKey).toEqual(['users']);
			expect(state.queries[0].state.data).toBe('hello');
			expect(state.queries[0].state.status).toBe('success');
		});

		it('should serialize error state', () => {
			const cache = new QueryCache();
			const query = cache.getOrCreate({
				queryKey: ['error'],
				queryFn: async () => 'data',
			});
			query.dispatch({ type: 'error', error: new Error('boom') });

			const state = cache.dehydrate();
			expect(state.queries[0].state.error).toEqual({
				__type: 'Error',
				__value: { message: 'boom', name: 'Error', stack: expect.any(String) },
			});
			expect(state.queries[0].state.status).toBe('error');
		});

		it('should handle empty cache', () => {
			const cache = new QueryCache();
			const state = cache.dehydrate();
			expect(state.queries).toEqual([]);
		});

		it('should serialize Dates with built-in serializer', () => {
			const cache = new QueryCache();
			const query = cache.getOrCreate({
				queryKey: ['date'],
				queryFn: async () => 'data',
			});
			query.dispatch({ type: 'success', data: { createdAt: new Date('2024-01-15') } });

			const state = cache.dehydrate();
			expect((state.queries[0].state.data as { createdAt: unknown }).createdAt).toEqual({
				__type: 'Date',
				__value: '2024-01-15T00:00:00.000Z',
			});
		});

		it('should serialize nested objects', () => {
			const cache = new QueryCache();
			const query = cache.getOrCreate({
				queryKey: ['nested'],
				queryFn: async () => 'data',
			});
			query.dispatch({
				type: 'success',
				data: { user: { name: 'alice', posts: [{ id: 1 }] } },
			});

			const state = cache.dehydrate();
			expect(state.queries[0].state.data).toEqual({
				user: { name: 'alice', posts: [{ id: 1 }] },
			});
		});
	});

	describe('hydrate', () => {
		it('should restore query state', () => {
			const state = {
				queries: [
					{
						queryHash: '["users"]',
						queryKey: ['users'],
						state: {
							data: 'hello',
							dataUpdatedAt: Date.now(),
							error: null,
							errorUpdatedAt: 0,
							status: 'success' as const,
							fetchStatus: 'idle' as const,
							fetchCount: 1,
							isInvalidated: false,
						},
					},
				],
			};

			const cache = new QueryCache();
			const query = cache.getOrCreate({
				queryKey: ['users'],
				queryFn: async () => 'data',
			});
			cache.hydrate(state);

			expect(query.currentState.data).toBe('hello');
			expect(query.currentState.status).toBe('success');
			expect(query.currentState.fetchCount).toBe(1);
		});

		it('should restore Dates with built-in serializer', () => {
			const state = {
				queries: [
					{
						queryHash: '["date"]',
						queryKey: ['date'],
						state: {
							data: { createdAt: { __type: 'Date', __value: '2024-01-15T00:00:00.000Z' } },
							dataUpdatedAt: Date.now(),
							error: null,
							errorUpdatedAt: 0,
							status: 'success' as const,
							fetchStatus: 'idle' as const,
							fetchCount: 1,
							isInvalidated: false,
						},
					},
				],
			};

			const cache = new QueryCache();
			cache.getOrCreate({
				queryKey: ['date'],
				queryFn: async () => 'data',
			});
			cache.hydrate(state);

			const query = cache.get(['date'])!;
			const data = query.currentState.data as { createdAt: Date };
			expect(data.createdAt).toBeInstanceOf(Date);
			expect(data.createdAt.toISOString()).toBe('2024-01-15T00:00:00.000Z');
		});

		it('should handle custom serializers', () => {
			const mapSerializer = {
				name: 'Map',
				serialize: (value: Map<unknown, unknown>) => Array.from(value.entries()),
				deserialize: (value: unknown) => new Map(value as [unknown, unknown][]),
				isInstance: (value: unknown): value is Map<unknown, unknown> =>
					value instanceof Map,
			};

			const state = {
				queries: [
					{
						queryHash: '["map"]',
						queryKey: ['map'],
						state: {
							data: { tags: { __type: 'Map', __value: [['a', 1], ['b', 2]] } },
							dataUpdatedAt: Date.now(),
							error: null,
							errorUpdatedAt: 0,
							status: 'success' as const,
							fetchStatus: 'idle' as const,
							fetchCount: 1,
							isInvalidated: false,
						},
					},
				],
			};

			const cache = new QueryCache();
			cache.getOrCreate({
				queryKey: ['map'],
				queryFn: async () => 'data',
			});
			cache.hydrate(state, { serializers: [mapSerializer] });

			const query = cache.get(['map'])!;
			const data = query.currentState.data as { tags: Map<string, number> };
			expect(data.tags).toBeInstanceOf(Map);
			expect(data.tags.get('a')).toBe(1);
			expect(data.tags.get('b')).toBe(2);
		});

		it('should round-trip through dehydrate + hydrate', () => {
			const cache1 = new QueryCache();
			const query = cache1.getOrCreate({
				queryKey: ['roundtrip'],
				queryFn: async () => 'data',
			});
			query.dispatch({
				type: 'success',
				data: { name: 'test', count: 42, nested: { arr: [1, 2] } },
			});

			const dehydrated = cache1.dehydrate();
			const cache2 = new QueryCache();
			const query2 = cache2.getOrCreate({
				queryKey: ['roundtrip'],
				queryFn: async () => 'data',
			});
			cache2.hydrate(dehydrated);

			expect(query2.currentState.data).toEqual({
				name: 'test',
				count: 42,
				nested: { arr: [1, 2] },
			});
			expect(query2.currentState.status).toBe('success');
		});

		it('should round-trip Dates', () => {
			const cache1 = new QueryCache();
			const query = cache1.getOrCreate({
				queryKey: ['dates'],
				queryFn: async () => 'data',
			});
			query.dispatch({
				type: 'success',
				data: { items: [{ created: new Date('2024-06-01') }] },
			});

			const dehydrated = cache1.dehydrate();
			const cache2 = new QueryCache();
			cache2.getOrCreate({
				queryKey: ['dates'],
				queryFn: async () => 'data',
			});
			cache2.hydrate(dehydrated);

			const query2 = cache2.get(['dates'])!;
			const data = query2.currentState.data as { items: Array<{ created: Date }> };
			expect(data.items[0].created).toBeInstanceOf(Date);
			expect(data.items[0].created.toISOString()).toBe('2024-06-01T00:00:00.000Z');
		});
	});

	describe('standalone dehydrate/hydrate functions', () => {
		it('should work with raw Query arrays', () => {
			const queries = [
				new Query({
					queryKey: ['a'],
					queryFn: async () => 'a',
				}),
			];
			queries[0].dispatch({ type: 'success', data: 'data-a' });

			const dehydrated = dehydrate(queries);
			const hydrated = hydrate(dehydrated);

			expect(hydrated).toHaveLength(1);
			expect(hydrated[0].state.data).toBe('data-a');
		});
	});
});
