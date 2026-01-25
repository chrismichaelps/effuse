// @vitest-environment node
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
	ResourceStatus,
	isResourceLoading,
	isResourceSuccess,
	isResourceError,
	isResourceStale,
	matchResourceStatus,
	SuspenseBoundaryAction,
	traceResourceLoading,
	traceResourceSuccess,
	traceResourceError,
	traceSuspenseBoundary,
} from '../../../layers/tracing/suspense.js';
import {
	setGlobalTracing,
	clearGlobalTracing,
} from '../../../layers/tracing/global.js';

describe('ResourceStatus TaggedEnum', () => {
	describe('Constructors', () => {
		it('should create Loading status', () => {
			const status = ResourceStatus.Loading();
			expect(status._tag).toBe('Loading');
		});

		it('should create Success status without itemCount', () => {
			const status = ResourceStatus.Success({});
			expect(status._tag).toBe('Success');
			expect(status.itemCount).toBeUndefined();
		});

		it('should create Success status with itemCount', () => {
			const status = ResourceStatus.Success({ itemCount: 42 });
			expect(status._tag).toBe('Success');
			expect(status.itemCount).toBe(42);
		});

		it('should create Error status with error message', () => {
			const status = ResourceStatus.Error({ error: 'Network failed' });
			expect(status._tag).toBe('Error');
			expect(status.error).toBe('Network failed');
		});

		it('should create Stale status', () => {
			const status = ResourceStatus.Stale();
			expect(status._tag).toBe('Stale');
		});
	});

	describe('Type Guards', () => {
		describe('isResourceLoading', () => {
			it('should return true for Loading', () => {
				expect(isResourceLoading(ResourceStatus.Loading())).toBe(true);
			});

			it('should return false for other statuses', () => {
				expect(isResourceLoading(ResourceStatus.Success({}))).toBe(false);
				expect(isResourceLoading(ResourceStatus.Error({ error: 'err' }))).toBe(
					false
				);
				expect(isResourceLoading(ResourceStatus.Stale())).toBe(false);
			});
		});

		describe('isResourceSuccess', () => {
			it('should return true for Success', () => {
				expect(isResourceSuccess(ResourceStatus.Success({}))).toBe(true);
				expect(
					isResourceSuccess(ResourceStatus.Success({ itemCount: 10 }))
				).toBe(true);
			});

			it('should return false for other statuses', () => {
				expect(isResourceSuccess(ResourceStatus.Loading())).toBe(false);
				expect(isResourceSuccess(ResourceStatus.Error({ error: 'err' }))).toBe(
					false
				);
				expect(isResourceSuccess(ResourceStatus.Stale())).toBe(false);
			});
		});

		describe('isResourceError', () => {
			it('should return true for Error', () => {
				expect(isResourceError(ResourceStatus.Error({ error: 'failed' }))).toBe(
					true
				);
			});

			it('should return false for other statuses', () => {
				expect(isResourceError(ResourceStatus.Loading())).toBe(false);
				expect(isResourceError(ResourceStatus.Success({}))).toBe(false);
				expect(isResourceError(ResourceStatus.Stale())).toBe(false);
			});
		});

		describe('isResourceStale', () => {
			it('should return true for Stale', () => {
				expect(isResourceStale(ResourceStatus.Stale())).toBe(true);
			});

			it('should return false for other statuses', () => {
				expect(isResourceStale(ResourceStatus.Loading())).toBe(false);
				expect(isResourceStale(ResourceStatus.Success({}))).toBe(false);
				expect(isResourceStale(ResourceStatus.Error({ error: 'err' }))).toBe(
					false
				);
			});
		});
	});

	describe('matchResourceStatus', () => {
		it('should call Loading handler', () => {
			const result = matchResourceStatus(ResourceStatus.Loading(), {
				Loading: () => 'loading',
				Success: () => 'success',
				Error: () => 'error',
				Stale: () => 'stale',
			});
			expect(result).toBe('loading');
		});

		it('should call Success handler with data', () => {
			const result = matchResourceStatus(
				ResourceStatus.Success({ itemCount: 5 }),
				{
					Loading: () => null,
					Success: ({ itemCount }) => `loaded ${String(itemCount)} items`,
					Error: () => null,
					Stale: () => null,
				}
			);
			expect(result).toBe('loaded 5 items');
		});

		it('should call Error handler with error message', () => {
			const result = matchResourceStatus(
				ResourceStatus.Error({ error: 'timeout' }),
				{
					Loading: () => null,
					Success: () => null,
					Error: ({ error }) => `failed: ${error}`,
					Stale: () => null,
				}
			);
			expect(result).toBe('failed: timeout');
		});

		it('should call Stale handler', () => {
			const result = matchResourceStatus(ResourceStatus.Stale(), {
				Loading: () => 'loading',
				Success: () => 'success',
				Error: () => 'error',
				Stale: () => 'stale',
			});
			expect(result).toBe('stale');
		});

		it('should support complex return types', () => {
			const result = matchResourceStatus(
				ResourceStatus.Success({ itemCount: 10 }),
				{
					Loading: () => ({ state: 'pending', data: null }),
					Success: ({ itemCount }) => ({
						state: 'ready',
						data: { count: itemCount },
					}),
					Error: ({ error }) => ({ state: 'failed', data: { message: error } }),
					Stale: () => ({ state: 'outdated', data: null }),
				}
			);
			expect(result).toEqual({ state: 'ready', data: { count: 10 } });
		});
	});

	describe('Edge Cases', () => {
		it('should handle Success with zero itemCount', () => {
			const status = ResourceStatus.Success({ itemCount: 0 });
			expect(status.itemCount).toBe(0);
			expect(isResourceSuccess(status)).toBe(true);
		});

		it('should handle Error with empty string', () => {
			const status = ResourceStatus.Error({ error: '' });
			expect(status.error).toBe('');
			expect(isResourceError(status)).toBe(true);
		});

		it('should handle Error with long error message', () => {
			const longError = 'A'.repeat(10000);
			const status = ResourceStatus.Error({ error: longError });
			expect(status.error).toBe(longError);
		});

		it('should work in state machine pattern', () => {
			type State =
				| ReturnType<typeof ResourceStatus.Loading>
				| ReturnType<typeof ResourceStatus.Success>
				| ReturnType<typeof ResourceStatus.Error>
				| ReturnType<typeof ResourceStatus.Stale>;

			let state: State = ResourceStatus.Loading();
			expect(isResourceLoading(state)).toBe(true);

			state = ResourceStatus.Success({ itemCount: 5 });
			expect(isResourceSuccess(state)).toBe(true);

			state = ResourceStatus.Stale();
			expect(isResourceStale(state)).toBe(true);

			state = ResourceStatus.Loading();
			expect(isResourceLoading(state)).toBe(true);

			state = ResourceStatus.Error({ error: 'Network error' });
			expect(isResourceError(state)).toBe(true);
		});
	});
});

