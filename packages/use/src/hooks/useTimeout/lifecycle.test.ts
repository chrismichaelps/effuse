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
		let timeout: ReturnType<typeof useTimeout> | undefined;
		const App = define({
			script: () => {
				timeout = useTimeout({ callback, delay: 100 });
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
		expect(timeout?.status.value).toBe('idle');
		expect(timeout?.remaining.value).toBe(100);

		timeout?.restart();
		vi.advanceTimersByTime(200);
		expect(callback).not.toHaveBeenCalled();
		expect(vi.getTimerCount()).toBe(0);
		expect(timeout?.status.value).toBe('idle');
	});

	it('does not start a non-immediate timeout after owner teardown', async () => {
		const callback = vi.fn();
		let timeout: ReturnType<typeof useTimeout> | undefined;
		const App = define({
			script: () => {
				timeout = useTimeout({ callback, delay: 100, immediate: false });
				return {};
			},
			template: () => null,
		});
		const mounted = await createApp(App).mount('#app');
		await mounted.unmount();

		timeout?.start();
		vi.advanceTimersByTime(200);
		expect(callback).not.toHaveBeenCalled();
		expect(vi.getTimerCount()).toBe(0);
		expect(timeout?.status.value).toBe('idle');
	});
});
