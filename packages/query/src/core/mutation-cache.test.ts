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
import { MutationCache } from './mutation-cache.js';
import { Mutation } from './mutation.js';

describe('MutationCache', () => {
	it('builds and retrieves mutations', () => {
		const cache = new MutationCache();
		const mutation = cache.build({
			mutationKey: ['create-user'],
			mutationFn: async () => 'ok',
		});

		expect(mutation).toBeInstanceOf(Mutation);
		expect(cache.get(['create-user'])).toBe(mutation);
		expect(cache.size).toBe(1);
	});

	it('returns existing mutation for same key', () => {
		const cache = new MutationCache();
		const m1 = cache.build({ mutationKey: ['a'], mutationFn: async () => 'a' });
		const m2 = cache.build({ mutationKey: ['a'], mutationFn: async () => 'b' });

		expect(m1).toBe(m2);
	});

	it('removes mutations', () => {
		const cache = new MutationCache();
		cache.build({ mutationKey: ['a'], mutationFn: async () => 'a' });

		expect(cache.remove(['a'])).toBe(true);
		expect(cache.get(['a'])).toBeUndefined();
		expect(cache.remove(['a'])).toBe(false);
	});

	it('clears all mutations', () => {
		const cache = new MutationCache();
		cache.build({ mutationKey: ['a'], mutationFn: async () => 'a' });
		cache.build({ mutationKey: ['b'], mutationFn: async () => 'b' });

		cache.clear();
		expect(cache.size).toBe(0);
	});

	it('returns all states', () => {
		const cache = new MutationCache();
		cache.build({ mutationKey: ['a'], mutationFn: async () => 'a' });

		const states = cache.getAllStates();
		expect(states).toHaveLength(1);
		expect(states[0].status).toBe('idle');
	});

	it('tracks pending count', async () => {
		const cache = new MutationCache();
		const mutation = cache.build({
			mutationKey: ['slow'],
			mutationFn: async () => {
				await new Promise((resolve) => setTimeout(resolve, 50));
				return 'done';
			},
		});

		expect(cache.pendingCount).toBe(0);

		mutation.execute('vars');
		await new Promise((resolve) => setTimeout(resolve, 0));
		expect(cache.pendingCount).toBe(1);

		await new Promise((resolve) => setTimeout(resolve, 100));
		expect(cache.pendingCount).toBe(0);
	});

	it('notifies subscribers on state changes', async () => {
		const cache = new MutationCache();
		const callback = vi.fn();
		cache.subscribe(callback);

		const mutation = cache.build({
			mutationKey: ['a'],
			mutationFn: async () => 'ok',
		});

		await mutation.execute('vars');
		expect(callback).toHaveBeenCalled();
	});

	it('unsubscribes correctly', async () => {
		const cache = new MutationCache();
		const callback = vi.fn();
		const unsubscribe = cache.subscribe(callback);
		unsubscribe();

		const mutation = cache.build({
			mutationKey: ['a'],
			mutationFn: async () => 'ok',
		});

		await mutation.execute('vars');
		expect(callback).not.toHaveBeenCalled();
	});

	it('invokes global listeners', async () => {
		const onSuccess = vi.fn();
		const onError = vi.fn();
		const onSettled = vi.fn();

		const cache = new MutationCache({ onSuccess, onError, onSettled });
		const mutation = cache.build({
			mutationKey: ['a'],
			mutationFn: async () => 'ok',
		});

		await mutation.execute('vars');
		expect(onSuccess).toHaveBeenCalledWith('ok', 'vars', undefined);
		expect(onSettled).toHaveBeenCalledWith('ok', null, 'vars', undefined);
		expect(onError).not.toHaveBeenCalled();
	});
});