describe('SuspenseBoundaryAction TaggedEnum', () => {
	describe('Constructors', () => {
		it('should create Suspend action', () => {
			const action = SuspenseBoundaryAction.Suspend();
			expect(action._tag).toBe('Suspend');
		});

		it('should create Resolve action', () => {
			const action = SuspenseBoundaryAction.Resolve();
			expect(action._tag).toBe('Resolve');
		});
	});

	describe('$is type guards', () => {
		it('should identify Suspend action', () => {
			const action = SuspenseBoundaryAction.Suspend();
			expect(SuspenseBoundaryAction.$is('Suspend')(action)).toBe(true);
			expect(SuspenseBoundaryAction.$is('Resolve')(action)).toBe(false);
		});

		it('should identify Resolve action', () => {
			const action = SuspenseBoundaryAction.Resolve();
			expect(SuspenseBoundaryAction.$is('Resolve')(action)).toBe(true);
			expect(SuspenseBoundaryAction.$is('Suspend')(action)).toBe(false);
		});
	});

	describe('$match pattern matching', () => {
		it('should match Suspend action', () => {
			const result = SuspenseBoundaryAction.$match(
				SuspenseBoundaryAction.Suspend(),
				{
					Suspend: () => 'suspended',
					Resolve: () => 'resolved',
				}
			);
			expect(result).toBe('suspended');
		});

		it('should match Resolve action', () => {
			const result = SuspenseBoundaryAction.$match(
				SuspenseBoundaryAction.Resolve(),
				{
					Suspend: () => 'suspended',
					Resolve: () => 'resolved',
				}
			);
			expect(result).toBe('resolved');
		});
	});
});

