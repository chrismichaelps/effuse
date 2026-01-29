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

import { describe, it, expect, vi, afterEach } from 'vitest';
import { Option } from 'effect';
import {
	readStorage,
	writeStorage,
	removeStorage,
	isStorageAvailable,
} from './utils.js';

describe('useLocalStorage/utils', () => {
	afterEach(() => {
		vi.unstubAllGlobals();
	});

	describe('readStorage', () => {
		it('should return Some with value when key exists', () => {
			vi.stubGlobal('localStorage', {
				getItem: vi.fn(() => 'stored-value'),
			});

			const result = readStorage('test-key');

			expect(Option.isSome(result)).toBe(true);
			expect(Option.getOrElse(result, () => '')).toBe('stored-value');
		});

		it('should return None when key does not exist', () => {
			vi.stubGlobal('localStorage', {
				getItem: vi.fn(() => null),
			});

			const result = readStorage('missing-key');

			expect(Option.isNone(result)).toBe(true);
		});

		it('should return None when localStorage is undefined', () => {
			vi.stubGlobal('localStorage', undefined);

			const result = readStorage('any-key');

			expect(Option.isNone(result)).toBe(true);
		});

		it('should return None when getItem throws', () => {
			vi.stubGlobal('localStorage', {
				getItem: vi.fn(() => {
					throw new Error('Storage error');
				}),
			});

			const result = readStorage('error-key');

			expect(Option.isNone(result)).toBe(true);
		});
	});

	describe('writeStorage', () => {
		it('should return true when write succeeds', () => {
			vi.stubGlobal('localStorage', {
				setItem: vi.fn(),
			});

			const result = writeStorage('key', 'value');

			expect(result).toBe(true);
		});

		it('should return false when localStorage is undefined', () => {
			vi.stubGlobal('localStorage', undefined);

			const result = writeStorage('key', 'value');

			expect(result).toBe(false);
		});

		it('should return false when setItem throws (quota exceeded)', () => {
			vi.stubGlobal('localStorage', {
				setItem: vi.fn(() => {
					throw new Error('QuotaExceededError');
				}),
			});

			const result = writeStorage('key', 'value');

			expect(result).toBe(false);
		});
	});

	describe('removeStorage', () => {
		it('should return true when remove succeeds', () => {
			vi.stubGlobal('localStorage', {
				removeItem: vi.fn(),
			});

			const result = removeStorage('key');

			expect(result).toBe(true);
		});

		it('should return false when localStorage is undefined', () => {
			vi.stubGlobal('localStorage', undefined);

			const result = removeStorage('key');

			expect(result).toBe(false);
		});

		it('should return false when removeItem throws', () => {
			vi.stubGlobal('localStorage', {
				removeItem: vi.fn(() => {
					throw new Error('Storage error');
				}),
			});

			const result = removeStorage('key');

			expect(result).toBe(false);
		});
	});

	describe('isStorageAvailable', () => {
		it('should return true when storage is available', () => {
			vi.stubGlobal('localStorage', {
				setItem: vi.fn(),
				removeItem: vi.fn(),
			});

			const result = isStorageAvailable();

			expect(result).toBe(true);
		});

		it('should return false when localStorage is undefined', () => {
			vi.stubGlobal('localStorage', undefined);

			const result = isStorageAvailable();

			expect(result).toBe(false);
		});

		it('should return false when storage throws', () => {
			vi.stubGlobal('localStorage', {
				setItem: vi.fn(() => {
					throw new Error('SecurityError');
				}),
			});

			const result = isStorageAvailable();

			expect(result).toBe(false);
		});
	});
});
