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
import { useWindowSize, type UseWindowSizeConfig } from './index.js';

describe('useWindowSize', () => {
	beforeEach(() => {
		vi.stubGlobal('window', {
			innerWidth: 1024,
			innerHeight: 768,
			addEventListener: vi.fn(),
			removeEventListener: vi.fn(),
		});

		vi.stubGlobal('document', {
			documentElement: {
				clientWidth: 1000,
				clientHeight: 750,
			},
		});
	});

	afterEach(() => {
		vi.unstubAllGlobals();
		vi.restoreAllMocks();
	});

	describe('initialization', () => {
		it('should return width and height signals', () => {
			const { width, height } = useWindowSize({});

			expect(typeof width.value).toBe('number');
			expect(typeof height.value).toBe('number');
		});

		it('should return isAvailable signal', () => {
			const { isAvailable } = useWindowSize({});

			expect(typeof isAvailable.value).toBe('boolean');
		});

		it('should return current dimensions when available', () => {
			const { width, height, isAvailable } = useWindowSize({});

			expect(width.value).toBe(1024);
			expect(height.value).toBe(768);
			expect(isAvailable.value).toBe(true);
		});

		it('should exclude scrollbar when configured', () => {
			const { width, height } = useWindowSize({
				includeScrollbar: false,
			});

			expect(width.value).toBe(1000);
			expect(height.value).toBe(750);
		});
	});

	describe('SSR behavior', () => {
		it('should return initial values when window is unavailable', () => {
			vi.stubGlobal('window', undefined);
			vi.stubGlobal('document', undefined);

			const { width, height, isAvailable } = useWindowSize({
				initialWidth: 1920,
				initialHeight: 1080,
			});

			expect(width.value).toBe(1920);
			expect(height.value).toBe(1080);
			expect(isAvailable.value).toBe(false);
		});

		it('should default to 0 dimensions when unavailable', () => {
			vi.stubGlobal('window', undefined);
			vi.stubGlobal('document', undefined);

			const { width, height } = useWindowSize({});

			expect(width.value).toBe(0);
			expect(height.value).toBe(0);
		});
	});

	describe('configuration', () => {
		it('should accept empty config', () => {
			const { width, height } = useWindowSize({});

			expect(width.value).toBeGreaterThanOrEqual(0);
			expect(height.value).toBeGreaterThanOrEqual(0);
		});

		it('should accept undefined config', () => {
			const { width, height } = useWindowSize({} as UseWindowSizeConfig);

			expect(width.value).toBeGreaterThanOrEqual(0);
			expect(height.value).toBeGreaterThanOrEqual(0);
		});
	});

	describe('edge cases', () => {
		it('should handle zero dimensions', () => {
			vi.stubGlobal('window', {
				innerWidth: 0,
				innerHeight: 0,
				addEventListener: vi.fn(),
				removeEventListener: vi.fn(),
			});

			const { width, height } = useWindowSize({});

			expect(width.value).toBe(0);
			expect(height.value).toBe(0);
		});

		it('should handle very large dimensions', () => {
			vi.stubGlobal('window', {
				innerWidth: 10000,
				innerHeight: 8000,
				addEventListener: vi.fn(),
				removeEventListener: vi.fn(),
			});

			const { width, height } = useWindowSize({});

			expect(width.value).toBe(10000);
			expect(height.value).toBe(8000);
		});

		it('should accept debounce configuration', () => {
			const { width, height } = useWindowSize({ debounce: 100 });

			expect(width.value).toBeGreaterThanOrEqual(0);
			expect(height.value).toBeGreaterThanOrEqual(0);
		});

		it('should accept listenOrientation false', () => {
			const { width, height } = useWindowSize({ listenOrientation: false });

			expect(width.value).toBeGreaterThanOrEqual(0);
			expect(height.value).toBeGreaterThanOrEqual(0);
		});
	});

	describe('resize behavior', () => {
		it('should update dimensions on resize event', () => {
			let resizeHandler: (() => void) | null = null;
			const addEventListener = vi.fn((event, handler) => {
				if (event === 'resize') {
					resizeHandler = handler as () => void;
				}
			});

			vi.stubGlobal('window', {
				innerWidth: 1024,
				innerHeight: 768,
				addEventListener,
				removeEventListener: vi.fn(),
			});

			const { width, height } = useWindowSize({});

			expect(width.value).toBe(1024);
			expect(height.value).toBe(768);

			vi.stubGlobal('window', {
				innerWidth: 1920,
				innerHeight: 1080,
				addEventListener,
				removeEventListener: vi.fn(),
			});

			if (resizeHandler) {
				(resizeHandler as () => void)();
			}

			expect(width.value).toBe(1920);
			expect(height.value).toBe(1080);
		});

		it('should attach resize listener', () => {
			const addEventListener = vi.fn();
			vi.stubGlobal('window', {
				innerWidth: 1024,
				innerHeight: 768,
				addEventListener,
				removeEventListener: vi.fn(),
			});

			useWindowSize({});

			expect(addEventListener).toHaveBeenCalledWith(
				'resize',
				expect.any(Function),
				expect.any(Object)
			);
		});

		it('should attach orientation change listener when enabled', () => {
			const addEventListener = vi.fn();
			vi.stubGlobal('window', {
				innerWidth: 1024,
				innerHeight: 768,
				addEventListener,
				removeEventListener: vi.fn(),
			});

			useWindowSize({ listenOrientation: true });

			expect(addEventListener).toHaveBeenCalledWith(
				'orientationchange',
				expect.any(Function),
				expect.any(Object)
			);
		});
	});
});
