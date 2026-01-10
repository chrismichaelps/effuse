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

import { Effect, Predicate } from 'effect';
import type { Signal } from '@effuse/core';
import type {
	I18n,
	I18nOptions,
	Translations,
	TranslationParams,
	UseTranslationReturn,
	TypedI18n,
	TypedUseTranslationReturn,
	TypedI18nOptions,
} from './types/index.js';
import { I18nService, makeI18nServiceLayer } from './services/index.js';
import {
	createLocaleSignal,
	createTranslationsVersion,
	bumpTranslationsVersion,
} from './reactivity/index.js';
import {
	translate,
	hasTranslationKey,
	mergeTranslations,
} from './core/index.js';
import { getI18nConfig } from './config/index.js';
import { I18nNotInitializedError } from './errors/index.js';
import {
	DEFAULT_LOCALE,
	DEFAULT_FALLBACK_LOCALE,
	LOCALE_STORAGE_KEY,
} from './config/constants.js';

let globalI18nInstance: I18nInstance | null = null;

class I18nInstance implements I18n {
	private readonly _locale: Signal<string>;
	private readonly _version: Signal<number>;
	private readonly _translations: Map<string, Translations>;
	private readonly _fallbackLocale: string;
	private readonly _options: I18nOptions | TypedI18nOptions<Translations>;

	constructor(options: I18nOptions | TypedI18nOptions<Translations>) {
		this._options = options;

		const envConfig = getI18nConfig();
		const defaultLocale = options.defaultLocale ?? DEFAULT_LOCALE;
		this._fallbackLocale = options.fallbackLocale ?? DEFAULT_FALLBACK_LOCALE;

		let initialLocale = defaultLocale;
		const detectEnabled = options.detectLocale ?? envConfig.detectLocale;
		if (detectEnabled && typeof navigator !== 'undefined') {
			const browserLocale = navigator.language.split('-')[0];
			if (
				Predicate.isNotNullable(browserLocale) &&
				Predicate.isNotNullable(options.translations) &&
				Predicate.isNotNullable(options.translations[browserLocale])
			) {
				initialLocale = browserLocale;
			}
		}

		const persistEnabled = options.persistLocale ?? envConfig.persistLocale;
		if (persistEnabled && typeof localStorage !== 'undefined') {
			const stored = localStorage.getItem(LOCALE_STORAGE_KEY);
			if (
				Predicate.isNotNullable(stored) &&
				Predicate.isNotNullable(options.translations) &&
				Predicate.isNotNullable(options.translations[stored])
			) {
				initialLocale = stored;
			}
		}

		this._locale = createLocaleSignal(initialLocale);
		this._version = createTranslationsVersion();

		this._translations = new Map<string, Translations>();
		if (options.translations) {
			for (const [locale, translations] of Object.entries(
				options.translations
			)) {
				this._translations.set(locale, translations);
			}
		}
	}

	get locale(): Signal<string> {
		return this._locale;
	}

	t = (key: string, params?: TranslationParams): string => {
		void this._version.value;

		const currentLocale = this._locale.value;
		const translations = this._translations.get(currentLocale);
		const fallbackTranslations = this._translations.get(this._fallbackLocale);

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
			if (this._options.onMissingKey) {
				const handled = this._options.onMissingKey(key, currentLocale);
				if (handled !== undefined) {
					return handled;
				}
			}
		}

		return result;
	};

	setLocale = async (locale: string): Promise<void> => {
		if (!this._translations.has(locale)) {
			await this._loadTranslationsForLocale(locale);
		}

		this._locale.value = locale;

		const persistEnabled =
			this._options.persistLocale ?? getI18nConfig().persistLocale;
		if (persistEnabled && typeof localStorage !== 'undefined') {
			localStorage.setItem(LOCALE_STORAGE_KEY, locale);
		}

		bumpTranslationsVersion(this._version);
	};

	getLocale = (): string => {
		return this._locale.value;
	};

	hasKey = (key: string): boolean => {
		const currentLocale = this._locale.value;
		const translations = this._translations.get(currentLocale);
		const fallbackTranslations = this._translations.get(this._fallbackLocale);

		return (
			hasTranslationKey(translations ?? {}, key) ||
			hasTranslationKey(fallbackTranslations ?? {}, key)
		);
	};

	getAvailableLocales = (): string[] => {
		return Array.from(this._translations.keys());
	};

	addTranslations = (locale: string, translations: Translations): void => {
		const existing = this._translations.get(locale);
		if (existing) {
			this._translations.set(locale, mergeTranslations(existing, translations));
		} else {
			this._translations.set(locale, translations);
		}
		bumpTranslationsVersion(this._version);
	};

	private async _loadTranslationsForLocale(locale: string): Promise<void> {
		const layer = makeI18nServiceLayer(this._options);

		const loadEffect = Effect.gen(function* () {
			const service = yield* I18nService;
			const loaded = yield* service.loadTranslations(locale);
			return loaded;
		});

		const program = Effect.provide(loadEffect, layer);

		try {
			const loaded = await Effect.runPromise(program);
			this._translations.set(locale, loaded);
		} catch {
			/* */
		}
	}
}

// Initializes the i18n instance.
export function createI18n<const T>(options: TypedI18nOptions<T>): TypedI18n<T>;
export function createI18n(options?: I18nOptions): I18n;
export function createI18n<const T>(
	options: I18nOptions | TypedI18nOptions<T> = {}
): I18n | TypedI18n<T> {
	const instance = new I18nInstance(options as I18nOptions);
	globalI18nInstance = instance;
	return instance as I18n | TypedI18n<T>;
}

// Retrieves the global i18n instance. Throws if not initialized.
export function getI18n(): I18n;
export function getI18n<T>(): TypedI18n<T>;
export function getI18n<T>(): I18n | TypedI18n<T> {
	if (!globalI18nInstance) {
		throw new I18nNotInitializedError({});
	}
	return globalI18nInstance as I18n | TypedI18n<T>;
}

// Translates a key with optional parameters.
export const t = (key: string, params?: TranslationParams): string => {
	return getI18n().t(key, params);
};

// Changes the current locale and loads translations if needed.
export const setLocale = async (locale: string): Promise<void> => {
	await getI18n().setLocale(locale);
};

// Returns the current active locale code.
export const getLocale = (): string => {
	return getI18n().getLocale();
};

// Hook for using translations in components.
export function useTranslation(): UseTranslationReturn;
export function useTranslation<T>(): TypedUseTranslationReturn<T>;
export function useTranslation<T>():
	| UseTranslationReturn
	| TypedUseTranslationReturn<T> {
	const i18n = getI18n();

	return {
		t: i18n.t,
		locale: i18n.locale,
		setLocale: i18n.setLocale,
		hasKey: i18n.hasKey,
	};
}

// Resets the global i18n instance (useful for testing).
export const resetI18n = (): void => {
	globalI18nInstance = null;
};
