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
import { useLocalStorage } from './index.js';

describe('useLocalStorage', () => {
	let mockStorage: Record<string, string> = {};
	const mockGetItem = vi.fn((key: string) => mockStorage[key] ?? null);
	const mockSetItem = vi.fn((key: string, value: string) => {
		mockStorage[key] = value;
	});
	const mockRemoveItem = vi.fn((key: string) => {
		delete mockStorage[key];
	});

	beforeEach(() => {
		mockStorage = {};
		mockGetItem.mockClear();
		mockSetItem.mockClear();
		mockRemoveItem.mockClear();

		vi.stubGlobal('document', {});
		vi.stubGlobal('localStorage', {
			getItem: mockGetItem,
			setItem: mockSetItem,
			removeItem: mockRemoveItem,
			clear: vi.fn(),
			length: 0,
			key: vi.fn(),
		});

		vi.stubGlobal('window', {
			addEventListener: vi.fn(),
			removeEventListener: vi.fn(),
		});
	});

	afterEach(() => {
		vi.unstubAllGlobals();
		vi.restoreAllMocks();
	});

	describe('initialization', () => {
		it('should return default value when key does not exist', () => {
			const { value } = useLocalStorage({
				key: 'test-key',
				defaultValue: 'default',
			});

			expect(value.value).toBe('default');
		});

		it('should return stored value when key exists', () => {
			mockStorage['existing-key'] = JSON.stringify('stored-value');

			const { value } = useLocalStorage({
				key: 'existing-key',
				defaultValue: 'default',
			});

			expect(value.value).toBe('stored-value');
		});

		it('should handle complex objects', () => {
			const defaultObj = { name: 'test', count: 0 };

			const { value } = useLocalStorage({
				key: 'object-key',
				defaultValue: defaultObj,
			});

			expect(value.value).toEqual(defaultObj);
		});
	});

	describe('return type', () => {
		it('should return value signal', () => {
			const result = useLocalStorage({
				key: 'test',
				defaultValue: 'value',
			});

			expect(result).toHaveProperty('value');
			expect(result.value).toHaveProperty('value');
		});

		it('should return remove function', () => {
			const { remove } = useLocalStorage({
				key: 'test',
				defaultValue: 'value',
			});

			expect(typeof remove).toBe('function');
		});

		it('should return isAvailable', () => {
			const { isAvailable } = useLocalStorage({
				key: 'test',
				defaultValue: 'value',
			});

			expect(typeof isAvailable).toBe('boolean');
		});

		it('should return error property', () => {
			const result = useLocalStorage({
				key: 'test',
				defaultValue: 'value',
			});

			expect(result).toHaveProperty('error');
		});
	});

	describe('remove', () => {
		it('should remove value and reset to default', () => {
			mockStorage['remove-key'] = JSON.stringify('stored');

			const { value, remove } = useLocalStorage({
				key: 'remove-key',
				defaultValue: 'default',
			});

			expect(value.value).toBe('stored');

			remove();

			expect(value.value).toBe('default');
			expect(mockRemoveItem).toHaveBeenCalledWith('remove-key');
		});
	});

	describe('SSR behavior', () => {
		it('should handle undefined localStorage (SSR)', () => {
			vi.stubGlobal('localStorage', undefined);
			vi.stubGlobal('window', undefined);

			const { value, isAvailable } = useLocalStorage({
				key: 'ssr-key',
				defaultValue: 'ssr-default',
			});

			expect(value.value).toBe('ssr-default');
			expect(isAvailable).toBe(false);
		});
	});

	describe('edge cases', () => {
		it('should handle null values', () => {
			const { value } = useLocalStorage({
				key: 'null-key',
				defaultValue: null,
			});

			expect(value.value).toBe(null);
		});

		it('should handle invalid JSON in storage and return fallback', () => {
			mockStorage['invalid-json'] = 'not valid json {';

			const { value } = useLocalStorage({
				key: 'invalid-json',
				defaultValue: 'fallback',
			});

			expect(value.value).toBe('fallback');
		});

		it('should handle empty string values', () => {
			mockStorage['empty-string'] = JSON.stringify('');

			const { value } = useLocalStorage({
				key: 'empty-string',
				defaultValue: 'default',
			});

			expect(value.value).toBe('');
		});

		it('should handle arrays', () => {
			const defaultArray = [1, 2, 3];

			const { value } = useLocalStorage({
				key: 'array-key',
				defaultValue: defaultArray,
			});

			expect(value.value).toEqual(defaultArray);
		});

		it('should handle boolean values', () => {
			mockStorage['bool-key'] = JSON.stringify(true);

			const { value } = useLocalStorage({
				key: 'bool-key',
				defaultValue: false,
			});

			expect(value.value).toBe(true);
		});

		it('should handle number values', () => {
			mockStorage['num-key'] = JSON.stringify(42);

			const { value } = useLocalStorage({
				key: 'num-key',
				defaultValue: 0,
			});

			expect(value.value).toBe(42);
		});
	});
});
