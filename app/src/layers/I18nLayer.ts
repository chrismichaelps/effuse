import { defineLayer, signal } from '@effuse/core';
import { i18nStore, type Locale, LOCALES } from '../store/appI18n';

export const I18nLayer = defineLayer({
	name: 'i18n',
	dependencies: ['router'],
	props: {
		locale: signal<Locale>(LOCALES.EN),
		isLoading: signal(true),
	},
	provides: {
		i18n: () => i18nStore,
	},
	onMount: () => {
		console.log('[I18nLayer] mounted');
	},
	onUnmount: () => {
		console.log('[I18nLayer] unmounted');
	},
	onError: (err) => {
		console.error('[I18nLayer] error:', err.message);
	},
	setup: (ctx) => {
		i18nStore.init();

		ctx.props.locale.value = i18nStore.locale.value;
		ctx.props.isLoading.value = i18nStore.isLoading.value;

		return () => {
			console.log('[I18nLayer] cleanup');
		};
	},
});
