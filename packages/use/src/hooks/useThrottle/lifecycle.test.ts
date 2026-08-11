// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createApp, define, signal, watchEffect } from '@effuse/core';
import { useThrottle } from './index.js';

describe('useThrottle lifecycle ownership', () => {
	beforeEach(() => {
		vi.useFakeTimers();
		document.body.innerHTML = '<div id="app"></div>';
	});

	afterEach(() => {
		vi.clearAllTimers();
		vi.useRealTimers();
		document.body.replaceChildren();
	});

	it('does not acquire a cooldown after a leading update unmounts its owner', async () => {
		const source = signal('initial');
		let throttle: ReturnType<typeof useThrottle<string>> | undefined;
		let mounted: Awaited<ReturnType<ReturnType<typeof createApp>['mount']>>;
		const App = define({
			script: () => {
				throttle = useThrottle({ value: source, interval: 100 });
				return {};
			},
			template: () => null,
		});
		mounted = await createApp(App).mount('#app');
		const observer = watchEffect(() => {
			if (throttle?.value.value === 'updated') void mounted.unmount();
		});

		source.value = 'updated';
		await Promise.resolve();

		expect(vi.getTimerCount()).toBe(0);
		expect(throttle?.value.value).toBe('updated');
		expect(throttle?.isThrottled.value).toBe(false);
		observer.stop();
	});

	it('does not reacquire a cooldown after a trailing update unmounts its owner', async () => {
		const source = signal('initial');
		let throttle: ReturnType<typeof useThrottle<string>> | undefined;
		let mounted: Awaited<ReturnType<ReturnType<typeof createApp>['mount']>>;
		const App = define({
			script: () => {
				throttle = useThrottle({ value: source, interval: 100 });
				return {};
			},
			template: () => null,
		});
		mounted = await createApp(App).mount('#app');
		const observer = watchEffect(() => {
			if (throttle?.value.value === 'trailing') void mounted.unmount();
		});

		source.value = 'first';
		source.value = 'trailing';
		vi.advanceTimersByTime(100);
		await Promise.resolve();

		expect(vi.getTimerCount()).toBe(0);
		expect(throttle?.value.value).toBe('trailing');
		expect(throttle?.isThrottled.value).toBe(false);
		observer.stop();
	});

	it('discards a pending trailing update and normalizes state on teardown', async () => {
		const source = signal({ id: 0 });
		let throttle: ReturnType<typeof useThrottle<{ id: number }>> | undefined;
		const App = define({
			script: () => {
				throttle = useThrottle({ value: source, interval: 100 });
				return {};
			},
			template: () => null,
		});
		const mounted = await createApp(App).mount('#app');
		const applied = { id: 1 };
		const discarded = { id: 2 };

		source.value = applied;
		source.value = discarded;
		await mounted.unmount();
		vi.advanceTimersByTime(200);

		expect(vi.getTimerCount()).toBe(0);
		expect(throttle?.value.value).toBe(applied);
		expect(throttle?.value.value).not.toBe(discarded);
		expect(throttle?.isThrottled.value).toBe(false);
	});
});
