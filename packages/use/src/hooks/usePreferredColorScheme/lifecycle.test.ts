// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
	createApp,
	define,
	CreateElementNode,
	EFFUSE_NODE,
} from '@effuse/core';
import {
	usePreferredColorScheme,
	type UsePreferredColorSchemeReturn,
} from './index.js';

class MockMediaQuery extends EventTarget {
	constructor(public matches: boolean) {
		super();
	}
}

describe('usePreferredColorScheme lifecycle ownership', () => {
	let darkQuery: MockMediaQuery;
	let lightQuery: MockMediaQuery;

	beforeEach(() => {
		darkQuery = new MockMediaQuery(true);
		lightQuery = new MockMediaQuery(false);
		vi.stubGlobal('matchMedia', (query: string) =>
			query.includes('dark') ? darkQuery : lightQuery
		);
		document.body.innerHTML = '<div id="app"></div>';
	});

	afterEach(() => {
		vi.unstubAllGlobals();
		document.body.innerHTML = '';
	});

	it('stops observing after component unmount', async () => {
		let colorScheme: UsePreferredColorSchemeReturn | undefined;
		const App = define({
			script: () => {
				colorScheme = usePreferredColorScheme();
				return {};
			},
			template: () =>
				CreateElementNode({
					[EFFUSE_NODE]: true,
					tag: 'main',
					props: {},
					children: ['Color owner'],
				}),
		});
		const mounted = await createApp(App).mount('#app');
		expect(colorScheme?.scheme.value).toBe('dark');

		await mounted.unmount();
		darkQuery.matches = false;
		lightQuery.matches = true;
		darkQuery.dispatchEvent(new Event('change'));

		expect(colorScheme?.scheme.value).toBe('dark');
	});
});
