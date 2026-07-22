// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
	createApp,
	define,
	CreateElementNode,
	EFFUSE_NODE,
} from '@effuse/core';
import {
	useDocumentVisibility,
	type UseDocumentVisibilityReturn,
} from './index.js';

describe('useDocumentVisibility lifecycle ownership', () => {
	let currentState: DocumentVisibilityState;

	beforeEach(() => {
		currentState = 'visible';
		Object.defineProperty(document, 'visibilityState', {
			configurable: true,
			get: () => currentState,
		});
		document.body.innerHTML = '<div id="app"></div>';
	});

	afterEach(() => {
		document.body.innerHTML = '';
	});

	it('stops observing after component unmount', async () => {
		let visibility: UseDocumentVisibilityReturn | undefined;
		const App = define({
			script: () => {
				visibility = useDocumentVisibility();
				return {};
			},
			template: () =>
				CreateElementNode({
					[EFFUSE_NODE]: true,
					tag: 'main',
					props: {},
					children: ['Visibility owner'],
				}),
		});
		const mounted = await createApp(App).mount('#app');

		currentState = 'hidden';
		document.dispatchEvent(new Event('visibilitychange'));
		expect(visibility?.state.value).toBe('hidden');

		await mounted.unmount();
		currentState = 'visible';
		document.dispatchEvent(new Event('visibilitychange'));

		expect(visibility?.state.value).toBe('hidden');
	});
});
