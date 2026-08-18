/**
 * MIT License
 *
 * Copyright (c) 2025 Chris M. Perez
 */

import { describe, expect, it } from 'vitest';
import { createDebounce } from '../../emit/modifiers/debounce.js';

const sleep = (ms: number): Promise<void> =>
	new Promise((resolve) => setTimeout(resolve, ms));

const WAIT = 50;

describe('createDebounce', () => {
	it('coalesces a burst into one call', async () => {
		const debounce = createDebounce<number>(WAIT);
		const seen: number[] = [];

		debounce.apply(1, (v) => seen.push(v));
		debounce.apply(2, (v) => seen.push(v));
		debounce.apply(3, (v) => seen.push(v));
		await sleep(WAIT * 3);

		expect(seen).toEqual([3]);
	});

	it('cancels a pending call', async () => {
		const debounce = createDebounce<number>(WAIT);
		const seen: number[] = [];

		debounce.apply(1, (v) => seen.push(v));
		debounce.cancel();
		await sleep(WAIT * 3);

		expect(seen).toEqual([]);
	});

	it('cancels a call scheduled from inside the callback', async () => {
		// The handle was nulled after the callback ran, so a reschedule from
		// within it had its handle overwritten and became uncancellable.
		const debounce = createDebounce<number>(WAIT);
		const seen: number[] = [];
		let rescheduled = false;

		const callback = (value: number): void => {
			seen.push(value);
			if (rescheduled) return;
			rescheduled = true;
			debounce.apply(value + 1, callback);
		};

		debounce.apply(1, callback);
		// The first call fires at ~WAIT and schedules the second for ~2*WAIT,
		// so cancelling here leaves a wide margin before it is due.
		await sleep(WAIT * 1.2);
		debounce.cancel();
		await sleep(WAIT * 3);

		expect(seen).toEqual([1]);
	});

	it('stays usable after a cancel', async () => {
		const debounce = createDebounce<number>(WAIT);
		const seen: number[] = [];

		debounce.apply(1, (v) => seen.push(v));
		debounce.cancel();
		debounce.apply(2, (v) => seen.push(v));
		await sleep(WAIT * 3);

		expect(seen).toEqual([2]);
	});

	it('is a no-op to cancel with nothing pending', () => {
		const debounce = createDebounce<number>(WAIT);

		expect(() => {
			debounce.cancel();
			debounce.cancel();
		}).not.toThrow();
	});

	it('runs again after a completed call', async () => {
		const debounce = createDebounce<number>(WAIT);
		const seen: number[] = [];

		debounce.apply(1, (v) => seen.push(v));
		await sleep(WAIT * 3);
		debounce.apply(2, (v) => seen.push(v));
		await sleep(WAIT * 3);

		expect(seen).toEqual([1, 2]);
	});
});
