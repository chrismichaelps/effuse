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

import type { Signal } from '@effuse/core';

type Prev = [never, 0, 1, 2, 3, 4];

export type FlattenKeys<T, Depth extends number = 4> = Depth extends 0
	? never
	: T extends string
		? never
		: T extends object
			? {
					[K in keyof T & string]: T[K] extends string
						? K
						: T[K] extends object
							? K | `${K}.${FlattenKeys<T[K], Prev[Depth]>}`
							: K;
				}[keyof T & string]
			: never;

export type GetNestedType<T, Path extends string> = Path extends keyof T
	? T[Path]
	: Path extends `${infer Key}.${infer Rest}`
		? Key extends keyof T
			? T[Key] extends object
				? GetNestedType<T[Key], Rest>
				: never
			: never
		: never;

export type ExtractVariables<T extends string> =
	T extends `${string}{{${infer Var}}}${infer Rest}`
		? Var | ExtractVariables<Rest>
		: never;

export type ParamsFor<T> = T extends string
	? ExtractVariables<T> extends never
		? TranslationParams | undefined
		: { [K in ExtractVariables<T>]: string | number } & { count?: number }
	: TranslationParams | undefined;

export type InferParams<TTranslations, TKey extends string> = ParamsFor<
	GetNestedType<TTranslations, TKey>
>;

export interface Translations {
	[key: string]: string | Translations;
}

export interface TranslationParams {
	count?: number;
	[key: string]: unknown;
}

export interface PluralRules {
	zero?: string;
	one?: string;
	two?: string;
	few?: string;
	many?: string;
	other: string;
}

export type TranslationLoader = (
	locale: string
) => Promise<Translations> | Translations;

export interface I18nOptions {
	defaultLocale?: string;
	fallbackLocale?: string;
	translations?: Record<string, Translations>;
	loader?: TranslationLoader;
	loadPath?: string | ((locale: string) => string);
	detectLocale?: boolean;
	persistLocale?: boolean;
	onMissingKey?: (key: string, locale: string) => string | undefined;
}

export interface TypedI18nOptions<TTranslations extends Translations> {
	defaultLocale?: string;
	fallbackLocale?: string;
	translations: Record<string, TTranslations>;
	loader?: TranslationLoader;
	loadPath?: string | ((locale: string) => string);
	detectLocale?: boolean;
	persistLocale?: boolean;
	onMissingKey?: (key: string, locale: string) => string | undefined;
}

export interface TypedI18n<TTranslations extends Translations> {
	t: <K extends FlattenKeys<TTranslations>>(
		key: K,
		params?: InferParams<TTranslations, K>
	) => string;
	setLocale: (locale: string) => Promise<void>;
	getLocale: () => string;
	locale: Signal<string>;
	hasKey: (key: FlattenKeys<TTranslations>) => boolean;
	getAvailableLocales: () => string[];
	addTranslations: (locale: string, translations: Translations) => void;
}

export interface I18n {
	t: (key: string, params?: TranslationParams) => string;
	setLocale: (locale: string) => Promise<void>;
	getLocale: () => string;
	locale: Signal<string>;
	hasKey: (key: string) => boolean;
	getAvailableLocales: () => string[];
	addTranslations: (locale: string, translations: Translations) => void;
}

export interface TypedUseTranslationReturn<TTranslations extends Translations> {
	t: <K extends FlattenKeys<TTranslations>>(
		key: K,
		params?: InferParams<TTranslations, K>
	) => string;
	locale: Signal<string>;
	setLocale: (locale: string) => Promise<void>;
	hasKey: (key: FlattenKeys<TTranslations>) => boolean;
}

export interface UseTranslationReturn {
	t: (key: string, params?: TranslationParams) => string;
	locale: Signal<string>;
	setLocale: (locale: string) => Promise<void>;
	hasKey: (key: string) => boolean;
}

export interface TranslationCacheEntry {
	translations: Translations;
	loadedAt: number;
}

export interface I18nState {
	currentLocale: string;
	fallbackLocale: string;
	translations: Map<string, Translations>;
	isLoading: boolean;
}

// Define translations with `as const` for type inference.
export function defineTranslations<const T extends Translations>(
	translations: T
): T {
	return translations;
}
