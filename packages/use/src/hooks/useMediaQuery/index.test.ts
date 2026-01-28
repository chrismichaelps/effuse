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
import { useMediaQuery } from './index.js';

describe('useMediaQuery', () => {
	const createMockMatchMedia = (matchesQuery: boolean) =>
		vi.fn(() => ({
			matches: matchesQuery,
			media: '',
			addEventListener: vi.fn(),
			removeEventListener: vi.fn(),
			addListener: vi.fn(),
			removeListener: vi.fn(),
			onchange: null,
			dispatchEvent: vi.fn(),
		}));

	beforeEach(() => {
		vi.stubGlobal('document', {});
	});

	afterEach(() => {
		vi.unstubAllGlobals();
		vi.restoreAllMocks();
	});

	describe('initialization', () => {
		it('should return matches signal', () => {
			vi.stubGlobal('window', { matchMedia: createMockMatchMedia(true) });

			const { matches } = useMediaQuery({
				query: '(min-width: 768px)',
			});

			expect(typeof matches.value).toBe('boolean');
		});

		it('should return isSupported property', () => {
			vi.stubGlobal('window', { matchMedia: createMockMatchMedia(true) });

			const { isSupported } = useMediaQuery({
				query: '(min-width: 768px)',
			});

			expect(typeof isSupported).toBe('boolean');
		});
	});

	describe('SSR behavior', () => {
		it('should use initialValue when window is unavailable', () => {
			vi.stubGlobal('window', undefined);

			const { matches } = useMediaQuery({
				query: '(min-width: 768px)',
				initialValue: true,
			});

			expect(matches.value).toBe(true);
		});

		it('should default to false when window is unavailable', () => {
			vi.stubGlobal('window', undefined);

			const { matches } = useMediaQuery({
				query: '(min-width: 768px)',
			});

			expect(matches.value).toBe(false);
		});
	});

	describe('configuration', () => {
		it('should accept query parameter', () => {
			vi.stubGlobal('window', { matchMedia: createMockMatchMedia(false) });

			const { matches } = useMediaQuery({
				query: '(prefers-color-scheme: dark)',
			});

			expect(typeof matches.value).toBe('boolean');
		});
	});

	describe('edge cases', () => {
		it('should handle missing matchMedia', () => {
			vi.stubGlobal('window', {});

			const { matches, isSupported } = useMediaQuery({
				query: '(min-width: 768px)',
			});

			expect(matches.value).toBe(false);
			expect(isSupported).toBe(false);
		});
		it('should handle listener attachment', () => {
			const addListener = vi.fn();
			const mockMatchMedia = vi.fn(() => ({
				matches: false,
				media: '',
				addEventListener: addListener,
				removeEventListener: vi.fn(),
				addListener: addListener,
				removeListener: vi.fn(),
				onchange: null,
				dispatchEvent: vi.fn(),
			}));
			vi.stubGlobal('window', { matchMedia: mockMatchMedia });

			useMediaQuery({ query: '(min-width: 768px)' });

			expect(addListener).toHaveBeenCalled();
		});
	});
});
