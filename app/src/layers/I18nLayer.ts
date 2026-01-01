import { defineLayer } from '@effuse/core';
import { i18nStore } from '../store/appI18n';

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
		ctx.store.init();
		return () => {
			console.log('[I18nLayer] cleanup');
		};
	},
});
