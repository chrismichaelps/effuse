import { describe, expect, it, vi } from 'vitest';
import { watchEffect } from '../../effects/effect.js';
import { getSignalDep, signal } from '../../reactivity/signal.js';
import type { EffectHandle } from '../../types/effect.js';

const subscriberCount = (source: ReturnType<typeof signal<number>>): number =>
	getSignalDep(source)?.subscriberCount ?? 0;

describe('watchEffect lifetime', () => {
	it('does not subscribe after a reentrant stop during deferred setup', () => {
		const parentTrigger = signal(0);
		const childSource = signal(0);
		const beforeStopCleanup = vi.fn();
		const afterStopCleanup = vi.fn();
		const childRun = vi.fn();
		let child: EffectHandle | undefined;

		const parent = watchEffect(() => {
			void parentTrigger.value;
			child?.stop();
		});
		child = watchEffect(
			(onCleanup) => {
				childRun();
				void childSource.value;
				onCleanup(beforeStopCleanup);
				parentTrigger.value++;
				onCleanup(afterStopCleanup);
			},
			{ immediate: false }
		);

		child.resume();

		expect(childRun).toHaveBeenCalledOnce();
		expect(beforeStopCleanup).toHaveBeenCalledOnce();
		expect(afterStopCleanup).toHaveBeenCalledOnce();
		expect(subscriberCount(childSource)).toBe(0);

		childSource.value++;
		expect(childRun).toHaveBeenCalledOnce();
		parent.stop();
	});

	it('does not resubscribe when a normal rerun is stopped reentrantly', () => {
		const parentTrigger = signal(0);
		const childTrigger = signal(0);
		const childSource = signal(0);
		const childRun = vi.fn();
		let stopOnParentRun = false;
		let child: EffectHandle | undefined;

		const parent = watchEffect(() => {
			void parentTrigger.value;
			if (stopOnParentRun) child?.stop();
		});
		child = watchEffect(() => {
			childRun();
			void childTrigger.value;
			void childSource.value;
			if (stopOnParentRun) parentTrigger.value++;
		});

		expect(subscriberCount(childSource)).toBe(1);
		stopOnParentRun = true;
		childTrigger.value++;

		expect(childRun).toHaveBeenCalledTimes(2);
		expect(subscriberCount(childTrigger)).toBe(0);
		expect(subscriberCount(childSource)).toBe(0);

		childSource.value++;
		expect(childRun).toHaveBeenCalledTimes(2);
		parent.stop();
	});

	it('runs cleanup registered by an async effect after it was stopped', async () => {
		let release: (() => void) | undefined;
		const ready = new Promise<void>((resolve) => {
			release = resolve;
		});
		const cleanup = vi.fn();
		const handle = watchEffect(async (onCleanup) => {
			await ready;
			onCleanup(cleanup);
		});

		handle.stop();
		release?.();
		await ready;
		await Promise.resolve();

		expect(cleanup).toHaveBeenCalledOnce();
	});
});
