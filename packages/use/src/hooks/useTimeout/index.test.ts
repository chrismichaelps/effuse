import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useTimeout } from './index.js';

describe('useTimeout', () => {
	beforeEach(() => {
		vi.useFakeTimers();
		vi.setSystemTime(0);
		vi.stubGlobal('window', {});
		vi.stubGlobal('document', {});
	});

	afterEach(() => {
		vi.clearAllTimers();
		vi.useRealTimers();
		vi.unstubAllGlobals();
		vi.restoreAllMocks();
	});

	it('starts automatically with a deterministic initial state', () => {
		const timeout = useTimeout({ callback: vi.fn(), delay: 100 });

		expect(timeout.status.value).toBe('running');
		expect(timeout.remaining.value).toBe(100);
		expect(timeout.isRunning.value).toBe(true);
		expect(timeout.isCompleted.value).toBe(false);
		expect(timeout.error.value).toBeNull();
	});

	it('stays idle when immediate is false', () => {
		const timeout = useTimeout({
			callback: vi.fn(),
			delay: 100,
			immediate: false,
		});

		expect(timeout.status.value).toBe('idle');
		expect(timeout.remaining.value).toBe(100);
		expect(vi.getTimerCount()).toBe(0);
	});

	it('updates remaining time and completes exactly once', () => {
		const callback = vi.fn();
		const timeout = useTimeout({ callback, delay: 100 });

		vi.advanceTimersByTime(50);
		expect(timeout.remaining.value).toBe(50);
		vi.advanceTimersByTime(50);

		expect(callback).toHaveBeenCalledOnce();
		expect(timeout.status.value).toBe('completed');
		expect(timeout.remaining.value).toBe(0);
		expect(timeout.isCompleted.value).toBe(true);
		expect(vi.getTimerCount()).toBe(0);
	});

	it('pauses against the deadline and resumes the remaining duration', () => {
		const callback = vi.fn();
		const timeout = useTimeout({ callback, delay: 100 });

		vi.advanceTimersByTime(40);
		timeout.pause();
		expect(timeout.status.value).toBe('paused');
		expect(timeout.remaining.value).toBe(60);

		vi.advanceTimersByTime(100);
		expect(callback).not.toHaveBeenCalled();
		timeout.start();
		vi.advanceTimersByTime(59);
		expect(callback).not.toHaveBeenCalled();
		vi.advanceTimersByTime(1);
		expect(callback).toHaveBeenCalledOnce();
	});

	it('cancels pending work and returns to idle', () => {
		const callback = vi.fn();
		const timeout = useTimeout({ callback, delay: 100 });

		vi.advanceTimersByTime(40);
		timeout.cancel();
		vi.advanceTimersByTime(200);

		expect(callback).not.toHaveBeenCalled();
		expect(timeout.status.value).toBe('idle');
		expect(timeout.remaining.value).toBe(100);
		expect(vi.getTimerCount()).toBe(0);
	});

	it('restarts from the full configured delay', () => {
		const callback = vi.fn();
		const timeout = useTimeout({ callback, delay: 100 });

		vi.advanceTimersByTime(70);
		timeout.restart();
		vi.advanceTimersByTime(99);
		expect(callback).not.toHaveBeenCalled();
		vi.advanceTimersByTime(1);
		expect(callback).toHaveBeenCalledOnce();
	});

	it('does not duplicate a running timeout when start is called again', () => {
		const callback = vi.fn();
		const timeout = useTimeout({ callback, delay: 100 });

		timeout.start();
		timeout.start();
		vi.advanceTimersByTime(100);

		expect(callback).toHaveBeenCalledOnce();
	});

	it('captures callback failures as typed state', () => {
		const cause = new Error('failed');
		const timeout = useTimeout({
			callback: () => {
				throw cause;
			},
			delay: 10,
		});

		vi.advanceTimersByTime(10);

		expect(timeout.status.value).toBe('completed');
		expect(timeout.error.value).toMatchObject({
			name: 'TimeoutError',
			code: 'CALLBACK_FAILED',
			cause,
		});
	});

	it.each([-1, Number.NaN, Number.POSITIVE_INFINITY])(
		'rejects invalid delay %s with a typed error',
		(delay) => {
			expect(() => useTimeout({ callback: vi.fn(), delay })).toThrowError(
				expect.objectContaining({
					name: 'TimeoutError',
					code: 'INVALID_DELAY',
				})
			);
		}
	);

	it('supports an asynchronous zero-delay timeout', () => {
		const callback = vi.fn();
		const timeout = useTimeout({ callback, delay: 0 });

		expect(callback).not.toHaveBeenCalled();
		vi.runOnlyPendingTimers();
		expect(callback).toHaveBeenCalledOnce();
		expect(timeout.status.value).toBe('completed');
	});

	it('does not schedule timers during SSR', () => {
		vi.stubGlobal('window', undefined);
		vi.stubGlobal('document', undefined);
		const callback = vi.fn();
		const timeout = useTimeout({ callback, delay: 100 });

		expect(timeout.status.value).toBe('idle');
		expect(timeout.remaining.value).toBe(100);
		expect(vi.getTimerCount()).toBe(0);
		vi.advanceTimersByTime(200);
		expect(callback).not.toHaveBeenCalled();
	});
});
