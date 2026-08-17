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

const WAIT = 40;

/**
 * Drives a debounced effect and reports how many times it ran, separating the
 * leading edge from everything after.
 *
 * The effect is created with the default `immediate`, so its first run
 * establishes the dependency. That run is excluded from the counts.
 */
const runBurst = async (
	debounce: Record<string, unknown>,
	triggers: number
): Promise<{ leading: number; total: number; stop: () => void }> => {
	const source = signal(0);
	let runs = 0;
	const handle = watchEffect(
		() => {
			void source.value;
			runs += 1;
		},
		{ debounce } as never
	);

	const base = runs;
	source.value = 1;
	const leading = runs - base;

	for (let index = 2; index <= triggers; index += 1) {
		await sleep(WAIT * 0.6);
		source.value = index;
	}

	await sleep(WAIT * 4);
	return { leading, total: runs - base, stop: handle.stop };
};

describe('debounce', () => {
	it('coalesces a burst into a single trailing run', async () => {
		const outcome = await runBurst({ wait: WAIT }, 3);
		outcome.stop();

		expect(outcome.leading).toBe(0);
		expect(outcome.total).toBe(1);
	});

	it('restarts the wait on every trigger', async () => {
		const source = signal(0);
		const runAt: number[] = [];
		const started = Date.now();
		const handle = watchEffect(
			() => {
				void source.value;
				runAt.push(Date.now() - started);
			},
			{ debounce: { wait: WAIT } }
		);
		runAt.length = 0;

		source.value = 1;
		await sleep(WAIT * 0.6);
		source.value = 2;
		await sleep(WAIT * 0.6);
		source.value = 3;
		await sleep(WAIT * 4);
		handle.stop();

		// One run, and not before the last trigger's own wait elapsed.
		expect(runAt).toHaveLength(1);
		expect(runAt[0]).toBeGreaterThanOrEqual(WAIT * 2);
	});

	it('runs on the leading edge when asked', async () => {
		const outcome = await runBurst({ wait: WAIT, leading: true }, 3);
		outcome.stop();

		expect(outcome.leading).toBe(1);
		// Leading plus one trailing for the triggers that followed.
		expect(outcome.total).toBe(2);
	});

	it('does not double-run a single trigger with leading', async () => {
		const outcome = await runBurst({ wait: WAIT, leading: true }, 1);
		outcome.stop();

		expect(outcome.leading).toBe(1);
		expect(outcome.total).toBe(1);
	});

	it('suppresses the trailing run when asked', async () => {
		const outcome = await runBurst({ wait: WAIT, trailing: false }, 3);
		outcome.stop();

		expect(outcome.total).toBe(0);
	});

	it('runs only on the leading edge with trailing disabled', async () => {
		const outcome = await runBurst(
			{ wait: WAIT, leading: true, trailing: false },
			3
		);
		outcome.stop();

		expect(outcome.leading).toBe(1);
		expect(outcome.total).toBe(1);
	});

	it('cancels a pending run when the effect stops', async () => {
		const source = signal(0);
		const callback = vi.fn(() => {
			void source.value;
		});
		const handle = watchEffect(callback, { debounce: { wait: WAIT } });
		const base = callback.mock.calls.length;

		source.value = 1;
		handle.stop();
		await sleep(WAIT * 4);

		expect(callback.mock.calls.length - base).toBe(0);
	});

	it('leaves the synchronous and post paths alone', async () => {
		const source = signal(0);
		const sync = vi.fn(() => {
			void source.value;
		});
		const syncHandle = watchEffect(sync);
		const syncBase = sync.mock.calls.length;
		source.value = 1;
		expect(sync.mock.calls.length - syncBase).toBe(1);
		syncHandle.stop();

		const other = signal(0);
		const post = vi.fn(() => {
			void other.value;
		});
		const postHandle = watchEffect(post, { flush: 'post' });
		const postBase = post.mock.calls.length;
		other.value = 1;
		expect(post.mock.calls.length - postBase).toBe(0);
		await sleep(20);
		expect(post.mock.calls.length - postBase).toBe(1);
		postHandle.stop();
	});
});
