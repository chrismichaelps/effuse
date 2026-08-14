// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createApp, define } from '@effuse/core';
import { useInterval } from './index.js';

describe('useInterval lifecycle ownership', () => {
	beforeEach(() => {
		vi.useFakeTimers();
		document.body.innerHTML = '<div id="app"></div>';
	});

	afterEach(() => {
		vi.clearAllTimers();
		vi.useRealTimers();
		document.body.replaceChildren();
	});

	it('cannot restart after component unmount', async () => {
		const callback = vi.fn();
		let interval: ReturnType<typeof useInterval> | undefined;
		const App = define({
			script: () => {
				interval = useInterval({ callback, delay: 100 });
				return {};
			},
			template: () => null,
		});
		const mounted = await createApp(App).mount('#app');
		vi.advanceTimersByTime(100);
		expect(callback).toHaveBeenCalledOnce();

		await mounted.unmount();
		expect(interval?.status.value).toBe('stopped');
		expect(interval?.count.value).toBe(0);
		interval?.start();
		vi.advanceTimersByTime(200);

		expect(callback).toHaveBeenCalledOnce();
		expect(vi.getTimerCount()).toBe(0);
		expect(interval?.status.value).toBe('stopped');
	});

	it('does not start a non-immediate interval after owner teardown', async () => {
		const callback = vi.fn();
		let interval: ReturnType<typeof useInterval> | undefined;
		const App = define({
			script: () => {
				interval = useInterval({ callback, delay: 100, immediate: false });
				return {};
			},
			template: () => null,
		});
		const mounted = await createApp(App).mount('#app');
		await mounted.unmount();

		interval?.start();
		vi.advanceTimersByTime(200);
		expect(callback).not.toHaveBeenCalled();
		expect(vi.getTimerCount()).toBe(0);
		expect(interval?.status.value).toBe('stopped');
	});

	it('keeps teardown state when a tick unmounts its own owner', async () => {
		let interval: ReturnType<typeof useInterval> | undefined;
		let mounted: Awaited<ReturnType<ReturnType<typeof createApp>['mount']>>;
		const App = define({
			script: () => {
				interval = useInterval({
					delay: 100,
					callback: () => {
						void mounted.unmount();
					},
				});
				return {};
			},
			template: () => null,
		});
		mounted = await createApp(App).mount('#app');

		vi.advanceTimersByTime(100);
		await Promise.resolve();

		expect(interval?.status.value).toBe('stopped');
		expect(interval?.count.value).toBe(0);
		expect(vi.getTimerCount()).toBe(0);
	});
});
