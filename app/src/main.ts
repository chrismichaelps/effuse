import { createApp } from '@effuse/core';
import { InkProseLayer } from '@effuse/ink';
import { App } from './App';
import { router, installRouter } from './router';

import './styles.css';

installRouter(router);

createApp(App)
	.useLayers([InkProseLayer])
	.then((app) => app.mount('#app'));
