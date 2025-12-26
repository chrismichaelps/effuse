import { createApp } from '@effuse/core';
import { InkProseLayer } from '@effuse/ink';
import { App } from './App';
import { router, installRouter } from './router';
import { i18nStore } from './store/appI18n';

import './styles.css';

installRouter(router);

i18nStore.init();

createApp(App)
	.useLayers([InkProseLayer])
	.then((app) => {
		app
			.mount('#app')
			.then(() => console.log('[App] mounted'))
			.catch((err) => console.error('[App] mount failed', err));
	});
