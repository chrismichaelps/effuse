import { createApp } from '@effuse/core';
import { InkLayer } from '@effuse/ink';
import { App } from './App';
import {
	RouterLayer,
	I18nLayer,
	SidebarLayer,
	TodosLayer,
	DocsLayer,
	LayoutLayer,
} from './layers';
import './styles.css';

createApp(App)
	.useLayers([
		InkLayer,
		LayoutLayer,
		RouterLayer,
		I18nLayer,
		SidebarLayer,
		DocsLayer,
		TodosLayer,
	])
	.then((app) => {
		app
			.mount('#app')
			.then(() => console.log('[App] mounted'))
			.catch((err) => console.error('[App] mount failed', err));
	});
