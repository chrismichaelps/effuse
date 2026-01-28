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

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
	configureUseHooksTracing,
	isUseHookEnabled,
	resetUseHooksTracing,
	type UseHooksCategory,
} from './telemetry.js';

describe('internal/telemetry', () => {
	afterEach(() => {
		resetUseHooksTracing();
	});

	describe('default configuration', () => {
		it('should have all hooks enabled by default', () => {
			const categories: UseHooksCategory[] = [
				'useWindowSize',
				'useLocalStorage',
				'useEventListener',
				'useMediaQuery',
				'useOnline',
				'useInterval',
				'useDebounce',
			];

			categories.forEach((category) => {
				expect(isUseHookEnabled(category)).toBe(true);
			});
		});
	});

	describe('configureUseHooksTracing', () => {
		it('should disable specific hook tracing', () => {
			configureUseHooksTracing({ useWindowSize: false });

			expect(isUseHookEnabled('useWindowSize')).toBe(false);
			expect(isUseHookEnabled('useLocalStorage')).toBe(true);
		});

		it('should enable specific hook tracing', () => {
			configureUseHooksTracing({ useWindowSize: false });
			configureUseHooksTracing({ useWindowSize: true });

			expect(isUseHookEnabled('useWindowSize')).toBe(true);
		});

		it('should handle multiple configurations', () => {
			configureUseHooksTracing({
				useWindowSize: false,
				useLocalStorage: false,
				useOnline: false,
			});

			expect(isUseHookEnabled('useWindowSize')).toBe(false);
			expect(isUseHookEnabled('useLocalStorage')).toBe(false);
			expect(isUseHookEnabled('useOnline')).toBe(false);
			expect(isUseHookEnabled('useMediaQuery')).toBe(true);
		});
	});

	describe('resetUseHooksTracing', () => {
		it('should reset all hooks to enabled', () => {
			configureUseHooksTracing({
				useWindowSize: false,
				useLocalStorage: false,
				useEventListener: false,
				useMediaQuery: false,
				useOnline: false,
				useInterval: false,
				useDebounce: false,
			});

			resetUseHooksTracing();

			expect(isUseHookEnabled('useWindowSize')).toBe(true);
			expect(isUseHookEnabled('useLocalStorage')).toBe(true);
			expect(isUseHookEnabled('useEventListener')).toBe(true);
			expect(isUseHookEnabled('useMediaQuery')).toBe(true);
			expect(isUseHookEnabled('useOnline')).toBe(true);
			expect(isUseHookEnabled('useInterval')).toBe(true);
			expect(isUseHookEnabled('useDebounce')).toBe(true);
		});
	});

	describe('isUseHookEnabled', () => {
		it('should return boolean for valid category', () => {
			expect(typeof isUseHookEnabled('useWindowSize')).toBe('boolean');
		});

		it('should correctly reflect configuration changes', () => {
			expect(isUseHookEnabled('useDebounce')).toBe(true);

			configureUseHooksTracing({ useDebounce: false });
			expect(isUseHookEnabled('useDebounce')).toBe(false);

			configureUseHooksTracing({ useDebounce: true });
			expect(isUseHookEnabled('useDebounce')).toBe(true);
		});
	});
});