describe('Tracing Functions', () => {
	let mockTracing: {
		log: ReturnType<typeof vi.fn>;
		logWithDuration: ReturnType<typeof vi.fn>;
		isCategoryEnabled: ReturnType<typeof vi.fn>;
	};

	beforeEach(() => {
		mockTracing = {
			log: vi.fn(),
			logWithDuration: vi.fn(),
			isCategoryEnabled: vi.fn().mockReturnValue(true),
		};
		setGlobalTracing(
			mockTracing as unknown as Parameters<typeof setGlobalTracing>[0]
		);
	});

	afterEach(() => {
		clearGlobalTracing();
	});

	describe('traceResourceLoading', () => {
		it('should log loading status with correct parameters', () => {
			traceResourceLoading('user-data');

			expect(mockTracing.log).toHaveBeenCalledTimes(1);
			const callArgs = mockTracing.log.mock.calls[0] as unknown[];
			expect(callArgs[0]).toBe('suspense');
			expect(callArgs[1]).toBe('resource');
			expect(callArgs[2]).toBe('user-data');
			const data = callArgs[3] as { status: { _tag: string } };
			expect(data.status._tag).toBe('Loading');
		});

		it('should not log when tracing is disabled', () => {
			mockTracing.isCategoryEnabled.mockReturnValue(false);
			traceResourceLoading('test-key');
			expect(mockTracing.log).not.toHaveBeenCalled();
		});

		it('should not log when tracing is null', () => {
			clearGlobalTracing();
			traceResourceLoading('test-key');
			expect(mockTracing.log).not.toHaveBeenCalled();
		});
	});

	describe('traceResourceSuccess', () => {
		it('should log success without itemCount', () => {
			traceResourceSuccess('api-call', 150);

			expect(mockTracing.logWithDuration).toHaveBeenCalledTimes(1);
			const callArgs = mockTracing.logWithDuration.mock.calls[0] as unknown[];
			expect(callArgs[0]).toBe('suspense');
			expect(callArgs[1]).toBe('resource');
			expect(callArgs[2]).toBe('api-call');
			expect(callArgs[3]).toBe(150);
			const data = callArgs[4] as { status: { _tag: string } };
			expect(data.status._tag).toBe('Success');
		});

		it('should log success with itemCount', () => {
			traceResourceSuccess('list-fetch', 200, 25);

			expect(mockTracing.logWithDuration).toHaveBeenCalledTimes(1);
			const callArgs = mockTracing.logWithDuration.mock.calls[0] as unknown[];
			expect(callArgs[0]).toBe('suspense');
			expect(callArgs[1]).toBe('resource');
			expect(callArgs[2]).toBe('list-fetch');
			expect(callArgs[3]).toBe(200);
			const data = callArgs[4] as {
				status: { _tag: string; itemCount: number };
			};
			expect(data.status._tag).toBe('Success');
			expect(data.status.itemCount).toBe(25);
		});

		it('should not log when tracing is disabled', () => {
			mockTracing.isCategoryEnabled.mockReturnValue(false);
			traceResourceSuccess('test', 100);
			expect(mockTracing.logWithDuration).not.toHaveBeenCalled();
		});
	});

	describe('traceResourceError', () => {
		it('should log error with message and duration', () => {
			traceResourceError('failed-request', 'Connection refused', 5000);

			expect(mockTracing.logWithDuration).toHaveBeenCalledTimes(1);
			const callArgs = mockTracing.logWithDuration.mock.calls[0] as unknown[];
			expect(callArgs[0]).toBe('suspense');
			expect(callArgs[1]).toBe('resource');
			expect(callArgs[2]).toBe('failed-request');
			expect(callArgs[3]).toBe(5000);
			const data = callArgs[4] as { status: { _tag: string; error: string } };
			expect(data.status._tag).toBe('Error');
			expect(data.status.error).toBe('Connection refused');
		});

		it('should not log when tracing is disabled', () => {
			mockTracing.isCategoryEnabled.mockReturnValue(false);
			traceResourceError('test', 'error', 100);
			expect(mockTracing.logWithDuration).not.toHaveBeenCalled();
		});
	});

	describe('traceSuspenseBoundary', () => {
		it('should log suspend action', () => {
			traceSuspenseBoundary('MyBoundary', SuspenseBoundaryAction.Suspend());

			expect(mockTracing.log).toHaveBeenCalledTimes(1);
			const callArgs = mockTracing.log.mock.calls[0] as unknown[];
			expect(callArgs[0]).toBe('suspense');
			expect(callArgs[1]).toBe('boundary');
			expect(callArgs[2]).toBe('MyBoundary');
			const data = callArgs[3] as { action: { _tag: string } };
			expect(data.action._tag).toBe('Suspend');
		});

		it('should log resolve action', () => {
			traceSuspenseBoundary('MyBoundary', SuspenseBoundaryAction.Resolve());

			expect(mockTracing.log).toHaveBeenCalledTimes(1);
			const callArgs = mockTracing.log.mock.calls[0] as unknown[];
			expect(callArgs[0]).toBe('suspense');
			expect(callArgs[1]).toBe('boundary');
			expect(callArgs[2]).toBe('MyBoundary');
			const data = callArgs[3] as { action: { _tag: string } };
			expect(data.action._tag).toBe('Resolve');
		});

		it('should not log when tracing is disabled', () => {
			mockTracing.isCategoryEnabled.mockReturnValue(false);
			traceSuspenseBoundary('test', SuspenseBoundaryAction.Suspend());
			expect(mockTracing.log).not.toHaveBeenCalled();
		});
	});
});
