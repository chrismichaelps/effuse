import { describe, expect, it, vi } from 'vitest';
import { useCallback, useMemo } from '../../blueprint/hooks.js';
import {
	createComponentLifecycleSync,
	withActiveLifecycle,
} from '../../blueprint/lifecycle.js';
import { readonlySignal, signal } from '../../reactivity/signal.js';

describe('composition memo helpers', () => {
	it('returns the original callback without creating dependency subscriptions', () => {
		const dependency = signal(1);
		const callback = () => dependency.value;
		const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

		const result = useCallback(callback, [dependency]);

		expect(result).toBe(callback);
		dependency.value = 2;
		expect(result()).toBe(2);
		expect(warn).toHaveBeenCalledWith(
			expect.stringContaining('Use a plain closure')
		);
		warn.mockRestore();
	});

	it('automatically tracks values read by useMemo when dependencies are omitted', () => {
		const lifecycle = createComponentLifecycleSync();
		const source = signal(2);
		let runs = 0;
		const memo = withActiveLifecycle(lifecycle, () =>
			useMemo(() => {
				runs += 1;
				return source.value * 2;
			})
		);

		expect(memo.value).toBe(4);
		expect(runs).toBe(1);
		source.value = 3;
		expect(memo.value).toBe(6);
		expect(runs).toBe(2);
	});

	it('tracks only explicit signal dependencies when provided', () => {
		const lifecycle = createComponentLifecycleSync();
		const dependency = signal(1);
		const incidental = signal('first');
		let runs = 0;
		const memo = withActiveLifecycle(lifecycle, () =>
			useMemo(() => {
				runs += 1;
				return `${dependency.value}:${incidental.value}`;
			}, [dependency])
		);

		expect(memo.value).toBe('1:first');
		incidental.value = 'second';
		expect(memo.value).toBe('1:first');
		expect(runs).toBe(1);
		dependency.value = 2;
		expect(memo.value).toBe('2:second');
		expect(runs).toBe(2);
	});

	it('accepts readonly signal views as explicit dependencies', () => {
		const lifecycle = createComponentLifecycleSync();
		const source = signal(1);
		const dependency = readonlySignal(source);
		const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
		const memo = withActiveLifecycle(lifecycle, () =>
			useMemo(() => dependency.value * 2, [dependency])
		);

		expect(memo.value).toBe(2);
		source.value = 2;
		expect(memo.value).toBe(4);
		expect(warn).not.toHaveBeenCalledWith(
			expect.stringContaining('non-signal dependency')
		);
		warn.mockRestore();
	});

	it('computes once when given an empty dependency list', () => {
		const lifecycle = createComponentLifecycleSync();
		const source = signal(1);
		let runs = 0;
		const memo = withActiveLifecycle(lifecycle, () =>
			useMemo(() => {
				runs += 1;
				return source.value;
			}, [])
		);

		expect(memo.value).toBe(1);
		source.value = 2;
		expect(memo.value).toBe(1);
		expect(runs).toBe(1);
	});

	it('warns and ignores unsupported dependency values', () => {
		const lifecycle = createComponentLifecycleSync();
		const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
		const memo = withActiveLifecycle(lifecycle, () =>
			useMemo(() => 42, [42] as unknown as readonly never[])
		);

		expect(memo.value).toBe(42);
		expect(warn).toHaveBeenCalledWith(
			expect.stringContaining('ignored 1 non-signal dependency')
		);
		warn.mockRestore();
	});

	it('stops memo subscriptions when the component lifecycle is cleaned up', () => {
		const lifecycle = createComponentLifecycleSync();
		const source = signal(1);
		let runs = 0;
		const memo = withActiveLifecycle(lifecycle, () =>
			useMemo(() => {
				runs += 1;
				return source.value;
			})
		);

		expect(memo.value).toBe(1);
		lifecycle.runCleanup();
		source.value = 2;
		expect(memo.value).toBe(1);
		expect(runs).toBe(1);
	});

	it('freezes a disposed memo regardless of when the source changed', () => {
		const lifecycle = createComponentLifecycleSync();
		const source = signal(1);
		let runs = 0;
		const memo = withActiveLifecycle(lifecycle, () =>
			useMemo(() => {
				runs += 1;
				return source.value;
			})
		);

		expect(memo.value).toBe(1);
		// Changing before cleanup rather than after must not buy the memo an
		// extra evaluation: a memo nothing observes holds no subscription, so
		// there is no pending invalidation for disposal to flush.
		source.value = 2;
		lifecycle.runCleanup();

		expect(memo.value).toBe(1);
		source.value = 3;
		expect(memo.value).toBe(1);
		expect(runs).toBe(1);
	});

	it('evaluates an unread disposed memo once without subscribing', () => {
		const lifecycle = createComponentLifecycleSync();
		const source = signal(1);
		let runs = 0;
		const memo = withActiveLifecycle(lifecycle, () =>
			useMemo(() => {
				runs += 1;
				return source.value;
			})
		);

		lifecycle.runCleanup();
		source.value = 2;
		expect(memo.value).toBe(2);
		source.value = 3;
		expect(memo.value).toBe(2);
		expect(runs).toBe(1);
	});
});
