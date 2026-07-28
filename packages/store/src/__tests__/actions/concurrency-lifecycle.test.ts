import { afterEach, describe, expect, it, vi } from 'vitest';
import { useConcurrency } from '../../actions/useConcurrency.js';

describe('useConcurrency lifecycle ownership', () => {
	afterEach(() => {
		vi.useRealTimers();
		vi.restoreAllMocks();
	});

	it('aborts superseded switch work through the injected signal', async () => {
		const aborted: string[] = [];
		const action = (id: string, signal: AbortSignal) =>
			new Promise<void>((resolve, reject) => {
				signal.addEventListener(
					'abort',
					() => {
						aborted.push(id);
						reject(new DOMException('Aborted', 'AbortError'));
					},
					{ once: true }
				);
				if (id === 'second') resolve();
			});
		const run = useConcurrency(action, {
			strategy: 'switch',
			cancellable: true,
		});

		run('first');
		run('second');
		await Promise.resolve();
		await Promise.resolve();

		expect(aborted).toEqual(['first']);
		run.dispose();
	});

	it('exposes idempotent disposal that aborts active work', async () => {
		let observedSignal: AbortSignal | undefined;
		const run = useConcurrency(
			(_signal: AbortSignal) => {
				observedSignal = _signal;
				return new Promise<void>(() => {});
			},
			{ strategy: 'switch', cancellable: true }
		);

		run();
		await Promise.resolve();
		run.dispose();
		run.dispose();

		expect(observedSignal?.aborted).toBe(true);
		expect(run.disposed).toBe(true);
		run();
		expect(run.disposed).toBe(true);
	});

	it('clears pending debounce work during disposal', async () => {
		vi.useFakeTimers();
		const action = vi.fn();
		const run = useConcurrency(action, { debounceMs: 50 });

		run();
		run.dispose();
		await vi.advanceTimersByTimeAsync(50);

		expect(action).not.toHaveBeenCalled();
	});

	it('drops queued concat work and aborts the active item', async () => {
		let resolveFirst: (() => void) | undefined;
		const started: number[] = [];
		const signals: AbortSignal[] = [];
		const run = useConcurrency(
			(id: number, signal: AbortSignal) => {
				started.push(id);
				signals.push(signal);
				if (id === 1) {
					return new Promise<void>((resolve) => {
						resolveFirst = resolve;
					});
				}
				return Promise.resolve();
			},
			{ strategy: 'concat', cancellable: true }
		);

		run(1);
		run(2);
		run(3);
		await Promise.resolve();
		run.dispose();
		resolveFirst?.();
		await Promise.resolve();
		await Promise.resolve();

		expect(started).toEqual([1]);
		expect(signals[0]?.aborted).toBe(true);
	});

	it('reports exhaust failures without leaving a rejected control promise', async () => {
		const onError = vi.fn();
		const run = useConcurrency(
			() => Promise.reject(new Error('exhaust failed')),
			{ strategy: 'exhaust', onError }
		);

		run();
		await Promise.resolve();
		await Promise.resolve();

		expect(onError).toHaveBeenCalledOnce();
		expect(onError.mock.calls[0]?.[0]).toMatchObject({
			message: 'exhaust failed',
		});
		run.dispose();
	});

	it('does not append internal context to legacy action arguments', async () => {
		const received: unknown[][] = [];
		const run = useConcurrency((...args: unknown[]) => {
			received.push(args);
		});

		run('value');
		await Promise.resolve();

		expect(received).toEqual([['value']]);
		const compatibilityAction = run as unknown as { destroy: () => void };
		compatibilityAction.destroy();
		expect(run.disposed).toBe(true);
	});
});
