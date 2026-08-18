/**
 * MIT License
 *
 * Copyright (c) 2025 Chris M. Perez
 */

import { describe, expect, it, vi } from 'vitest';
import { signal } from '../../reactivity/signal.js';
import { watchEffect } from '../../effects/effect.js';

const sleep = (ms: number): Promise<void> =>
	new Promise((resolve) => setTimeout(resolve, ms));

/**
 * `EffectOptions` carried `retry` and `timeout` alongside these, both inert:
 * `retry` re-awaited an already-settled promise rather than re-invoking the
 * callback, and `timeout` stopped the fiber without cancelling the underlying
 * promise, which ran to completion regardless. They were removed rather than
 * implemented, so what remains is pinned here.
 */
describe('effect options', () => {
	it('collapses a burst of writes under debounce', async () => {
		const source = signal(0);
		const callback = vi.fn(() => {
			void source.value;
		});

		const handle = watchEffect(callback, { debounce: { wait: 30 } });
		const initial = callback.mock.calls.length;
		for (let next = 1; next <= 5; next += 1) source.value = next;
		await sleep(120);
		handle.stop();

		expect(callback.mock.calls.length - initial).toBe(1);
	});

	it('defers to a later task under flush post', async () => {
		const source = signal(0);
		const callback = vi.fn(() => {
			void source.value;
		});

		const handle = watchEffect(callback, { flush: 'post' });
		const before = callback.mock.calls.length;
		source.value = 1;
		const immediately = callback.mock.calls.length;
		await sleep(30);
		const settled = callback.mock.calls.length;
		handle.stop();

		expect(immediately - before).toBe(0);
		expect(settled - before).toBe(1);
	});

	it('runs synchronously by default', () => {
		const source = signal(0);
		const callback = vi.fn(() => {
			void source.value;
		});

		const handle = watchEffect(callback);
		const before = callback.mock.calls.length;
		source.value = 1;
		handle.stop();

		expect(callback.mock.calls.length - before).toBe(1);
	});

	it('skips the first run when immediate is false', () => {
		const source = signal(0);
		const callback = vi.fn(() => {
			void source.value;
		});

		const handle = watchEffect(callback, { immediate: false });
		expect(callback).not.toHaveBeenCalled();
		handle.stop();
	});

	it('keeps containing a rejected async callback', async () => {
		const captured: string[] = [];
		const onUnhandled = (reason: unknown): void => {
			captured.push(String(reason));
		};
		process.on('unhandledRejection', onUnhandled);

		const source = signal(0);
		const handle = watchEffect(async () => {
			void source.value;
			throw new Error('async-failure');
		});
		source.value = 1;
		await sleep(50);
		handle.stop();
		process.off('unhandledRejection', onUnhandled);

		expect(
			captured.filter((reason) => reason.includes('async-failure'))
		).toEqual([]);
	});
});
