import { define } from '@effuse/core';
import { RouterView } from '@effuse/router';
import { AppLayout } from './layers/AppLayout.js';
import { SmoothScroll } from './components/SmoothScroll';

export const App = define({
	script: ({}) => ({}),
	template: () => (
		<AppLayout>
			<SmoothScroll />
			<RouterView />
		</AppLayout>
	),
});
