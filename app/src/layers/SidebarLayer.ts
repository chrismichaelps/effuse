import { defineLayer, signal } from '@effuse/core';
import { Sidebar } from '../components/docs/Sidebar';
import { SidebarToggle } from '../components/docs/SidebarToggle';
import { docsStore } from '../store/docsUIStore';

export const SidebarLayer = defineLayer({
	name: 'sidebar',
	dependencies: ['layout', 'i18n'],
	store: docsStore,
	deriveProps: (store) => ({
		isOpen: store.isSidebarOpen,
		width: signal(280),
		isCollapsed: store.isSidebarCollapsed,
	}),
	components: {
		Sidebar,
		SidebarToggle,
	},
	provides: {
		docsUI: () => docsStore,
	},
	onMount: () => {
		console.log('[SidebarLayer] mounted');
	},
	onUnmount: () => {
		console.log('[SidebarLayer] unmounted');
	},
	onError: (err) => {
		console.error('[SidebarLayer] error:', err.message);
	},
});
