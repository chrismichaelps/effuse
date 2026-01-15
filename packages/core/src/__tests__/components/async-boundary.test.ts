// @vitest-environment node
import { describe, it, expect, vi } from 'vitest';
import {
	isAsyncIdle,
	isAsyncLoading,
	isAsyncSuccess,
	isAsyncError,
	matchAsyncStatus,
	AsyncBoundaryError,
	type AsyncBoundaryStatus,
} from '../../components/AsyncBoundary.js';

describe('AsyncBoundary', () => {
	describe('Type Guards', () => {
		describe('isAsyncIdle', () => {
			it('should return true for idle status', () => {
				expect(isAsyncIdle('idle')).toBe(true);
			});

			it('should return false for other statuses', () => {
				expect(isAsyncIdle('loading')).toBe(false);
				expect(isAsyncIdle('success')).toBe(false);
				expect(isAsyncIdle('error')).toBe(false);
			});
		});

		describe('isAsyncLoading', () => {
			it('should return true for loading status', () => {
				expect(isAsyncLoading('loading')).toBe(true);
			});

			it('should return false for other statuses', () => {
				expect(isAsyncLoading('idle')).toBe(false);
				expect(isAsyncLoading('success')).toBe(false);
				expect(isAsyncLoading('error')).toBe(false);
			});
		});

		describe('isAsyncSuccess', () => {
			it('should return true for success status', () => {
				expect(isAsyncSuccess('success')).toBe(true);
			});

			it('should return false for other statuses', () => {
				expect(isAsyncSuccess('idle')).toBe(false);
				expect(isAsyncSuccess('loading')).toBe(false);
				expect(isAsyncSuccess('error')).toBe(false);
			});
		});

		describe('isAsyncError', () => {
			it('should return true for error status', () => {
				expect(isAsyncError('error')).toBe(true);
			});

			it('should return false for other statuses', () => {
				expect(isAsyncError('idle')).toBe(false);
				expect(isAsyncError('loading')).toBe(false);
				expect(isAsyncError('success')).toBe(false);
			});
		});
	});

	describe('matchAsyncStatus', () => {
		it('should call onIdle handler for idle status', () => {
			const result = matchAsyncStatus('idle', {
				onIdle: () => 'idle-result',
				onLoading: () => 'loading-result',
				onSuccess: () => 'success-result',
				onError: () => 'error-result',
			});

			expect(result).toBe('idle-result');
		});

		it('should call onLoading handler for loading status', () => {
			const result = matchAsyncStatus('loading', {
				onIdle: () => 'idle-result',
				onLoading: () => 'loading-result',
				onSuccess: () => 'success-result',
				onError: () => 'error-result',
			});

			expect(result).toBe('loading-result');
		});

		it('should call onSuccess handler for success status', () => {
			const result = matchAsyncStatus('success', {
				onIdle: () => 'idle-result',
				onLoading: () => 'loading-result',
				onSuccess: () => 'success-result',
				onError: () => 'error-result',
			});

			expect(result).toBe('success-result');
		});

		it('should call onError handler for error status', () => {
			const result = matchAsyncStatus('error', {
				onIdle: () => 'idle-result',
				onLoading: () => 'loading-result',
				onSuccess: () => 'success-result',
				onError: () => 'error-result',
			});

			expect(result).toBe('error-result');
		});

		it('should be exhaustive for all statuses', () => {
			const statuses: AsyncBoundaryStatus[] = [
				'idle',
				'loading',
				'success',
				'error',
			];
			const results: string[] = [];

			for (const status of statuses) {
				results.push(
					matchAsyncStatus(status, {
						onIdle: () => 'idle',
						onLoading: () => 'loading',
						onSuccess: () => 'success',
						onError: () => 'error',
					})
				);
			}

			expect(results).toEqual(['idle', 'loading', 'success', 'error']);
		});

		it('should support generic return types', () => {
			const result = matchAsyncStatus('loading', {
				onIdle: () => ({ loading: false, data: null as string | null }),
				onLoading: () => ({ loading: true, data: null as string | null }),
				onSuccess: () => ({ loading: false, data: 'done' as string | null }),
				onError: () => ({ loading: false, data: null as string | null }),
			});

			expect(result).toEqual({ loading: true, data: null });
		});
	});

	describe('AsyncBoundaryError', () => {
		it('should be an instance of Error', () => {
			const error = new AsyncBoundaryError({
				cause: new Error('Original error'),
				retryCount: 0,
			});

			expect(error).toBeInstanceOf(Error);
		});

		it('should have _tag property set to AsyncBoundaryError', () => {
			const error = new AsyncBoundaryError({
				cause: 'test cause',
				retryCount: 1,
			});

			expect(error._tag).toBe('AsyncBoundaryError');
		});

		it('should store cause property', () => {
			const cause = new Error('Network failure');
			const error = new AsyncBoundaryError({
				cause,
				retryCount: 2,
			});

			expect(error.cause).toBe(cause);
		});

		it('should store retryCount property', () => {
			const error = new AsyncBoundaryError({
				cause: 'timeout',
				retryCount: 3,
			});

			expect(error.retryCount).toBe(3);
		});

		it('should support retryCount of 0', () => {
			const error = new AsyncBoundaryError({
				cause: null,
				retryCount: 0,
			});

			expect(error.retryCount).toBe(0);
		});

		it('should support unknown cause types', () => {
			const causes = ['string error', 42, { code: 'ERR_001' }, null, undefined];

			for (const cause of causes) {
				const error = new AsyncBoundaryError({ cause, retryCount: 0 });
				expect(error.cause).toBe(cause);
			}
		});
	});

	describe('Status Coverage', () => {
		it('should have exactly 4 statuses', () => {
			const statuses: AsyncBoundaryStatus[] = [
				'idle',
				'loading',
				'success',
				'error',
			];
			expect(statuses).toHaveLength(4);
		});

		it('should correctly identify all statuses with type guards', () => {
			const statuses: AsyncBoundaryStatus[] = [
				'idle',
				'loading',
				'success',
				'error',
			];

			const idleCount = statuses.filter(isAsyncIdle).length;
			const loadingCount = statuses.filter(isAsyncLoading).length;
			const successCount = statuses.filter(isAsyncSuccess).length;
			const errorCount = statuses.filter(isAsyncError).length;

			expect(idleCount).toBe(1);
			expect(loadingCount).toBe(1);
			expect(successCount).toBe(1);
			expect(errorCount).toBe(1);
		});
	});

	describe('Edge Cases', () => {
		describe('Type Guard Edge Cases', () => {
			it('should handle status stored in variables', () => {
				let status: AsyncBoundaryStatus = 'idle';
				expect(isAsyncIdle(status)).toBe(true);

				status = 'loading';
				expect(isAsyncLoading(status)).toBe(true);

				status = 'success';
				expect(isAsyncSuccess(status)).toBe(true);

				status = 'error';
				expect(isAsyncError(status)).toBe(true);
			});

			it('should handle status from object property', () => {
				const query = { status: 'loading' as AsyncBoundaryStatus, data: null };
				expect(isAsyncLoading(query.status)).toBe(true);

				query.status = 'success';
				expect(isAsyncSuccess(query.status)).toBe(true);
			});

			it('should work in type narrowing context', () => {
				const getStatusMessage = (status: AsyncBoundaryStatus): string => {
					if (isAsyncIdle(status)) return 'Waiting to start';
					if (isAsyncLoading(status)) return 'Loading...';
					if (isAsyncSuccess(status)) return 'Complete!';
					if (isAsyncError(status)) return 'Failed!';
					return 'Unknown';
				};

				expect(getStatusMessage('idle')).toBe('Waiting to start');
				expect(getStatusMessage('loading')).toBe('Loading...');
				expect(getStatusMessage('success')).toBe('Complete!');
				expect(getStatusMessage('error')).toBe('Failed!');
			});

			it('should handle rapid status changes', () => {
				const sequence: AsyncBoundaryStatus[] = [
					'idle',
					'loading',
					'error',
					'loading',
					'success',
				];

				for (const status of sequence) {
					const guards = [
						isAsyncIdle,
						isAsyncLoading,
						isAsyncSuccess,
						isAsyncError,
					];
					const matchCount = guards.filter((g) => g(status)).length;
					expect(matchCount).toBe(1);
				}
			});
		});

		describe('Match Function Edge Cases', () => {
			it('should only call matching handler once', () => {
				const handlers = {
					onIdle: vi.fn(() => 'idle'),
					onLoading: vi.fn(() => 'loading'),
					onSuccess: vi.fn(() => 'success'),
					onError: vi.fn(() => 'error'),
				};

				matchAsyncStatus('success', handlers);

				expect(handlers.onIdle).not.toHaveBeenCalled();
				expect(handlers.onLoading).not.toHaveBeenCalled();
				expect(handlers.onSuccess).toHaveBeenCalledTimes(1);
				expect(handlers.onError).not.toHaveBeenCalled();
			});

			it('should handle handlers returning null or undefined', () => {
				const nullResult = matchAsyncStatus('idle', {
					onIdle: () => null,
					onLoading: () => 'loading',
					onSuccess: () => 'success',
					onError: () => 'error',
				});

				const undefinedResult = matchAsyncStatus('loading', {
					onIdle: () => 'idle',
					onLoading: () => undefined,
					onSuccess: () => 'success',
					onError: () => 'error',
				});

				expect(nullResult).toBeNull();
				expect(undefinedResult).toBeUndefined();
			});

			it('should handle handlers that throw', () => {
				expect(() => {
					matchAsyncStatus('error', {
						onIdle: () => 'idle',
						onLoading: () => 'loading',
						onSuccess: () => 'success',
						onError: () => {
							throw new Error('Error handler failed');
						},
					});
				}).toThrow('Error handler failed');
			});

			it('should handle async handlers', async () => {
				const result = matchAsyncStatus('success', {
					onIdle: () => Promise.resolve({ data: null as number[] | null }),
					onLoading: () => Promise.resolve({ data: null as number[] | null }),
					onSuccess: () =>
						Promise.resolve({ data: [1, 2, 3] as number[] | null }),
					onError: () => Promise.resolve({ data: null as number[] | null }),
				});

				expect(result).toBeInstanceOf(Promise);
				const resolved = await result;
				expect(resolved).toEqual({ data: [1, 2, 3] });
			});

			it('should support complex nested return types', () => {
				const result = matchAsyncStatus('success', {
					onIdle: () => ({ status: 'idle', meta: { attempts: 0 } }),
					onLoading: () => ({ status: 'loading', meta: { attempts: 1 } }),
					onSuccess: () => ({
						status: 'success',
						meta: { attempts: 2 },
						data: { items: [{ id: 1 }] },
					}),
					onError: () => ({ status: 'error', meta: { attempts: 3 } }),
				});

				expect(result).toEqual({
					status: 'success',
					meta: { attempts: 2 },
					data: { items: [{ id: 1 }] },
				});
			});
		});

		describe('AsyncBoundaryError Edge Cases', () => {
			it('should handle high retry counts', () => {
				const error = new AsyncBoundaryError({
					cause: 'max retries exceeded',
					retryCount: 999,
				});

				expect(error.retryCount).toBe(999);
			});

			it('should handle nested Error causes', () => {
				const innerError = new Error('Inner error');
				const middleError = new AsyncBoundaryError({
					cause: innerError,
					retryCount: 1,
				});
				const outerError = new AsyncBoundaryError({
					cause: middleError,
					retryCount: 2,
				});

				expect(outerError.cause).toBe(middleError);
				expect((outerError.cause as AsyncBoundaryError).cause).toBe(innerError);
			});

			it('should handle Error objects with custom properties', () => {
				const customError = Object.assign(new Error('Custom error'), {
					code: 'ERR_NETWORK',
					statusCode: 500,
				});

				const error = new AsyncBoundaryError({
					cause: customError,
					retryCount: 1,
				});

				expect((error.cause as typeof customError).code).toBe('ERR_NETWORK');
				expect((error.cause as typeof customError).statusCode).toBe(500);
			});

			it('should handle array causes', () => {
				const errors = [
					new Error('Error 1'),
					new Error('Error 2'),
					new Error('Error 3'),
				];

				const error = new AsyncBoundaryError({
					cause: errors,
					retryCount: 3,
				});

				expect(Array.isArray(error.cause)).toBe(true);
				expect((error.cause as Error[]).length).toBe(3);
			});

			it('should be usable in error handling patterns', () => {
				const handleError = (err: unknown): string => {
					if (err instanceof AsyncBoundaryError) {
						return `AsyncBoundary failed after ${String(err.retryCount)} retries`;
					}
					return 'Unknown error';
				};

				const error = new AsyncBoundaryError({
					cause: 'timeout',
					retryCount: 5,
				});

				expect(handleError(error)).toBe('AsyncBoundary failed after 5 retries');
				expect(handleError(new Error('other'))).toBe('Unknown error');
			});
		});

		describe('Async Lifecycle Edge Cases', () => {
			it('should handle typical async operation lifecycle', () => {
				const lifecycle: AsyncBoundaryStatus[] = ['idle', 'loading', 'success'];
				const messages: string[] = [];

				for (const status of lifecycle) {
					messages.push(
						matchAsyncStatus(status, {
							onIdle: () => 'Request not started',
							onLoading: () => 'Fetching data...',
							onSuccess: () => 'Data loaded successfully',
							onError: () => 'Request failed',
						})
					);
				}

				expect(messages).toEqual([
					'Request not started',
					'Fetching data...',
					'Data loaded successfully',
				]);
			});

			it('should handle retry lifecycle', () => {
				const lifecycle: AsyncBoundaryStatus[] = [
					'idle',
					'loading',
					'error',
					'loading',
					'error',
					'loading',
					'success',
				];

				let retryCount = 0;
				const results: { status: string; attempt: number }[] = [];

				for (const status of lifecycle) {
					matchAsyncStatus(status, {
						onIdle: () => {
							results.push({ status: 'idle', attempt: 0 });
							return null;
						},
						onLoading: () => {
							retryCount++;
							results.push({ status: 'loading', attempt: retryCount });
							return null;
						},
						onSuccess: () => {
							results.push({ status: 'success', attempt: retryCount });
							return null;
						},
						onError: () => {
							results.push({ status: 'error', attempt: retryCount });
							return null;
						},
					});
				}

				expect(retryCount).toBe(3);
				expect(results[results.length - 1]).toEqual({
					status: 'success',
					attempt: 3,
				});
			});

			it('should handle multiple concurrent async operations', () => {
				const operations: { id: number; status: AsyncBoundaryStatus }[] = [
					{ id: 1, status: 'loading' },
					{ id: 2, status: 'success' },
					{ id: 3, status: 'error' },
					{ id: 4, status: 'idle' },
				];

				const loading = operations.filter((op) => isAsyncLoading(op.status));
				const successful = operations.filter((op) => isAsyncSuccess(op.status));
				const failed = operations.filter((op) => isAsyncError(op.status));
				const pending = operations.filter((op) => isAsyncIdle(op.status));

				expect(loading.map((op) => op.id)).toEqual([1]);
				expect(successful.map((op) => op.id)).toEqual([2]);
				expect(failed.map((op) => op.id)).toEqual([3]);
				expect(pending.map((op) => op.id)).toEqual([4]);
			});
		});
	});
});
