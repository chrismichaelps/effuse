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
import { QueryCache } from './query-cache.js';
import { Query } from './query.js';

describe('QueryCache', () => {
	it('should create and retrieve queries', () => {
		const cache = new QueryCache();
		const query = cache.getOrCreate({
			queryKey: ['users', 1],
			queryFn: async () => 'user',
		});

		expect(query).toBeInstanceOf(Query);
		expect(query.queryKey).toEqual(['users', 1]);
	});

	it('should return existing query for same key', () => {
		const cache = new QueryCache();
		const q1 = cache.getOrCreate({
			queryKey: ['shared'],
			queryFn: async () => 'a',
		});
		const q2 = cache.getOrCreate({
			queryKey: ['shared'],
			queryFn: async () => 'b',
		});

		expect(q1).toBe(q2);
	});

	it('should create different queries for different keys', () => {
		const cache = new QueryCache();
		const q1 = cache.getOrCreate({
			queryKey: ['a'],
			queryFn: async () => 'a',
		});
		const q2 = cache.getOrCreate({
			queryKey: ['b'],
			queryFn: async () => 'b',
		});

		expect(q1).not.toBe(q2);
	});

	it('should get existing query without creating', () => {
		const cache = new QueryCache();
		const existing = cache.get(['missing']);
		expect(existing).toBeUndefined();

		cache.getOrCreate({
			queryKey: ['exists'],
			queryFn: async () => 'data',
		});

		const found = cache.get(['exists']);
		expect(found).toBeDefined();
	});

	it('should remove queries', () => {
		const cache = new QueryCache();
		cache.getOrCreate({
			queryKey: ['remove-me'],
			queryFn: async () => 'data',
		});

		expect(cache.get(['remove-me'])).toBeDefined();
		cache.remove(['remove-me']);
		expect(cache.get(['remove-me'])).toBeUndefined();
	});

	it('should return all queries', () => {
		const cache = new QueryCache();
		cache.getOrCreate({ queryKey: ['a'], queryFn: async () => 'a' });
		cache.getOrCreate({ queryKey: ['b'], queryFn: async () => 'b' });

		const all = cache.getAll();
		expect(all).toHaveLength(2);
	});

	it('should return all snapshots', () => {
		const cache = new QueryCache();
		cache.getOrCreate({ queryKey: ['a'], queryFn: async () => 'a' });

		const snapshots = cache.getAllSnapshots();
		expect(snapshots).toHaveLength(1);
		expect(snapshots[0].queryKey).toEqual(['a']);
	});

	it('should clear all queries', () => {
		const cache = new QueryCache();
		cache.getOrCreate({ queryKey: ['a'], queryFn: async () => 'a' });
		cache.getOrCreate({ queryKey: ['b'], queryFn: async () => 'b' });

		cache.clear();
		expect(cache.size).toBe(0);
		expect(cache.getAll()).toHaveLength(0);
	});

	it('should track size', () => {
		const cache = new QueryCache();
		expect(cache.size).toBe(0);
		cache.getOrCreate({ queryKey: ['a'], queryFn: async () => 'a' });
		expect(cache.size).toBe(1);
	});
});
