import { defineHook, signal, type Signal } from '@effuse/core';
import type { Translations } from '@effuse/i18n';

interface I18nProps {
	locale: Signal<string>;
	isLoading: Signal<boolean>;
	translations: Signal<Translations | null>;
}

interface TranslationReturn {
	t: (key: string, fallback?: string) => string;
	locale: Signal<string>;
	isLoading: Signal<boolean>;
}

const getNestedValue = (
	obj: Translations,
	path: string
): string | undefined => {
	const result = path
		.split('.')
		.reduce<unknown>(
			(acc, key) =>
				acc && typeof acc === 'object' ? (acc as Translations)[key] : undefined,
			obj
		);
	return typeof result === 'string' ? result : undefined;
};

export const useTranslation = defineHook<
	undefined,
	readonly ['i18n'],
	TranslationReturn
>({
	name: 'useTranslation',
	deps: ['i18n'] as const,
	setup: ({ layer }): TranslationReturn => {
		const i18n = layer('i18n') as I18nProps;

		const locale = signal<string>(i18n.locale.value);
		const isLoading = signal<boolean>(i18n.isLoading.value);

		const t = (key: string, fallback?: string): string => {
			const translations = i18n.translations.value;
			if (!translations) return fallback ?? key;
			return getNestedValue(translations, key) ?? fallback ?? key;
		};

		return { t, locale, isLoading };
	},
});
