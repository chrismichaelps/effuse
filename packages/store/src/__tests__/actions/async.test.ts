import { describe, it, expect } from 'vitest';
import {
	createAsyncAction,
	createCancellableAction,
	withTimeout,
	withRetry,
	dispatch,
	dispatchSync,
	withAbortSignal,
} from '../../actions/async.js';
import { createStore } from '../../core/store.js';
import { TimeoutError } from '../../errors.js';

describe('async actions', () => {
	describe('createAsyncAction', () => {
		it('should wrap a sync function', async () => {
			const action = createAsyncAction((x: number) => x * 2);
			expect(action.pending).toBe(false);
			const result = await action(5);
			expect(result).toBe(10);
			expect(action.pending).toBe(false);
		});

		it('should wrap an async function', async () => {
			const action = createAsyncAction((x: number) => x * 3);
			const result = await action(4);
			expect(result).toBe(12);
		});

		it('should track pending state', async () => {
			let resolveFn: (() => void) | undefined;
			const action = createAsyncAction(
				() => new Promise<void>((r) => { resolveFn = r; })
			);
			const promise = action();
			expect(action.pending).toBe(true);
			resolveFn?.();
			await promise;
			expect(action.pending).toBe(false);
		});

		it('should reset pending on error', async () => {
			const action = createAsyncAction(() => Promise.reject(new Error('fail')));
			await expect(action()).rejects.toThrow('fail');
			expect(action.pending).toBe(false);
		});
	});

	describe('createCancellableAction', () => {
		it('should cancel previous call', async () => {
			const action = createCancellableAction(async (id: number) => {
				await new Promise((r) => setTimeout(r, 100));
				return id;
			});

			const p1 = action(1);
			action.cancel();
			await expect(p1).rejects.toThrow();
		});

		it('should track pending and cancel', async () => {
			const action = createCancellableAction(
				async () => new Promise<void>((r) => setTimeout(r, 1000))
			);
			const p = action();
			expect(action.pending).toBe(true);
			action.cancel();
			expect(action.pending).toBe(false);
			await expect(p).rejects.toThrow('Operation was cancelled');
		});
	});

	describe('withTimeout', () => {
		it('should resolve if fn finishes in time', async () => {
			const fn = withTimeout(() => 'ok', 100);
			const result = await fn();
			expect(result).toBe('ok');
		});

		it('should throw TimeoutError if fn exceeds timeout', async () => {
			const fn = withTimeout(
				() => new Promise<string>((r) => setTimeout(() => { r('ok'); }, 200)),
				50
			);
			await expect(fn()).rejects.toThrow(TimeoutError);
		});
	});

	describe('withRetry', () => {
		it('should succeed on first try', async () => {
			const fn = withRetry((x: number) => x * 2, { maxRetries: 3 });
			const result = await fn(5);
			expect(result).toBe(10);
		});

		it('should retry until success', async () => {
			let attempts = 0;
			const fn = withRetry(
				() => {
					attempts++;
					if (attempts < 3) return Promise.reject(new Error('fail'));
					return Promise.resolve('success');
				},
				{ maxRetries: 3, initialDelayMs: 10 }
			);
			const result = await fn();
			expect(result).toBe('success');
			expect(attempts).toBe(3);
		});

		it('should throw after max retries exceeded', async () => {
			const fn = withRetry(() => Promise.reject(new Error('always fails')), { maxRetries: 2, initialDelayMs: 10 });
			await expect(fn()).rejects.toThrow('always fails');
		});
	});

	describe('dispatch', () => {
		it('should dispatch an action by name', async () => {
			const store = createStore('dispatchTest', {
				count: 0,
				increment() {
					this.count.value++;
				},
			});
			await dispatch(store, 'increment');
			expect((store as unknown as Record<string, { value: number }>).count.value).toBe(1);
		});

		it('should reject for missing action', async () => {
			const store = createStore('dispatchFail', { count: 0 });
			await expect(dispatch(store, 'missing' as 'count')).rejects.toThrow(
				'Action "missing" not found'
			);
		});
	});

	describe('dispatchSync', () => {
		it('should dispatch sync action', () => {
			const store = createStore('dispatchSyncTest', {
				count: 0,
				increment() {
					this.count.value++;
				},
			});
			dispatchSync(store, 'increment');
			expect((store as unknown as Record<string, { value: number }>).count.value).toBe(1);
		});

		it('should throw for missing action', () => {
			const store = createStore('dispatchSyncFail', { count: 0 });
			expect(() => dispatchSync(store, 'missing' as 'count')).toThrow(
				'Action "missing" not found'
			);
		});
	});

	describe('withAbortSignal', () => {
		it('should resolve when signal is not aborted', async () => {
			const fn = withAbortSignal((x: number) => x * 2);
			const controller = new AbortController();
			const result = await fn(controller.signal, 5);
			expect(result).toBe(10);
		});

		it('should reject when signal is already aborted', async () => {
			const fn = withAbortSignal(() => 'ok');
			const controller = new AbortController();
			controller.abort();
			await expect(fn(controller.signal)).rejects.toThrow('cancelled');
		});

		it('should reject when signal is aborted during execution', async () => {
			const fn = withAbortSignal(
				() => new Promise<string>((r) => setTimeout(() => { r('ok'); }, 1000))
			);
			const controller = new AbortController();
			const promise = fn(controller.signal);
			controller.abort();
			await expect(promise).rejects.toThrow('cancelled');
		});
	});
});
