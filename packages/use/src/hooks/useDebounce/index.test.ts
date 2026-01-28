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
import { useDebounce } from './index.js';

describe('useDebounce', () => {
	beforeEach(() => {
		vi.useFakeTimers();
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	describe('initialization', () => {
		it('should return initial value immediately', () => {
			const source = signal('initial');
			const { value } = useDebounce({ value: source, delay: 100 });

			expect(value.value).toBe('initial');
		});

		it('should return isPending signal', () => {
			const source = signal('initial');
			const { isPending } = useDebounce({ value: source, delay: 100 });

			expect(typeof isPending.value).toBe('boolean');
		});

		it('should return cancel function', () => {
			const source = signal('initial');
			const { cancel } = useDebounce({ value: source, delay: 100 });

			expect(typeof cancel).toBe('function');
		});

		it('should return flush function', () => {
			const source = signal('initial');
			const { flush } = useDebounce({ value: source, delay: 100 });

			expect(typeof flush).toBe('function');
		});
	});

	describe('return type', () => {
		it('should return all expected properties', () => {
			const source = signal('initial');
			const result = useDebounce({ value: source, delay: 100 });

			expect(result).toHaveProperty('value');
			expect(result).toHaveProperty('isPending');
			expect(result).toHaveProperty('cancel');
			expect(result).toHaveProperty('flush');
		});
	});

	describe('configuration', () => {
		it('should accept delay parameter', () => {
			const source = signal('initial');
			const { value } = useDebounce({ value: source, delay: 500 });

			expect(value.value).toBe('initial');
		});

		it('should use default delay when not specified', () => {
			const source = signal('initial');
			const { value } = useDebounce({ value: source });

			expect(value.value).toBe('initial');
		});
	});

	describe('control functions', () => {
		it('should allow calling cancel without error', () => {
			const source = signal('initial');
			const { cancel } = useDebounce({ value: source, delay: 100 });

			expect(() => cancel()).not.toThrow();
		});

		it('should allow calling flush without error', () => {
			const source = signal('initial');
			const { flush } = useDebounce({ value: source, delay: 100 });

			expect(() => flush()).not.toThrow();
		});

		it('should allow calling cancel multiple times', () => {
			const source = signal('initial');
			const { cancel } = useDebounce({ value: source, delay: 100 });

			expect(() => {
				cancel();
				cancel();
				cancel();
			}).not.toThrow();
		});
	});

	describe('edge cases', () => {
		it('should handle zero delay', () => {
			const source = signal('initial');
			const { value } = useDebounce({ value: source, delay: 0 });

			expect(value.value).toBe('initial');
		});

		it('should handle very large delay', () => {
			const source = signal('initial');
			const { value } = useDebounce({ value: source, delay: 1000000 });

			expect(value.value).toBe('initial');
		});

		it('should handle negative delay gracefully', () => {
			const source = signal('initial');

			expect(() => useDebounce({ value: source, delay: -100 })).not.toThrow();
		});

		it('should handle object values', () => {
			const source = signal({ key: 'value' });
			const { value } = useDebounce({ value: source, delay: 100 });

			expect(value.value).toEqual({ key: 'value' });
		});

		it('should handle array values', () => {
			const source = signal([1, 2, 3]);
			const { value } = useDebounce({ value: source, delay: 100 });

			expect(value.value).toEqual([1, 2, 3]);
		});
	});
});
