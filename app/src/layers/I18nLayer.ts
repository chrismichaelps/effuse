import { defineLayer } from '@effuse/core';
import { i18nStore, Locale } from '../store/appI18n';

const LOCALE_STORAGE_KEY = 'effuse:locale';

export const I18nLayer = defineLayer({
	name: 'i18n',
	dependencies: ['router'],
	store: i18nStore,
	deriveProps: (store) => ({
		locale: store.locale,
		isLoading: store.isLoading,
		translations: store.translations,
	}),
	provides: {
		i18n: () => i18nStore,
	},
	onMount: (ctx) => {
		const savedLocale = localStorage.getItem(LOCALE_STORAGE_KEY);
		if (savedLocale && savedLocale !== ctx.store.locale.value) {
			ctx.store.setLocale(savedLocale as Locale);
		}
	},
	onUnmount: (ctx) => {
		localStorage.setItem(LOCALE_STORAGE_KEY, ctx.store.locale.value);
	},
	onError: (_, ctx) => {
		ctx.store.setLocale('en');
	},
	setup: (ctx) => {
		ctx.store.init();
	},
});
