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
import { useOnline, type UseOnlineConfig } from './index.js';

describe('useOnline', () => {
	beforeEach(() => {
		vi.stubGlobal('window', {
			addEventListener: vi.fn(),
			removeEventListener: vi.fn(),
		});
		vi.stubGlobal('document', {});
	});

	afterEach(() => {
		vi.unstubAllGlobals();
		vi.restoreAllMocks();
	});

	describe('initialization', () => {
		it('should return isOnline and isOffline signals', () => {
			vi.stubGlobal('navigator', { onLine: true });

			const { isOnline, isOffline } = useOnline({});

			expect(typeof isOnline.value).toBe('boolean');
			expect(typeof isOffline.value).toBe('boolean');
		});

		it('should return consistent online/offline state', () => {
			vi.stubGlobal('navigator', { onLine: true });

			const { isOnline, isOffline } = useOnline({});

			expect(isOnline.value).not.toBe(isOffline.value);
		});
	});

	describe('SSR behavior', () => {
		it('should use initialValue when set to false', () => {
			vi.stubGlobal('window', undefined);
			vi.stubGlobal('document', undefined);
			vi.stubGlobal('navigator', undefined);

			const { isOnline } = useOnline({ initialValue: false });

			expect(isOnline.value).toBe(false);
		});

		it('should default to online during SSR', () => {
			vi.stubGlobal('window', undefined);
			vi.stubGlobal('document', undefined);
			vi.stubGlobal('navigator', undefined);

			const { isOnline } = useOnline({});

			expect(isOnline.value).toBe(true);
		});
	});

	describe('configuration', () => {
		it('should accept empty config', () => {
			vi.stubGlobal('navigator', { onLine: true });

			const { isOnline } = useOnline({});

			expect(typeof isOnline.value).toBe('boolean');
		});

		it('should accept undefined config', () => {
			vi.stubGlobal('navigator', { onLine: true });

			const { isOnline } = useOnline({} as UseOnlineConfig);

			expect(typeof isOnline.value).toBe('boolean');
		});
	});

	describe('return type', () => {
		it('should return ReadonlySignal types', () => {
			vi.stubGlobal('navigator', { onLine: true });

			const result = useOnline({});

			expect(result).toHaveProperty('isOnline');
			expect(result).toHaveProperty('isOffline');
			expect(result.isOnline).toHaveProperty('value');
			expect(result.isOffline).toHaveProperty('value');
		});
	});

	describe('event listeners', () => {
		it('should attach online/offline listeners', () => {
			vi.stubGlobal('navigator', { onLine: true });
			const addEventListener = vi.fn();
			vi.stubGlobal('window', {
				addEventListener,
				removeEventListener: vi.fn(),
			});

			useOnline({});

			expect(addEventListener).toHaveBeenCalledWith(
				'online',
				expect.any(Function)
			);
			expect(addEventListener).toHaveBeenCalledWith(
				'offline',
				expect.any(Function)
			);
		});
	});

	describe('online/offline transitions', () => {
		it('should update state when going offline', () => {
			vi.stubGlobal('navigator', { onLine: true });
			let offlineHandler: (() => void) | null = null;
			const addEventListener = vi.fn((event, handler) => {
				if (event === 'offline') {
					offlineHandler = handler as () => void;
				}
			});
			vi.stubGlobal('window', {
				addEventListener,
				removeEventListener: vi.fn(),
			});

			const { isOnline, isOffline } = useOnline({});

			expect(isOnline.value).toBe(true);
			expect(isOffline.value).toBe(false);

			if (offlineHandler) {
				(offlineHandler as () => void)();
			}

			expect(isOnline.value).toBe(false);
			expect(isOffline.value).toBe(true);
		});

		it('should update state when going online', () => {
			vi.stubGlobal('navigator', { onLine: false });
			let onlineHandler: (() => void) | null = null;
			const addEventListener = vi.fn((event, handler) => {
				if (event === 'online') {
					onlineHandler = handler as () => void;
				}
			});
			vi.stubGlobal('window', {
				addEventListener,
				removeEventListener: vi.fn(),
			});

			const { isOnline, isOffline } = useOnline({});

			expect(isOnline.value).toBe(false);
			expect(isOffline.value).toBe(true);

			if (onlineHandler) {
				(onlineHandler as () => void)();
			}

			expect(isOnline.value).toBe(true);
			expect(isOffline.value).toBe(false);
		});
	});
});
