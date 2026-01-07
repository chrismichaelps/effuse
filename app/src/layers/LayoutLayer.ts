import { defineLayer, signal } from '@effuse/core';
import { Header } from '../components/Header';
import { Footer } from '../components/Footer';

export const LayoutLayer = defineLayer({
	name: 'layout',
	props: {
		isDarkMode: signal(false),
		isMobileMenuOpen: signal(false),
	},
	components: {
		Header,
		Footer,
	},
	onMount: () => {
		console.log('[LayoutLayer] mounted');
	},
	onUnmount: () => {
		console.log('[LayoutLayer] unmounted');
	},
	onError: (err) => {
		console.error('[LayoutLayer] error:', err.message);
	},
	setup: (ctx) => {
		const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
		ctx.props.isDarkMode.value = mediaQuery.matches;

		const handleDarkModeChange = (e: MediaQueryListEvent) => {
			ctx.props.isDarkMode.value = e.matches;
		};

		mediaQuery.addEventListener('change', handleDarkModeChange);

		return () => {
			mediaQuery.removeEventListener('change', handleDarkModeChange);
		};
	},
});
