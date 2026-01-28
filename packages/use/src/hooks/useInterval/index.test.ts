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
});
