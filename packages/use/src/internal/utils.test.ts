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
import {
	isClient,
	isServer,
	noop,
	resolveValue,
	createDebounce,
	createThrottle,
	safeJsonParse,
	safeJsonStringify,
} from './utils.js';

describe('internal/utils', () => {
	describe('isClient', () => {
		afterEach(() => {
			vi.unstubAllGlobals();
		});

		it('should return true when window and document exist', () => {
			vi.stubGlobal('window', {});
			vi.stubGlobal('document', {});

			expect(isClient()).toBe(true);
		});

		it('should return false when window is undefined', () => {
			vi.stubGlobal('window', undefined);
			vi.stubGlobal('document', {});

			expect(isClient()).toBe(false);
		});

		it('should return false when document is undefined', () => {
			vi.stubGlobal('window', {});
			vi.stubGlobal('document', undefined);

			expect(isClient()).toBe(false);
		});

		it('should return false in SSR environment', () => {
			vi.stubGlobal('window', undefined);
			vi.stubGlobal('document', undefined);

			expect(isClient()).toBe(false);
		});
	});

	describe('isServer', () => {
		afterEach(() => {
			vi.unstubAllGlobals();
		});

		it('should return opposite of isClient', () => {
			vi.stubGlobal('window', {});
			vi.stubGlobal('document', {});

			expect(isServer()).toBe(!isClient());
		});

		it('should return true in SSR environment', () => {
			vi.stubGlobal('window', undefined);
			vi.stubGlobal('document', undefined);

			expect(isServer()).toBe(true);
		});
	});

	describe('noop', () => {
		it('should be a function', () => {
			expect(typeof noop).toBe('function');
		});

		it('should return undefined', () => {
			expect(noop()).toBeUndefined();
		});

		it('should not throw when called', () => {
			expect(() => noop()).not.toThrow();
		});
	});

	describe('resolveValue', () => {
		it('should return primitive value directly', () => {
			expect(resolveValue('hello')).toBe('hello');
			expect(resolveValue(42)).toBe(42);
			expect(resolveValue(true)).toBe(true);
			expect(resolveValue(null)).toBe(null);
		});

		it('should call function and return result', () => {
			const getter = () => 'computed';
			expect(resolveValue(getter)).toBe('computed');
		});

		it('should handle function returning object', () => {
			const getter = () => ({ key: 'value' });
			expect(resolveValue(getter)).toEqual({ key: 'value' });
		});

		it('should handle function returning undefined', () => {
			const getter = () => undefined;
			expect(resolveValue(getter)).toBeUndefined();
		});
	});

	describe('safeJsonParse', () => {
		it('should parse valid JSON string', () => {
			expect(safeJsonParse('{"key":"value"}', {})).toEqual({ key: 'value' });
		});

		it('should parse JSON array', () => {
			expect(safeJsonParse('[1,2,3]', [])).toEqual([1, 2, 3]);
		});

		it('should parse JSON number', () => {
			expect(safeJsonParse('42', 0)).toBe(42);
		});

		it('should parse JSON boolean', () => {
			expect(safeJsonParse('true', false)).toBe(true);
		});

		it('should parse JSON null', () => {
			expect(safeJsonParse('null', 'fallback')).toBe(null);
		});

		it('should return fallback for invalid JSON', () => {
			expect(safeJsonParse('not valid json', 'fallback')).toBe('fallback');
		});

		it('should return fallback for empty string', () => {
			expect(safeJsonParse('', 'fallback')).toBe('fallback');
		});

		it('should return fallback for malformed JSON', () => {
			expect(safeJsonParse('{"key":}', { default: true })).toEqual({
				default: true,
			});
		});
	});

	describe('safeJsonStringify', () => {
		it('should stringify object', () => {
			expect(safeJsonStringify({ key: 'value' })).toBe('{"key":"value"}');
		});

		it('should stringify array', () => {
			expect(safeJsonStringify([1, 2, 3])).toBe('[1,2,3]');
		});

		it('should stringify number', () => {
			expect(safeJsonStringify(42)).toBe('42');
		});

		it('should stringify boolean', () => {
			expect(safeJsonStringify(true)).toBe('true');
		});

		it('should stringify null', () => {
			expect(safeJsonStringify(null)).toBe('null');
		});

		it('should stringify string', () => {
			expect(safeJsonStringify('hello')).toBe('"hello"');
		});

		it('should return null for circular references', () => {
			const circular: Record<string, unknown> = {};
			circular.self = circular;
			expect(safeJsonStringify(circular)).toBe(null);
		});

		it('should return null for BigInt', () => {
			expect(safeJsonStringify(BigInt(123))).toBe(null);
		});
	});

	describe('createDebounce', () => {
		beforeEach(() => {
			vi.useFakeTimers();
		});

		afterEach(() => {
			vi.useRealTimers();
		});

		it('should return call and cancel functions', () => {
			const fn = vi.fn();
			const debounced = createDebounce(fn, 100);

			expect(typeof debounced.call).toBe('function');
			expect(typeof debounced.cancel).toBe('function');
		});

		it('should debounce function calls', () => {
			const fn = vi.fn();
			const debounced = createDebounce(fn, 100);

			debounced.call();
			debounced.call();
			debounced.call();

			expect(fn).not.toHaveBeenCalled();

			vi.advanceTimersByTime(100);

			expect(fn).toHaveBeenCalledTimes(1);
		});

		it('should cancel pending calls', () => {
			const fn = vi.fn();
			const debounced = createDebounce(fn, 100);

			debounced.call();
			debounced.cancel();

			vi.advanceTimersByTime(100);

			expect(fn).not.toHaveBeenCalled();
		});

		it('should pass arguments to debounced function', () => {
			const fn = vi.fn();
			const debounced = createDebounce(fn, 100);

			debounced.call('arg1', 'arg2');

			vi.advanceTimersByTime(100);

			expect(fn).toHaveBeenCalledWith('arg1', 'arg2');
		});
	});

	describe('createThrottle', () => {
		beforeEach(() => {
			vi.useFakeTimers();
		});

		afterEach(() => {
			vi.useRealTimers();
		});

		it('should return call and cancel functions', () => {
			const fn = vi.fn();
			const throttled = createThrottle(fn, 100);

			expect(typeof throttled.call).toBe('function');
			expect(typeof throttled.cancel).toBe('function');
		});

		it('should call immediately on first call', () => {
			const fn = vi.fn();
			const throttled = createThrottle(fn, 100);

			throttled.call();

			expect(fn).toHaveBeenCalledTimes(1);
		});

		it('should throttle subsequent calls', () => {
			const fn = vi.fn();
			const throttled = createThrottle(fn, 100);

			throttled.call();
			throttled.call();
			throttled.call();

			expect(fn).toHaveBeenCalledTimes(1);

			vi.advanceTimersByTime(100);

			expect(fn).toHaveBeenCalledTimes(2);
		});

		it('should cancel pending throttled calls', () => {
			const fn = vi.fn();
			const throttled = createThrottle(fn, 100);

			throttled.call();
			throttled.call();
			throttled.cancel();

			vi.advanceTimersByTime(100);

			expect(fn).toHaveBeenCalledTimes(1);
		});
	});
});
