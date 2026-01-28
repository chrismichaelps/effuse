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
import { useEventListener } from './index.js';

describe('useEventListener', () => {
	const mockAddEventListener = vi.fn();
	const mockRemoveEventListener = vi.fn();

	beforeEach(() => {
		vi.stubGlobal('document', {});
		vi.stubGlobal('window', {
			addEventListener: mockAddEventListener,
			removeEventListener: mockRemoveEventListener,
		});
	});

	afterEach(() => {
		vi.unstubAllGlobals();
		vi.restoreAllMocks();
		mockAddEventListener.mockClear();
		mockRemoveEventListener.mockClear();
	});

	describe('initialization', () => {
		it('should return isActive and stop', () => {
			const { isActive, stop } = useEventListener({
				event: 'click',
				handler: vi.fn(),
			});

			expect(typeof isActive).toBe('boolean');
			expect(typeof stop).toBe('function');
		});

		it('should attach event listener to window by default', () => {
			useEventListener({
				event: 'click',
				handler: vi.fn(),
			});

			expect(mockAddEventListener).toHaveBeenCalledWith(
				'click',
				expect.any(Function),
				expect.any(Object)
			);
		});

		it('should return active state', () => {
			const { isActive } = useEventListener({
				event: 'click',
				handler: vi.fn(),
			});

			expect(isActive).toBe(true);
		});
	});

	describe('custom target', () => {
		it('should attach to custom element', () => {
			const element = {
				addEventListener: vi.fn(),
				removeEventListener: vi.fn(),
			};

			useEventListener({
				target: element as unknown as HTMLElement,
				event: 'click',
				handler: vi.fn(),
			});

			expect(element.addEventListener).toHaveBeenCalledWith(
				'click',
				expect.any(Function),
				expect.any(Object)
			);
		});

		it('should accept getter function for target', () => {
			const element = {
				addEventListener: vi.fn(),
				removeEventListener: vi.fn(),
			};

			useEventListener({
				target: () => element as unknown as HTMLElement,
				event: 'click',
				handler: vi.fn(),
			});

			expect(element.addEventListener).toHaveBeenCalled();
		});
	});

	describe('stop', () => {
		it('should provide stop function', () => {
			const { stop, isActive } = useEventListener({
				event: 'click',
				handler: vi.fn(),
			});

			expect(typeof stop).toBe('function');
			expect(isActive).toBe(true);
		});
	});

	describe('options', () => {
		it('should pass custom options to addEventListener', () => {
			useEventListener({
				event: 'click',
				handler: vi.fn(),
				options: { capture: true, passive: false },
			});

			expect(mockAddEventListener).toHaveBeenCalledWith(
				'click',
				expect.any(Function),
				{ capture: true, passive: false }
			);
		});
	});

	describe('edge cases', () => {
		it('should handle null target', () => {
			const { isActive } = useEventListener({
				target: () => null as unknown as HTMLElement,
				event: 'click',
				handler: vi.fn(),
			});

			expect(isActive).toBe(false);
		});

		it('should handle SSR (no window)', () => {
			vi.stubGlobal('window', undefined);
			vi.stubGlobal('document', undefined);

			const { isActive } = useEventListener({
				event: 'click',
				handler: vi.fn(),
			});

			expect(isActive).toBe(false);
		});
		it('should verify cleanup on unmount', () => {
			const { stop } = useEventListener({
				event: 'click',
				handler: vi.fn(),
			});

			stop();

			expect(mockRemoveEventListener).toHaveBeenCalledWith(
				'click',
				expect.any(Function),
				expect.any(Object)
			);
		});

		it('should handle multiple listeners on same target', () => {
			const handler1 = vi.fn();
			const handler2 = vi.fn();

			useEventListener({ event: 'click', handler: handler1 });
			useEventListener({ event: 'click', handler: handler2 });

			expect(mockAddEventListener).toHaveBeenCalledTimes(2);
		});
	});
});
