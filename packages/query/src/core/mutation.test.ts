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
import { Mutation } from './mutation.js';

describe('Mutation', () => {
	it('starts in idle state', () => {
		const mutation = new Mutation({
			mutationFn: async () => 'ok',
		});

		expect(mutation.currentState.status).toBe('idle');
		expect(mutation.currentState.data).toBeUndefined();
		expect(mutation.currentState.error).toBeNull();
	});

	it('transitions to pending then success', async () => {
		const mutation = new Mutation({
			mutationFn: async () => 'success',
		});

		const promise = mutation.execute('vars');
		expect(mutation.currentState.status).toBe('pending');

		const data = await promise;
		expect(data).toBe('success');
		expect(mutation.currentState.status).toBe('success');
		expect(mutation.currentState.data).toBe('success');
		expect(mutation.currentState.error).toBeNull();
	});

	it('transitions to error on failure', async () => {
		const mutation = new Mutation({
			mutationFn: async () => {
				throw new Error('fail');
			},
		});

		await expect(mutation.execute('vars')).rejects.toThrow('fail');
		expect(mutation.currentState.status).toBe('error');
		expect(mutation.currentState.error).toBeInstanceOf(Error);
		expect(mutation.currentState.failureCount).toBe(1);
	});

	it('calls lifecycle callbacks in order', async () => {
		const onMutate = vi.fn(async () => ({ context: true }));
		const onSuccess = vi.fn();
		const onSettled = vi.fn();

		const mutation = new Mutation({
			mutationFn: async () => 'data',
			onMutate,
			onSuccess,
			onSettled,
		});

		await mutation.execute('vars');

		expect(onMutate).toHaveBeenCalledWith('vars');
		expect(onSuccess).toHaveBeenCalledWith('data', 'vars', { context: true });
		expect(onSettled).toHaveBeenCalledWith('data', null, 'vars', { context: true });
	});

	it('calls onError and onSettled on failure', async () => {
		const onError = vi.fn();
		const onSettled = vi.fn();

		const mutation = new Mutation({
			mutationFn: async () => {
				throw new Error('boom');
			},
			onError,
			onSettled,
		});

		await expect(mutation.execute('vars')).rejects.toThrow('boom');

		expect(onError).toHaveBeenCalledWith(expect.any(Error), 'vars', undefined);
		expect(onSettled).toHaveBeenCalledWith(undefined, expect.any(Error), 'vars', undefined);
	});

	it('notifies observers on state changes', async () => {
		const mutation = new Mutation({
			mutationFn: async () => 'ok',
		});

		const observer = { onMutationUpdate: vi.fn() };
		mutation.addObserver(observer);

		await mutation.execute('vars');

		expect(observer.onMutationUpdate).toHaveBeenCalledTimes(3);
	});

	it('resets to idle state', async () => {
		const mutation = new Mutation({
			mutationFn: async () => 'ok',
		});

		await mutation.execute('vars');
		expect(mutation.currentState.status).toBe('success');

		mutation.reset();
		expect(mutation.currentState.status).toBe('idle');
		expect(mutation.currentState.data).toBeUndefined();
	});

	it('retries on failure and eventually succeeds', async () => {
		let attempts = 0;
		const mutation = new Mutation({
			mutationFn: async () => {
				attempts++;
				if (attempts < 3) throw new Error('retry');
				return 'finally';
			},
			retry: 2,
			retryDelay: 10,
		});

		const data = await mutation.execute('vars');
		expect(data).toBe('finally');
		expect(attempts).toBe(3);
		expect(mutation.currentState.failureCount).toBe(0);
	});

	it('times out when execution exceeds timeout', async () => {
		const mutation = new Mutation({
			mutationFn: async () => {
				await new Promise((resolve) => setTimeout(resolve, 100));
				return 'late';
			},
			timeout: 10,
			retry: 0,
		});

		await expect(mutation.execute('vars')).rejects.toThrow('timed out');
	});

	it('deduplicates concurrent executions', async () => {
		let calls = 0;
		const mutation = new Mutation({
			mutationFn: async () => {
				calls++;
				await new Promise((resolve) => setTimeout(resolve, 20));
				return 'ok';
			},
		});

		const [r1, r2] = await Promise.all([
			mutation.execute('a'),
			mutation.execute('b'),
		]);

		expect(calls).toBe(1);
		expect(r1).toBe('ok');
		expect(r2).toBe('ok');
	});
});
