/**
 * MIT License
 *
 * Copyright (c) 2025 Chris M. Perez
 */

import { describe, expect, it, vi } from 'vitest';
import { getSignalDep, signal } from '../../reactivity/signal.js';
import { watch } from '../../effects/watch.js';
import { watchEffect } from '../../effects/effect.js';

const subscribers = (source: ReturnType<typeof signal<string>>): number =>
	getSignalDep(source)?.subscriberCount ?? -1;

describe('cleanups do not contribute dependencies', () => {
	it('does not subscribe a watch to a signal only its cleanup reads', () => {
		const source = signal(0);
		const unrelated = signal('a');
		const handle = watch(
			source,
			(_value, _previous, onCleanup) => {
				onCleanup(() => {
					void unrelated.value;
				});
			},
			{ immediate: true }
		);

		// The cleanup only runs on the second pass, which is where a tracked
		// read would be recorded.
		source.value = 1;

		expect(subscribers(unrelated)).toBe(0);
		handle.stop();
	});

	it('does not subscribe a watchEffect to a signal only its cleanup reads', () => {
		const source = signal(0);
		const unrelated = signal('a');
		const handle = watchEffect((onCleanup) => {
			void source.value;
			onCleanup(() => {
				void unrelated.value;
			});
		});

		source.value = 1;

		expect(subscribers(unrelated)).toBe(0);
		handle.stop();
	});

	it('does not re-run a deep watch when a cleanup-read signal changes', () => {
		const source = signal({ n: 0 });
		const unrelated = signal('a');
		const callback = vi.fn((_v: unknown, _o: unknown, onCleanup: (fn: () => void) => void) => {
			onCleanup(() => {
				void unrelated.value;
			});
		});

		const handle = watch(source, callback, { deep: true, immediate: true });
		source.value = { n: 1 };
		const before = callback.mock.calls.length;

		unrelated.value = 'b';

		expect(callback.mock.calls.length).toBe(before);
		handle.stop();
	});

	it('still runs a watch when its own source changes', () => {
		const source = signal(0);
		const seen: number[] = [];
		const handle = watch(
			source,
			(value, _previous, onCleanup) => {
				seen.push(value);
				onCleanup(() => {
					/* registered on every pass */
				});
			},
			{ immediate: true }
		);

		source.value = 1;
		source.value = 2;

		expect(seen).toEqual([0, 1, 2]);
		handle.stop();
	});

	it('runs every cleanup even when one throws', () => {
		const source = signal(0);
		const second = vi.fn();
		const handle = watch(
			source,
			(_value, _previous, onCleanup) => {
				onCleanup(() => {
					throw new Error('cleanup failed');
				});
				onCleanup(second);
			},
			{ immediate: true }
		);

		expect(() => {
			source.value = 1;
		}).not.toThrow();
		expect(second).toHaveBeenCalledTimes(1);

		handle.stop();
	});

	it('runs cleanups on stop without tracking them', () => {
		const source = signal(0);
		const unrelated = signal('a');
		const cleanup = vi.fn(() => {
			void unrelated.value;
		});

		const handle = watch(
			source,
			(_value, _previous, onCleanup) => {
				onCleanup(cleanup);
			},
			{ immediate: true }
		);

		handle.stop();

		expect(cleanup).toHaveBeenCalledTimes(1);
		expect(subscribers(unrelated)).toBe(0);
	});
});
