import { describe, expect, it, vi } from 'vitest';
import { createScriptContext } from '../../blueprint/script-context.js';
import { watch, watchMultiple } from '../../effects/watch.js';
import { signal } from '../../reactivity/signal.js';

describe('watch cleanup ownership', () => {
	it('runs the latest watch cleanup when stopped', () => {
		const source = signal(0);
		const cleanup = vi.fn();
		const handle = watch(
			source,
			(_value, _oldValue, onCleanup) => onCleanup(cleanup),
			{ immediate: true }
		);

		handle.stop();
		handle.stop();
		expect(cleanup).toHaveBeenCalledOnce();
	});

	it('runs the latest watchMultiple cleanup when stopped', () => {
		const source = signal(0);
		const cleanup = vi.fn();
		const handle = watchMultiple(
			[source] as const,
			(_value, _oldValue, onCleanup) => onCleanup(cleanup),
			{ immediate: true }
		);

		handle.stop();
		expect(cleanup).toHaveBeenCalledOnce();
	});

	it('returns handles and stops context watchers on unmount', () => {
		const source = signal(0);
		const cleanup = vi.fn();
		const { context, state } = createScriptContext({});
		const handle = context.watch(
			source,
			(_value, _oldValue, onCleanup) => onCleanup(cleanup),
			{ immediate: true }
		);

		expect(handle.stop).toBeTypeOf('function');
		state.lifecycle.runCleanup();
		expect(cleanup).toHaveBeenCalledOnce();
	});
});
