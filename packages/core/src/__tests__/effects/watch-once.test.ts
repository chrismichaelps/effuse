import { describe, expect, it, vi } from 'vitest';
import { watch, watchMultiple } from '../../effects/watch.js';
import { signal } from '../../reactivity/signal.js';

describe('watch once callback ownership', () => {
	it('counts an immediate watch callback as the single invocation', () => {
		const source = signal(0);
		const callback = vi.fn();

		watch(source, callback, { immediate: true, once: true });
		source.value = 1;
		source.value = 2;

		expect(callback).toHaveBeenCalledOnce();
		expect(callback).toHaveBeenCalledWith(0, undefined, expect.any(Function));
	});

	it('runs immediate callback cleanup before returning', () => {
		const source = signal(0);
		const cleanup = vi.fn();

		const handle = watch(
			source,
			(_value, _oldValue, onCleanup) => onCleanup(cleanup),
			{ immediate: true, once: true }
		);

		expect(cleanup).toHaveBeenCalledOnce();
		handle.stop();
		expect(cleanup).toHaveBeenCalledOnce();
	});

	it('does not consume once when a derived value stays unchanged', () => {
		const source = signal(0);
		const callback = vi.fn();

		watch(() => source.value % 2, callback, { once: true });
		source.value = 2;
		expect(callback).not.toHaveBeenCalled();
		source.value = 3;
		source.value = 4;

		expect(callback).toHaveBeenCalledOnce();
		expect(callback).toHaveBeenCalledWith(1, 0, expect.any(Function));
	});

	it('stops a reentrant watcher after its first callback', () => {
		const source = signal(0);
		const values: number[] = [];

		watch(
			source,
			(value) => {
				values.push(value);
				source.value = value + 1;
			},
			{ once: true }
		);
		source.value = 1;
		source.value = 3;

		expect(values).toEqual([1]);
	});
});

describe('watchMultiple once callback ownership', () => {
	it('counts an immediate callback as the single invocation', () => {
		const first = signal(0);
		const second = signal('ready');
		const callback = vi.fn();

		watchMultiple([first, second] as const, callback, {
			immediate: true,
			once: true,
		});
		first.value = 1;
		second.value = 'changed';

		expect(callback).toHaveBeenCalledOnce();
		expect(callback).toHaveBeenCalledWith(
			[0, 'ready'],
			[undefined, undefined],
			expect.any(Function)
		);
	});

	it('runs immediate callback cleanup before returning', () => {
		const source = signal(0);
		const cleanup = vi.fn();

		const handle = watchMultiple(
			[source] as const,
			(_values, _oldValues, onCleanup) => onCleanup(cleanup),
			{ immediate: true, once: true }
		);

		expect(cleanup).toHaveBeenCalledOnce();
		handle.stop();
		expect(cleanup).toHaveBeenCalledOnce();
	});

	it('does not consume once when all derived values stay unchanged', () => {
		const first = signal(0);
		const second = signal(0);
		const callback = vi.fn();

		watchMultiple(
			[() => first.value % 2, () => second.value % 2] as const,
			callback,
			{ once: true }
		);
		first.value = 2;
		second.value = 2;
		expect(callback).not.toHaveBeenCalled();
		second.value = 3;
		first.value = 3;

		expect(callback).toHaveBeenCalledOnce();
		expect(callback).toHaveBeenCalledWith(
			[0, 1],
			[0, 0],
			expect.any(Function)
		);
	});
});
