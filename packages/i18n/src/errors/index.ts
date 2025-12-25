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

export class MissingTranslationError extends Error {
	readonly _tag = 'MissingTranslationError';
	readonly key: string;
	readonly locale: string;

	constructor(key: string, locale: string) {
		super(`Missing translation for key "${key}" in locale "${locale}"`);
		this.name = 'MissingTranslationError';
		this.key = key;
		this.locale = locale;
	}
}

export class LocaleLoadError extends Error {
	readonly _tag = 'LocaleLoadError';
	readonly locale: string;
	readonly cause?: unknown;

	constructor(locale: string, cause?: unknown) {
		const message = cause instanceof Error ? cause.message : String(cause);
		super(`Failed to load translations for locale "${locale}": ${message}`);
		this.name = 'LocaleLoadError';
		this.locale = locale;
		this.cause = cause;
	}
}

export class InvalidLocaleError extends Error {
	readonly _tag = 'InvalidLocaleError';
	readonly locale: string;

	constructor(locale: string) {
		super(`Invalid locale format: "${locale}"`);
		this.name = 'InvalidLocaleError';
		this.locale = locale;
	}
}

export class I18nNotInitializedError extends Error {
	readonly _tag = 'I18nNotInitializedError';

	constructor() {
		super(
			'I18n has not been initialized. Call createI18n() before using translations.'
		);
		this.name = 'I18nNotInitializedError';
	}
}

export type I18nError =
	| MissingTranslationError
	| LocaleLoadError
	| InvalidLocaleError
	| I18nNotInitializedError;
