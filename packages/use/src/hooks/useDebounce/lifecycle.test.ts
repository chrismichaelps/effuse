// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createApp, define, signal } from '@effuse/core';
import { useDebounce } from './index.js';

const telemetry = vi.hoisted(() => ({
	init: vi.fn(),
	schedule: vi.fn(),
	flush: vi.fn(),
	cancel: vi.fn(),
}));

vi.mock('./telemetry.js', () => ({
	traceDebounceInit: telemetry.init,
	traceDebounceSchedule: telemetry.schedule,
	traceDebounceFlush: telemetry.flush,
	traceDebounceCancel: telemetry.cancel,
}));

describe('useDebounce lifecycle ownership', () => {
	beforeEach(() => {
		vi.useFakeTimers();
		vi.clearAllMocks();
		document.body.innerHTML = '<div id="app"></div>';
	});

	afterEach(() => {
		vi.clearAllTimers();
		vi.useRealTimers();
		document.body.replaceChildren();
	});

	it('discards pending work and revokes retained controls after teardown', async () => {
		const source = signal('initial');
		let debounce: ReturnType<typeof useDebounce<string>> | undefined;
		const App = define({
			script: () => {
				debounce = useDebounce({ value: source, delay: 100 });
				return {};
			},
			template: () => null,
		});
		const mounted = await createApp(App).mount('#app');
		source.value = 'pending';
		expect(debounce?.isPending.value).toBe(true);

		await mounted.unmount();
		expect(vi.getTimerCount()).toBe(0);
		expect(debounce?.value.value).toBe('initial');
		expect(debounce?.isPending.value).toBe(false);

		vi.clearAllMocks();
		debounce?.flush();
		debounce?.cancel();
		vi.advanceTimersByTime(200);
		expect(debounce?.value.value).toBe('initial');
		expect(debounce?.isPending.value).toBe(false);
		expect(telemetry.flush).not.toHaveBeenCalled();
		expect(telemetry.cancel).not.toHaveBeenCalled();
	});

	it('does not publish a pending object after its owner is gone', async () => {
		const initial = { id: 1 };
		const pending = { id: 2 };
		const source = signal(initial);
		let debounce: ReturnType<typeof useDebounce<{ id: number }>> | undefined;
		const App = define({
			script: () => {
				debounce = useDebounce({ value: source, delay: 100 });
				return {};
			},
			template: () => null,
		});
		const mounted = await createApp(App).mount('#app');
		source.value = pending;

		await mounted.unmount();
		debounce?.flush();

		expect(debounce?.value.value).toBe(initial);
		expect(debounce?.value.value).not.toBe(pending);
		expect(debounce?.isPending.value).toBe(false);
		expect(vi.getTimerCount()).toBe(0);
	});
});
