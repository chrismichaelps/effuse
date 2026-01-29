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
import { createMediaQuery, getInitialMatch } from './utils.js';

describe('useMediaQuery/utils', () => {
	afterEach(() => {
		vi.unstubAllGlobals();
	});

	describe('createMediaQuery', () => {
		it('should return Some with MediaQueryList when matchMedia is available', () => {
			const mockMql = { matches: true, addEventListener: vi.fn() };
			vi.stubGlobal('window', {
				matchMedia: vi.fn(() => mockMql),
			});

			const result = createMediaQuery('(min-width: 768px)');

			expect(Option.isSome(result)).toBe(true);
		});

		it('should return None when window is undefined', () => {
			vi.stubGlobal('window', undefined);

			const result = createMediaQuery('(min-width: 768px)');

			expect(Option.isNone(result)).toBe(true);
		});

		it('should return None when matchMedia is not a function', () => {
			vi.stubGlobal('window', {
				matchMedia: 'not a function',
			});

			const result = createMediaQuery('(min-width: 768px)');

			expect(Option.isNone(result)).toBe(true);
		});

		it('should return None when matchMedia throws', () => {
			vi.stubGlobal('window', {
				matchMedia: vi.fn(() => {
					throw new Error('Invalid query');
				}),
			});

			const result = createMediaQuery('invalid query !@#');

			expect(Option.isNone(result)).toBe(true);
		});
	});

	describe('getInitialMatch', () => {
		it('should return true when media query matches', () => {
			const mockMql = { matches: true } as MediaQueryList;

			expect(getInitialMatch(mockMql)).toBe(true);
		});

		it('should return false when media query does not match', () => {
			const mockMql = { matches: false } as MediaQueryList;

			expect(getInitialMatch(mockMql)).toBe(false);
		});
	});
});
