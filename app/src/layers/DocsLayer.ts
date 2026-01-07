import { defineLayer, signal } from '@effuse/core';
import { DocsLayout } from '../components/docs/DocsLayout';
import { DocsHeader } from '../components/docs/DocsHeader';
import { LanguageSelector } from '../components/docs/LanguageSelector';

export const DocsLayer = defineLayer({
	name: 'docs',
	dependencies: ['sidebar', 'i18n'],
	props: {
		theme: signal<'light' | 'dark'>('light'),
		currentSlug: signal(''),
	},
	components: {
		DocsLayout,
		DocsHeader,
		LanguageSelector,
	},
	onMount: () => {
		console.log('[DocsLayer] mounted');
	},
	onUnmount: () => {
		console.log('[DocsLayer] unmounted');
	},
	onError: (err) => {
		console.error('[DocsLayer] error:', err.message);
	},
	setup: () => {
		return () => {
			console.log('[DocsLayer] cleanup');
		};
	},
});
