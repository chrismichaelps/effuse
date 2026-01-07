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

export {
	createI18n,
	getI18n,
	t,
	setLocale,
	getLocale,
	useTranslation,
	resetI18n,
} from './i18n.js';

export type {
	I18n,
	I18nOptions,
	Translations,
	TranslationParams,
	TranslationLoader,
	UseTranslationReturn,
	PluralRules,
	TypedI18n,
	TypedI18nOptions,
	TypedUseTranslationReturn,
	FlattenKeys,
	InferParams,
	ExtractVariables,
} from './types/index.js';

export { defineTranslations } from './types/index.js';

export {
	MissingTranslationError,
	LocaleLoadError,
	InvalidLocaleError,
	I18nNotInitializedError,
	type I18nError,
} from './errors/index.js';

export {
	DEFAULT_LOCALE,
	DEFAULT_FALLBACK_LOCALE,
	LOCALE_STORAGE_KEY,
	getI18nConfig,
	resetI18nConfigCache,
	type I18nConfigValues,
} from './config/index.js';

export {
	translate,
	interpolate,
	getNestedValue,
	hasTranslationKey,
	getPluralSuffix,
	mergeTranslations,
	flattenTranslations,
} from './core/index.js';
