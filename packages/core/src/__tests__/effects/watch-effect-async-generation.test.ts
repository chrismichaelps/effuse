import { describe, expect, it, vi } from 'vitest';
import { watchEffect } from '../../effects/effect.js';
import { signal } from '../../reactivity/signal.js';

interface Deferred {
	readonly promise: Promise<void>;
	readonly resolve: () => void;
}

const deferred = (): Deferred => {
	let resolve: (() => void) | undefined;
	const promise = new Promise<void>((done) => {
		resolve = done;
	});
	return { promise, resolve: () => resolve?.() };
};

const flushPromises = async (): Promise<void> => {
	await Promise.resolve();
	await Promise.resolve();
};

describe('watchEffect async cleanup generations (issue #503)', () => {
	it('immediately cleans a late registration from an invalidated run', async () => {
		const source = signal(0);
		const gates = [deferred(), deferred()];
		const cleanups = [vi.fn(), vi.fn()];
		const handle = watchEffect(async (onCleanup) => {
			const run = source.value;
			await gates[run]!.promise;
			onCleanup(cleanups[run]!);
		});

		source.value = 1;
		gates[0]!.resolve();
		await flushPromises();

		expect(cleanups[0]).toHaveBeenCalledOnce();
		expect(cleanups[1]).not.toHaveBeenCalled();

		gates[1]!.resolve();
		await flushPromises();
		expect(cleanups[1]).not.toHaveBeenCalled();

		handle.stop();
		expect(cleanups[0]).toHaveBeenCalledOnce();
		expect(cleanups[1]).toHaveBeenCalledOnce();
	});

	it('keeps cleanup ownership isolated across overlapping runs', async () => {
		const source = signal(0);
		const gates = [deferred(), deferred(), deferred()];
		const cleanupOrder: number[] = [];
		const handle = watchEffect(async (onCleanup) => {
			const run = source.value;
			await gates[run]!.promise;
			onCleanup(() => cleanupOrder.push(run));
		});

		source.value = 1;
		source.value = 2;

		gates[1]!.resolve();
		await flushPromises();
		gates[0]!.resolve();
		await flushPromises();
		expect(cleanupOrder).toEqual([1, 0]);

		gates[2]!.resolve();
		await flushPromises();
		expect(cleanupOrder).toEqual([1, 0]);

		handle.stop();
		expect(cleanupOrder).toEqual([1, 0, 2]);
	});

	it('cleans a late registration after stop exactly once', async () => {
		const gate = deferred();
		const cleanup = vi.fn();
		const handle = watchEffect(async (onCleanup) => {
			await gate.promise;
			onCleanup(cleanup);
		});

		handle.stop();
		gate.resolve();
		await flushPromises();

		expect(cleanup).toHaveBeenCalledOnce();
		handle.stop();
		expect(cleanup).toHaveBeenCalledOnce();
	});
});
