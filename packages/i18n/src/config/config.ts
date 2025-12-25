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

import { Config, Effect } from 'effect';
import { DEFAULT_LOCALE, DEFAULT_FALLBACK_LOCALE } from './constants.js';

export interface I18nConfigValues {
	defaultLocale: string;
	fallbackLocale: string;
	detectLocale: boolean;
	persistLocale: boolean;
}

export const I18nConfig = Config.all({
	defaultLocale: Config.string('EFFUSE_I18N_LOCALE').pipe(
		Config.withDefault(DEFAULT_LOCALE)
	),
	fallbackLocale: Config.string('EFFUSE_I18N_FALLBACK').pipe(
		Config.withDefault(DEFAULT_FALLBACK_LOCALE)
	),
	detectLocale: Config.boolean('EFFUSE_I18N_DETECT').pipe(
		Config.withDefault(true)
	),
	persistLocale: Config.boolean('EFFUSE_I18N_PERSIST').pipe(
		Config.withDefault(true)
	),
});

let cachedConfig: I18nConfigValues | null = null;

export const getI18nConfig = (): I18nConfigValues => {
	if (cachedConfig) {
		return cachedConfig;
	}

	const result = Effect.runSync(Effect.either(I18nConfig));

	if (result._tag === 'Right') {
		cachedConfig = result.right;
	} else {
		cachedConfig = {
			defaultLocale: DEFAULT_LOCALE,
			fallbackLocale: DEFAULT_FALLBACK_LOCALE,
			detectLocale: true,
			persistLocale: true,
		};
	}

	return cachedConfig;
};

export const resetI18nConfigCache = (): void => {
	cachedConfig = null;
};
