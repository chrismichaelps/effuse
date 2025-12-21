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

import type { StyleOptions } from './types.js';

/** Default timeout in ms. */
const DEFAULT_TIMEOUT = 5000;

/** Default retry attempts. */
const DEFAULT_RETRIES = 2;

/** Retry base delay in ms. */
const RETRY_BASE_DELAY = 500;

/** Default style options. */
export const DEFAULT_STYLE_OPTIONS: Required<StyleOptions> = {
	lazy: false,
	timeout: DEFAULT_TIMEOUT,
	retries: DEFAULT_RETRIES,
};

/** Internal config values. */
export const STYLE_CONFIG = {
	TIMEOUT: DEFAULT_TIMEOUT,
	RETRIES: DEFAULT_RETRIES,
	RETRY_BASE_DELAY,
} as const;
