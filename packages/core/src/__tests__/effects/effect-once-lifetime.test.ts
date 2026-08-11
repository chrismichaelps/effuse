import { describe, expect, it, vi } from 'vitest';
import { effectOnce, watchEffect } from '../../effects/effect.js';
import {
	getTrackingPaused,
	pauseTracking,
	resumeTracking,
} from '../../reactivity/dep.js';
import { getSignalDep, signal } from '../../reactivity/signal.js';

const subscriberCount = (source: ReturnType<typeof signal<number>>): number =>
	getSignalDep(source)?.subscriberCount ?? 0;

describe('effectOnce lifetime (issue #501)', () => {
	it('runs a successful callback exactly once without throwing', () => {
		const callback = vi.fn();

		expect(() => effectOnce(callback)).not.toThrow();
		expect(callback).toHaveBeenCalledOnce();
	});

	it('does not subscribe to reactive values read by the callback', () => {
		const source = signal(0);
		const callback = vi.fn(() => void source.value);

		effectOnce(callback);
		expect(subscriberCount(source)).toBe(0);

		source.value++;
		expect(callback).toHaveBeenCalledOnce();
	});

	it('does not leak its reads into an enclosing effect', () => {
		const outerSource = signal(0);
		const oneShotSource = signal(0);
		const outerRun = vi.fn();
		const oneShotRun = vi.fn();
		const outer = watchEffect(() => {
			outerRun();
			void outerSource.value;
			effectOnce(() => {
				oneShotRun();
				void oneShotSource.value;
			});
		});

		expect(subscriberCount(outerSource)).toBe(1);
		expect(subscriberCount(oneShotSource)).toBe(0);
		oneShotSource.value++;
		expect(outerRun).toHaveBeenCalledOnce();
		expect(oneShotRun).toHaveBeenCalledOnce();

		outerSource.value++;
		expect(outerRun).toHaveBeenCalledTimes(2);
		expect(oneShotRun).toHaveBeenCalledTimes(2);
		outer.stop();
	});

	it('restores paused tracking when the callback throws', () => {
		pauseTracking();
		try {
			expect(() =>
				effectOnce(() => {
					throw new Error('one-shot failure');
				})
			).toThrow('one-shot failure');
			expect(getTrackingPaused()).toBe(true);
		} finally {
			resumeTracking();
		}
	});
});

describe('watchEffect failed setup lifetime (issue #501)', () => {
	it('cleans resources and subscriptions after an initial synchronous failure', () => {
		const source = signal(0);
		const cleanup = vi.fn();

		expect(() =>
			watchEffect((onCleanup) => {
				void source.value;
				onCleanup(cleanup);
				throw new Error('setup failure');
			})
		).toThrow('setup failure');

		expect(cleanup).toHaveBeenCalledOnce();
		expect(subscriberCount(source)).toBe(0);
	});

	it('cleans and unsubscribes when an established effect fails on rerun', () => {
		const source = signal(0);
		const cleanup = vi.fn();
		const callback = vi.fn((onCleanup: (cleanup: () => void) => void) => {
			const value = source.value;
			onCleanup(cleanup);
			if (value === 1) throw new Error('rerun failure');
		});
		const handle = watchEffect(callback);

		expect(subscriberCount(source)).toBe(1);
		expect(() => {
			source.value = 1;
		}).toThrow('rerun failure');

		expect(callback).toHaveBeenCalledTimes(2);
		expect(cleanup).toHaveBeenCalledTimes(2);
		expect(subscriberCount(source)).toBe(0);
		handle.stop();
		expect(cleanup).toHaveBeenCalledTimes(2);
	});
});
