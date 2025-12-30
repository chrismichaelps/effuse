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

import { Effect, Schedule, Duration } from 'effect';
import type { Translations, TranslationLoader } from '../types/index.js';
import { LocaleLoadError } from '../errors/index.js';
import { MAX_LOAD_RETRIES, RETRY_DELAY_MS } from '../config/constants.js';

export const loadFromPath = (
	path: string,
	locale: string
): Effect.Effect<Translations, LocaleLoadError> =>
	Effect.gen(function* () {
		const response = yield* Effect.tryPromise({
			try: () => fetch(path),
			catch: (error) => new LocaleLoadError({ locale, cause: error }),
		});

		if (!response.ok) {
			return yield* Effect.fail(
				new LocaleLoadError({
					locale,
					cause: `HTTP ${String(response.status)}: ${response.statusText}`,
				})
			);
		}

		const data = yield* Effect.tryPromise({
			try: () => response.json() as Promise<Translations>,
			catch: (error) => new LocaleLoadError({ locale, cause: error }),
		});

		return data;
	});

export const loadFromPathWithRetry = (
	path: string,
	locale: string
): Effect.Effect<Translations, LocaleLoadError> =>
	loadFromPath(path, locale).pipe(
		Effect.retry(
			Schedule.exponential(Duration.millis(RETRY_DELAY_MS)).pipe(
				Schedule.compose(Schedule.recurs(MAX_LOAD_RETRIES - 1))
			)
		)
	);

export const loadFromLoader = (
	loader: TranslationLoader,
	locale: string
): Effect.Effect<Translations, LocaleLoadError> =>
	Effect.gen(function* () {
		const result = yield* Effect.tryPromise({
			try: async () => {
				const translations = loader(locale);
				return translations instanceof Promise
					? await translations
					: translations;
			},
			catch: (error) => new LocaleLoadError({ locale, cause: error }),
		});

		return result;
	});

export const loadFromObject = (
	translations: Translations
): Effect.Effect<Translations> => Effect.succeed(translations);

export const resolveLoadPath = (
	pattern: string | ((locale: string) => string),
	locale: string
): string => {
	if (typeof pattern === 'function') {
		return pattern(locale);
	}
	return pattern.replace(/\{\{locale\}\}/g, locale);
};

export const loadTranslationsSync = (
	translations: Record<string, Translations>,
	locale: string
): Translations | undefined => {
	return translations[locale];
};

export const runLoader = (
	effect: Effect.Effect<Translations, LocaleLoadError>
): Promise<Translations | undefined> =>
	Effect.runPromise(
		effect.pipe(
			Effect.catchAll(() =>
				Effect.succeed(undefined as Translations | undefined)
			)
		)
	);
