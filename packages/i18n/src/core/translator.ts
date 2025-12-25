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

import type { Translations, TranslationParams } from '../types/index.js';
import {
	INTERPOLATION_PATTERN,
	KEY_SEPARATOR,
	PLURAL_SUFFIXES,
} from '../config/constants.js';

// Retrieves a nested value from a translation object using a dot-notation key.
export const getNestedValue = (
	translations: Translations,
	key: string
): string | Translations | undefined => {
	const parts = key.split(KEY_SEPARATOR);
	let current: string | Translations | undefined = translations;

	for (const part of parts) {
		if (current === undefined || typeof current === 'string') {
			return undefined;
		}
		current = current[part];
	}

	return current;
};

// Checks if a translation key exists.
export const hasTranslationKey = (
	translations: Translations,
	key: string
): boolean => {
	const value = getNestedValue(translations, key);
	return value !== undefined;
};

// Determines the correct plural suffix for a count and locale.
export const getPluralSuffix = (count: number, locale: string): string => {
	try {
		const rules = new Intl.PluralRules(locale);
		const category = rules.select(count);

		switch (category) {
			case 'zero':
				return PLURAL_SUFFIXES.ZERO;
			case 'one':
				return PLURAL_SUFFIXES.ONE;
			case 'two':
				return PLURAL_SUFFIXES.TWO;
			case 'few':
				return PLURAL_SUFFIXES.FEW;
			case 'many':
				return PLURAL_SUFFIXES.MANY;
			default:
				return PLURAL_SUFFIXES.OTHER;
		}
	} catch {
		return count === 1 ? PLURAL_SUFFIXES.ONE : PLURAL_SUFFIXES.OTHER;
	}
};

// Replaces placeholders in a template string with values.
export const interpolate = (
	template: string,
	params: TranslationParams
): string => {
	return template.replace(INTERPOLATION_PATTERN, (_, key: string) => {
		const value = params[key];
		if (value === undefined || value === null) {
			return `{{${key}}}`;
		}
		if (
			typeof value === 'string' ||
			typeof value === 'number' ||
			typeof value === 'boolean'
		) {
			return String(value);
		}
		return `{{${key}}}`;
	});
};

// The core translation function handles lookup, fallback, pluralization, and interpolation.
export const translate = (
	translations: Translations | undefined,
	fallbackTranslations: Translations | undefined,
	key: string,
	params: TranslationParams | undefined,
	locale: string
): string => {
	let lookupKey = key;
	if (params?.count !== undefined) {
		const pluralSuffix = getPluralSuffix(params.count, locale);
		const pluralKey = `${key}${pluralSuffix}`;

		if (
			(translations && hasTranslationKey(translations, pluralKey)) ||
			(fallbackTranslations &&
				hasTranslationKey(fallbackTranslations, pluralKey))
		) {
			lookupKey = pluralKey;
		}
	}

	let value: string | Translations | undefined;
	if (translations) {
		value = getNestedValue(translations, lookupKey);
	}

	if (value === undefined && fallbackTranslations) {
		value = getNestedValue(fallbackTranslations, lookupKey);
	}

	if (value === undefined || typeof value !== 'string') {
		return key;
	}

	if (params && Object.keys(params).length > 0) {
		return interpolate(value, params);
	}

	return value;
};

// Deeply merges two translation objects.
export const mergeTranslations = (
	target: Translations,
	source: Translations
): Translations => {
	const result: Translations = { ...target };

	for (const key of Object.keys(source)) {
		const sourceValue = source[key];
		const targetValue = result[key];

		if (sourceValue === undefined) {
			continue;
		}

		if (typeof sourceValue === 'object' && typeof targetValue === 'object') {
			result[key] = mergeTranslations(targetValue, sourceValue);
		} else {
			result[key] = sourceValue;
		}
	}

	return result;
};

// Flattens a nested translation object into a single-level object with dot-notation keys.
export const flattenTranslations = (
	translations: Translations,
	prefix = ''
): Record<string, string> => {
	const result: Record<string, string> = {};

	for (const key of Object.keys(translations)) {
		const value = translations[key];
		const fullKey = prefix ? `${prefix}${KEY_SEPARATOR}${key}` : key;

		if (typeof value === 'string') {
			result[fullKey] = value;
		} else if (typeof value === 'object') {
			Object.assign(result, flattenTranslations(value, fullKey));
		}
	}

	return result;
};
