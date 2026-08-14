/**
 * MIT License
 *
 * Copyright (c) 2025 Chris M. Perez
 */

import { afterEach, describe, expect, it, vi } from 'vitest';
import { signal } from '../../reactivity/signal.js';
import { watch } from '../../effects/watch.js';
import { watchEffect } from '../../effects/effect.js';

/**
 * Captures unhandled rejections raised while `run` executes.
 *
 * Node terminates the process on an unhandled rejection by default, so a
 * rejecting callback in a reactive primitive can take down an SSR server. The
 * listener has to be installed directly, because a promise with no handler is
 * only observable through the process event.
 */
const unhandledDuring = async (run: () => void): Promise<string[]> => {
	const captured: string[] = [];
	const onUnhandled = (reason: unknown): void => {
		captured.push(String(reason));
	};

	process.on('unhandledRejection', onUnhandled);
	try {
		run();
		// Rejections surface at the end of a macrotask, not a microtask.
		await new Promise((resolve) => setTimeout(resolve, 50));
	} finally {
		process.off('unhandledRejection', onUnhandled);
	}

	return captured;
};

describe('async callbacks that reject', () => {
	const handles: { stop: () => void }[] = [];

	afterEach(() => {
		while (handles.length > 0) handles.pop()?.stop();
	});

	it('contains a rejection from a watch callback', async () => {
		const source = signal(0);

		const captured = await unhandledDuring(() => {
			handles.push(
				watch(
					source,
					async () => {
						throw new Error('watch-async-failure');
					},
					{ immediate: true }
				)
			);
			source.value = 1;
		});

		expect(
			captured.filter((reason) => reason.includes('watch-async-failure'))
		).toEqual([]);
	});

	it('contains a rejection from a watchEffect callback', async () => {
		const source = signal(0);

		const captured = await unhandledDuring(() => {
			handles.push(
				watchEffect(async () => {
					void source.value;
					throw new Error('effect-async-failure');
				})
			);
			source.value = 1;
		});

		expect(
			captured.filter((reason) => reason.includes('effect-async-failure'))
		).toEqual([]);
	});

	it('keeps the watch running after a rejected callback', async () => {
		const source = signal(0);
		const seen: number[] = [];

		await unhandledDuring(() => {
			handles.push(
				watch(
					source,
					async (value) => {
						seen.push(value);
						if (value === 1) throw new Error('one failed');
					},
					{ immediate: true }
				)
			);
			source.value = 1;
			source.value = 2;
		});

		expect(seen).toEqual([0, 1, 2]);
	});

	it('leaves a resolving async callback alone', async () => {
		const source = signal(0);
		const callback = vi.fn(async () => {
			await Promise.resolve();
		});

		const captured = await unhandledDuring(() => {
			handles.push(watch(source, callback, { immediate: true }));
			source.value = 1;
		});

		expect(captured).toEqual([]);
		expect(callback).toHaveBeenCalledTimes(2);
	});
});
