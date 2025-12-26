import { createStore, connectDevTools } from '@effuse/store';

interface DocsUIState {
	isSidebarOpen: boolean;
	isSidebarCollapsed: boolean;
	openSections: Record<string, boolean>;
}

export const docsStore = createStore<
	DocsUIState & {
		toggleSidebar: () => void;
		toggleCollapse: () => void;
		closeSidebar: () => void;
		expandSidebar: () => void;
		toggleSection: (title: string) => void;
		isSectionOpen: (title: string) => boolean;
	}
>(
	'docsUI',
	{
		isSidebarOpen: false,
		isSidebarCollapsed: false,
		openSections: {
			'Getting Started': true,
			'Core Concepts': true,
			Advanced: false,
			Examples: false,
		},

		toggleSidebar() {
			this.isSidebarOpen.value = !this.isSidebarOpen.value;
		},

		toggleCollapse() {
			this.isSidebarCollapsed.value = !this.isSidebarCollapsed.value;
		},

		closeSidebar() {
			this.isSidebarOpen.value = false;
		},

		expandSidebar() {
			this.isSidebarCollapsed.value = false;
		},

		toggleSection(title: string) {
			const current = { ...this.openSections.value };
			current[title] = !current[title];
			this.openSections.value = current;
		},

		isSectionOpen(title: string) {
			return !!this.openSections.value[title];
		},
	},
	{ devtools: true }
);

connectDevTools(docsStore);

export const isSidebarOpen = docsStore.isSidebarOpen;
export const isSidebarCollapsed = docsStore.isSidebarCollapsed;
export const toggleSidebar = () => docsStore.toggleSidebar();
export const toggleCollapse = () => docsStore.toggleCollapse();
export const closeSidebar = () => docsStore.closeSidebar();
export const expandSidebar = () => docsStore.expandSidebar();
