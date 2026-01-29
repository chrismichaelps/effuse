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
import { signal } from '@effuse/core';
import { useThrottle } from './index.js';

describe('useThrottle', () => {
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
		it('should return initial value immediately', () => {
			const source = signal('initial');
			const { value } = useThrottle({ value: source });

			expect(value.value).toBe('initial');
		});

		it('should return isThrottled signal', () => {
			const source = signal('initial');
			const { isThrottled } = useThrottle({ value: source });

			expect(isThrottled.value).toBe(false);
		});

		it('should return all expected properties', () => {
			const source = signal('initial');
			const result = useThrottle({ value: source });

			expect(result).toHaveProperty('value');
			expect(result).toHaveProperty('isThrottled');
		});

		it('should accept interval parameter', () => {
			const source = signal('initial');
			const { value } = useThrottle({ value: source, interval: 500 });

			expect(value.value).toBe('initial');
		});

		it('should use default interval when not specified', () => {
			const source = signal('initial');
			const { value } = useThrottle({ value: source });

			expect(value.value).toBe('initial');
		});
	});

	describe('edge cases', () => {
		it('should handle zero interval', () => {
			const source = signal('initial');
			const { value } = useThrottle({ value: source, interval: 0 });

			expect(value.value).toBe('initial');
		});

		it('should handle very large interval', () => {
			const source = signal('initial');
			const { value } = useThrottle({ value: source, interval: 999999 });

			expect(value.value).toBe('initial');
		});

		it('should handle negative interval gracefully', () => {
			const source = signal('initial');
			const { value } = useThrottle({ value: source, interval: -100 });

			expect(value.value).toBe('initial');
		});

		it('should handle object values', () => {
			const obj = { foo: 'bar' };
			const source = signal(obj);
			const { value } = useThrottle({ value: source });

			expect(value.value).toBe(obj);
		});

		it('should handle array values', () => {
			const arr = [1, 2, 3];
			const source = signal(arr);
			const { value } = useThrottle({ value: source });

			expect(value.value).toBe(arr);
		});
	});

	describe('throttle behavior with leading edge', () => {
		it('should update immediately on first change', () => {
			const source = signal('initial');
			const { value, isThrottled } = useThrottle({
				value: source,
				interval: 100,
			});

			source.value = 'updated';

			expect(value.value).toBe('updated');
			expect(isThrottled.value).toBe(true);
		});

		it('should ignore changes during cooldown', () => {
			const source = signal('initial');
			const { value } = useThrottle({ value: source, interval: 100 });

			source.value = 'first';
			expect(value.value).toBe('first');

			source.value = 'second';
			expect(value.value).toBe('first');

			source.value = 'third';
			expect(value.value).toBe('first');
		});

		it('should allow updates after cooldown expires', () => {
			const source = signal('initial');
			const { value, isThrottled } = useThrottle({
				value: source,
				interval: 100,
			});

			source.value = 'first';
			expect(value.value).toBe('first');

			vi.advanceTimersByTime(100);

			expect(isThrottled.value).toBe(false);
		});
	});

	describe('trailing edge behavior', () => {
		it('should apply trailing value after cooldown', () => {
			const source = signal('initial');
			const { value } = useThrottle({
				value: source,
				interval: 100,
				trailing: true,
			});

			source.value = 'first';
			expect(value.value).toBe('first');

			source.value = 'trailing';
			expect(value.value).toBe('first');

			vi.advanceTimersByTime(100);

			expect(value.value).toBe('trailing');
		});

		it('should use last trailing value when multiple changes during cooldown', () => {
			const source = signal('initial');
			const { value } = useThrottle({
				value: source,
				interval: 100,
				trailing: true,
			});

			source.value = 'first';
			source.value = 'second';
			source.value = 'third';

			expect(value.value).toBe('first');

			vi.advanceTimersByTime(100);

			expect(value.value).toBe('third');
		});
	});

	describe('leading false behavior', () => {
		it('should not update immediately when leading is false', () => {
			const source = signal('initial');
			const { value, isThrottled } = useThrottle({
				value: source,
				interval: 100,
				leading: false,
			});

			source.value = 'updated';

			expect(value.value).toBe('initial');
			expect(isThrottled.value).toBe(true);
		});

		it('should apply value after cooldown when leading is false', () => {
			const source = signal('initial');
			const { value } = useThrottle({
				value: source,
				interval: 100,
				leading: false,
				trailing: true,
			});

			source.value = 'updated';
			expect(value.value).toBe('initial');

			vi.advanceTimersByTime(100);

			expect(value.value).toBe('updated');
		});
	});
});
