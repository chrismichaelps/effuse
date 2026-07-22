// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
	createApp,
	define,
	CreateElementNode,
	EFFUSE_NODE,
} from '@effuse/core';
import { useTimeout } from './index.js';

describe('useTimeout lifecycle ownership', () => {
	beforeEach(() => {
		vi.useFakeTimers();
		vi.setSystemTime(0);
		document.body.innerHTML = '<div id="app"></div>';
	});

	afterEach(() => {
		vi.clearAllTimers();
		vi.useRealTimers();
		document.body.innerHTML = '';
	});

	it('cannot invoke its callback after component unmount', async () => {
		const callback = vi.fn();
		const App = define({
			script: () => {
				useTimeout({ callback, delay: 100 });
				return {};
			},
			template: () =>
				CreateElementNode({
					[EFFUSE_NODE]: true,
					tag: 'main',
					props: {},
					children: ['Timeout owner'],
				}),
		});
		const mounted = await createApp(App).mount('#app');

		expect(vi.getTimerCount()).toBeGreaterThan(0);
		await mounted.unmount();
		vi.advanceTimersByTime(200);

		expect(callback).not.toHaveBeenCalled();
		expect(vi.getTimerCount()).toBe(0);
	});
});
