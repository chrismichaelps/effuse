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

export const DEFAULT_LOCALE = 'en';

export const DEFAULT_FALLBACK_LOCALE = 'en';

export const LOCALE_STORAGE_KEY = 'effuse-i18n-locale';

export const INTERPOLATION_PATTERN = /\{\{(\w+)\}\}/g;

export const PLURAL_SUFFIXES = {
	ZERO: '_zero',
	ONE: '_one',
	TWO: '_two',
	FEW: '_few',
	MANY: '_many',
	OTHER: '_other',
} as const;

export const KEY_SEPARATOR = '.';

export const CACHE_TTL_MS = 5 * 60 * 1000;

export const MAX_LOAD_RETRIES = 3;

export const RETRY_DELAY_MS = 1000;
