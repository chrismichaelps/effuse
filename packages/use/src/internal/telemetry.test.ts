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
	setGlobalTracing,
	clearGlobalTracing,
	createTracingService,
} from '@effuse/core';
import { isUseHookEnabled, type UseHooksCategory } from './telemetry.js';

describe('internal/telemetry', () => {
	beforeEach(() => {
		clearGlobalTracing();
	});

	afterEach(() => {
		clearGlobalTracing();
	});

	describe('default configuration (no global tracing)', () => {
		it('should return false if no global tracing is set', () => {
			expect(isUseHookEnabled('useWindowSize')).toBe(false);
		});
	});

	describe('global tracing enabled', () => {
		beforeEach(() => {
			const tracing = createTracingService({
				enabled: true,
				categories: {
					hooks: true,
				},
			});
			setGlobalTracing(tracing);
		});

		it('should have all hooks enabled by default when hooks category is enabled', () => {
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

		it('should disable specific hook if configured in useHooks', () => {
			const tracing = createTracingService({
				enabled: true,
				categories: {
					hooks: true,
					useHooks: {
						useWindowSize: false,
					},
				},
			});
			setGlobalTracing(tracing);

			expect(isUseHookEnabled('useWindowSize')).toBe(false);
			expect(isUseHookEnabled('useLocalStorage')).toBe(true);
		});

		it('should return false if hooks category is disabled', () => {
			const tracing = createTracingService({
				enabled: true,
				categories: {
					hooks: false,
				},
			});
			setGlobalTracing(tracing);

			expect(isUseHookEnabled('useWindowSize')).toBe(false);
		});
	});

	describe('isUseHookEnabled', () => {
		it('should return boolean for valid category', () => {
			const tracing = createTracingService({
				enabled: true,
				categories: {
					hooks: true,
				},
			});
			setGlobalTracing(tracing);
			expect(typeof isUseHookEnabled('useWindowSize')).toBe('boolean');
		});
	});
});
