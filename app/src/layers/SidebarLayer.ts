import { defineLayer, signal } from '@effuse/core';
import { Sidebar } from '../components/docs/Sidebar';
import { SidebarToggle } from '../components/docs/SidebarToggle';
import { docsStore } from '../store/docsUIStore';

export const SidebarLayer = defineLayer({
	name: 'sidebar',
	dependencies: ['layout', 'i18n'],
	props: {
		isOpen: signal(false),
		width: signal(280),
		isCollapsed: signal(false),
	},
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
	setup: (ctx) => {
		ctx.props.isOpen.value = docsStore.isSidebarOpen.value;
		ctx.props.isCollapsed.value = docsStore.isSidebarCollapsed.value;

		return () => {
			console.log('[SidebarLayer] cleanup');
		};
	},
});
