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

import { Context, Effect, Layer } from 'effect';
import type {
	Translations,
	TranslationParams,
	I18nOptions,
} from '../types/index.js';
import {
	translate,
	hasTranslationKey,
	mergeTranslations,
} from '../core/translator.js';
import {
	loadFromPathWithRetry,
	loadFromLoader,
	resolveLoadPath,
} from '../core/loader.js';
import { LocaleLoadError, MissingTranslationError } from '../errors/index.js';
import {
	DEFAULT_LOCALE,
	DEFAULT_FALLBACK_LOCALE,
} from '../config/constants.js';

export interface I18nServiceApi {
	getLocale: () => Effect.Effect<string>;
	setLocale: (locale: string) => Effect.Effect<void, LocaleLoadError>;
	getFallbackLocale: () => Effect.Effect<string>;
	translate: (
		key: string,
		params?: TranslationParams
	) => Effect.Effect<string, MissingTranslationError>;
	hasKey: (key: string) => Effect.Effect<boolean>;
	getAvailableLocales: () => Effect.Effect<string[]>;
	addTranslations: (
		locale: string,
		translations: Translations
	) => Effect.Effect<void>;
	loadTranslations: (
		locale: string
	) => Effect.Effect<Translations, LocaleLoadError>;
	getTranslations: (locale: string) => Effect.Effect<Translations | undefined>;
}

export class I18nService extends Context.Tag('effuse/i18n/I18nService')<
	I18nService,
	I18nServiceApi
>() {}

export const makeI18nServiceLayer = (
	options: I18nOptions
): Layer.Layer<I18nService> => {
	let currentLocale = options.defaultLocale ?? DEFAULT_LOCALE;
	const fallbackLocale = options.fallbackLocale ?? DEFAULT_FALLBACK_LOCALE;
	const translationsMap = new Map<string, Translations>();

	if (options.translations) {
		for (const [locale, translations] of Object.entries(options.translations)) {
			translationsMap.set(locale, translations);
		}
	}

	const loadTranslationsForLocale = (
		locale: string
	): Effect.Effect<Translations, LocaleLoadError> =>
		Effect.gen(function* () {
			const existing = translationsMap.get(locale);
			if (existing) {
				return existing;
			}
			if (options.loader) {
				const loaded = yield* loadFromLoader(options.loader, locale);
				translationsMap.set(locale, loaded);
				return loaded;
			}

			if (options.loadPath) {
				const path = resolveLoadPath(options.loadPath, locale);
				const loaded = yield* loadFromPathWithRetry(path, locale);
				translationsMap.set(locale, loaded);
				return loaded;
			}

			return yield* Effect.fail(
				new LocaleLoadError({
					locale,
					cause: 'No loader or translations configured',
				})
			);
		});

	return Layer.succeed(I18nService, {
		getLocale: () => Effect.succeed(currentLocale),

		setLocale: (locale: string) =>
			Effect.gen(function* () {
				yield* loadTranslationsForLocale(locale);
				currentLocale = locale;
			}),

		getFallbackLocale: () => Effect.succeed(fallbackLocale),

		translate: (key: string, params?: TranslationParams) =>
			Effect.gen(function* () {
				const translations = translationsMap.get(currentLocale);
				const fallbackTranslations = translationsMap.get(fallbackLocale);

				const result = translate(
					translations,
					fallbackTranslations,
					key,
					params,
					currentLocale
				);

				if (
					result === key &&
					!hasTranslationKey(translations ?? {}, key) &&
					!hasTranslationKey(fallbackTranslations ?? {}, key)
				) {
					if (options.onMissingKey) {
						const handled = options.onMissingKey(key, currentLocale);
						if (handled !== undefined) {
							return handled;
						}
					}
					return yield* Effect.fail(
						new MissingTranslationError({ key, locale: currentLocale })
					);
				}

				return result;
			}),

		hasKey: (key: string) =>
			Effect.sync(() => {
				const translations = translationsMap.get(currentLocale);
				const fallbackTranslations = translationsMap.get(fallbackLocale);
				return (
					hasTranslationKey(translations ?? {}, key) ||
					hasTranslationKey(fallbackTranslations ?? {}, key)
				);
			}),

		getAvailableLocales: () =>
			Effect.sync(() => Array.from(translationsMap.keys())),

		addTranslations: (locale: string, translations: Translations) =>
			Effect.sync(() => {
				const existing = translationsMap.get(locale);
				if (existing) {
					translationsMap.set(
						locale,
						mergeTranslations(existing, translations)
					);
				} else {
					translationsMap.set(locale, translations);
				}
			}),

		loadTranslations: loadTranslationsForLocale,

		getTranslations: (locale: string) =>
			Effect.sync(() => translationsMap.get(locale)),
	});
};
