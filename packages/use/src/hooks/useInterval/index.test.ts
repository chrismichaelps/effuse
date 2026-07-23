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

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { useInterval } from './index.js';

describe('useInterval', () => {
	beforeEach(() => {
		vi.useFakeTimers();
		vi.stubGlobal('window', {});
		vi.stubGlobal('document', {});
	});

	afterEach(() => {
		vi.useRealTimers();
		vi.unstubAllGlobals();
		vi.restoreAllMocks();
	});

	describe('initialization', () => {
		it('should return count and isRunning signals', () => {
			const callback = vi.fn();
			const { count, isRunning } = useInterval({ callback, delay: 100 });

			expect(typeof count.value).toBe('number');
			expect(typeof isRunning.value).toBe('boolean');
		});

		it('should return control functions', () => {
			const callback = vi.fn();
			const { start, pause, stop } = useInterval({ callback, delay: 100 });

			expect(typeof start).toBe('function');
			expect(typeof pause).toBe('function');
			expect(typeof stop).toBe('function');
		});

		it('should start immediately by default', () => {
			const callback = vi.fn();
			const { isRunning } = useInterval({ callback, delay: 100 });

			expect(isRunning.value).toBe(true);
		});

		it('should not start when immediate is false', () => {
			const callback = vi.fn();
			const { isRunning } = useInterval({
				callback,
				delay: 100,
				immediate: false,
			});

			expect(isRunning.value).toBe(false);
		});

		it('should initialize count at 0', () => {
			const callback = vi.fn();
			const { count } = useInterval({ callback, delay: 100 });

			expect(count.value).toBe(0);
		});
	});

	describe('control functions', () => {
		it('should have pause function that can be called', () => {
			const callback = vi.fn();
			const { pause } = useInterval({ callback, delay: 100 });

			expect(() => pause()).not.toThrow();
		});

		it('should have stop function that can be called', () => {
			const callback = vi.fn();
			const { stop } = useInterval({ callback, delay: 100 });

			expect(() => stop()).not.toThrow();
		});

		it('should have start function that can be called', () => {
			const callback = vi.fn();
			const { start } = useInterval({ callback, delay: 100, immediate: false });

			expect(() => start()).not.toThrow();
		});
	});

	describe('configuration', () => {
		it('should accept delay configuration', () => {
			const callback = vi.fn();
			const { isRunning } = useInterval({ callback, delay: 500 });

			expect(isRunning.value).toBe(true);
		});

		it('should accept immediate false', () => {
			const callback = vi.fn();
			const { isRunning } = useInterval({
				callback,
				delay: 100,
				immediate: false,
			});

			expect(isRunning.value).toBe(false);
		});
	});

	describe('SSR behavior', () => {
		it('should not start in SSR mode', () => {
			vi.stubGlobal('window', undefined);
			vi.stubGlobal('document', undefined);

			const callback = vi.fn();
			const { count, isRunning } = useInterval({ callback, delay: 100 });

			expect(count.value).toBe(0);
			expect(typeof isRunning.value).toBe('boolean');
		});
	});

	describe('edge cases', () => {
		it('should handle very small delay', () => {
			const callback = vi.fn();
			const { isRunning } = useInterval({ callback, delay: 1 });

			expect(isRunning.value).toBe(true);
		});

		it('should handle very large delay', () => {
			const callback = vi.fn();
			const { isRunning } = useInterval({ callback, delay: 1000000 });

			expect(isRunning.value).toBe(true);
		});

		it('should handle negative delay gracefully', () => {
			const callback = vi.fn();

			expect(() => useInterval({ callback, delay: -100 })).not.toThrow();
		});

		it('should handle zero delay', () => {
			const callback = vi.fn();
			const { isRunning } = useInterval({ callback, delay: 0 });

			expect(isRunning.value).toBe(true);
		});

		it('should handle multiple start calls', () => {
			const callback = vi.fn();
			const { start } = useInterval({ callback, delay: 100 });

			expect(() => {
				start();
				start();
				start();
			}).not.toThrow();
		});

		it('should handle pause after stop', () => {
			const callback = vi.fn();
			const { stop, pause } = useInterval({ callback, delay: 100 });

			stop();

			expect(() => pause()).not.toThrow();
		});
	});

	describe('tick behavior', () => {
		it('should not call callback when not running', () => {
			const callback = vi.fn();
			useInterval({ callback, delay: 100, immediate: false });

			vi.advanceTimersByTime(300);
			expect(callback).not.toHaveBeenCalled();
		});
	});

	describe('pause behavior', () => {
		it('should set isRunning to false on pause', () => {
			const callback = vi.fn();
			const { pause, isRunning } = useInterval({ callback, delay: 100 });

			expect(isRunning.value).toBe(true);
			pause();
			expect(isRunning.value).toBe(false);
		});
	});

	describe('status exposure', () => {
		it('should expose status, isPaused, and isStopped signals', () => {
			const callback = vi.fn();
			const { status, isPaused, isStopped } = useInterval({
				callback,
				delay: 100,
			});

			expect(status.value).toBe('running');
			expect(isPaused.value).toBe(false);
			expect(isStopped.value).toBe(false);
		});

		it('should report stopped before start when immediate is false', () => {
			const callback = vi.fn();
			const { status, isPaused, isStopped, isRunning } = useInterval({
				callback,
				delay: 100,
				immediate: false,
			});

			expect(status.value).toBe('stopped');
			expect(isStopped.value).toBe(true);
			expect(isPaused.value).toBe(false);
			expect(isRunning.value).toBe(false);
		});

		it('should report paused rather than stopped after pause', () => {
			const callback = vi.fn();
			const { pause, status, isPaused, isStopped, isRunning } = useInterval({
				callback,
				delay: 100,
			});

			pause();

			expect(status.value).toBe('paused');
			expect(isPaused.value).toBe(true);
			expect(isStopped.value).toBe(false);
			expect(isRunning.value).toBe(false);
		});

		it('should report stopped after stop', () => {
			const callback = vi.fn();
			const { stop, status, isPaused, isStopped } = useInterval({
				callback,
				delay: 100,
			});

			stop();

			expect(status.value).toBe('stopped');
			expect(isStopped.value).toBe(true);
			expect(isPaused.value).toBe(false);
		});

		it('should keep a stopped interval stopped when pause is called', () => {
			const callback = vi.fn();
			const { stop, pause, status, isPaused, isStopped } = useInterval({
				callback,
				delay: 100,
			});

			stop();
			pause();

			expect(status.value).toBe('stopped');
			expect(isStopped.value).toBe(true);
			expect(isPaused.value).toBe(false);
		});

		it('should not enter paused when pause is called before any start', () => {
			const callback = vi.fn();
			const { pause, status } = useInterval({
				callback,
				delay: 100,
				immediate: false,
			});

			pause();

			expect(status.value).toBe('stopped');
		});

		it('should retain count across pause and resume', () => {
			const callback = vi.fn();
			const { start, pause, count, status } = useInterval({
				callback,
				delay: 100,
			});

			vi.advanceTimersByTime(300);
			expect(count.value).toBe(3);

			pause();
			expect(status.value).toBe('paused');
			expect(count.value).toBe(3);

			start();
			expect(status.value).toBe('running');
			expect(count.value).toBe(3);

			vi.advanceTimersByTime(100);
			expect(count.value).toBe(4);
		});

		it('should reset count when stopped and restart from zero', () => {
			const callback = vi.fn();
			const { start, stop, count, status } = useInterval({
				callback,
				delay: 100,
			});

			vi.advanceTimersByTime(200);
			expect(count.value).toBe(2);

			stop();
			expect(count.value).toBe(0);

			start();
			expect(status.value).toBe('running');
			expect(count.value).toBe(0);
		});

		it('should keep paused state and count on repeated pause calls', () => {
			const callback = vi.fn();
			const { pause, count, status } = useInterval({ callback, delay: 100 });

			vi.advanceTimersByTime(200);
			pause();
			pause();

			expect(status.value).toBe('paused');
			expect(count.value).toBe(2);
		});

		it('should report stopped during SSR without browser work', () => {
			vi.stubGlobal('window', undefined);
			vi.stubGlobal('document', undefined);

			const callback = vi.fn();
			const { status, isStopped } = useInterval({ callback, delay: 100 });

			expect(status.value).toBe('stopped');
			expect(isStopped.value).toBe(true);
		});
	});

	describe('stop behavior', () => {
		it('should reset count on stop', () => {
			const callback = vi.fn();
			const { count, stop } = useInterval({ callback, delay: 100 });

			stop();
			expect(count.value).toBe(0);
		});

		it('should set isRunning to false on stop', () => {
			const callback = vi.fn();
			const { stop, isRunning } = useInterval({ callback, delay: 100 });

			expect(isRunning.value).toBe(true);
			stop();
			expect(isRunning.value).toBe(false);
		});
	});
});
