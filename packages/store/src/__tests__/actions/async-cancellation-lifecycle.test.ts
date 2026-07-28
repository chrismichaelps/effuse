import { describe, expect, it, vi } from 'vitest';
import {
	createCancellableAction,
	withAbortSignal,
} from '../../actions/async.js';
import { CancellationError } from '../../errors.js';

describe('async action cooperative cancellation', () => {
	it('does not invoke work for a pre-aborted signal', async () => {
		const action = vi.fn(() => 'started');
		const wrapped = withAbortSignal(action);
		const controller = new AbortController();
		controller.abort();

		await expect(wrapped(controller.signal)).rejects.toBeInstanceOf(
			CancellationError
		);
		expect(action).not.toHaveBeenCalled();
	});

	it('injects the external signal into cooperative work', async () => {
		let observedAbort = false;
		const wrapped = withAbortSignal(
			(label: string, signal: AbortSignal) =>
				new Promise<void>((_resolve, reject) => {
					signal.addEventListener(
						'abort',
						() => {
							observedAbort = true;
							reject(new DOMException('Aborted', 'AbortError'));
						},
						{ once: true }
					);
					expect(label).toBe('request');
				}),
			{ cancellable: true }
		);
		const controller = new AbortController();
		const pending = wrapped(controller.signal, 'request');
		controller.abort();

		await expect(pending).rejects.toBeInstanceOf(CancellationError);
		expect(observedAbort).toBe(true);
	});

	it('preserves exact legacy withAbortSignal arguments', async () => {
		const received: unknown[][] = [];
		const wrapped = withAbortSignal((...args: unknown[]) => {
			received.push(args);
			return 'ok';
		});

		await expect(wrapped(new AbortController().signal, 'value')).resolves.toBe(
			'ok'
		);
		expect(received).toEqual([['value']]);
	});

	it('propagates cancel to a cooperative cancellable action', async () => {
		let observedSignal: AbortSignal | undefined;
		const action = createCancellableAction(
			(signal: AbortSignal) => {
				observedSignal = signal;
				return new Promise<void>(() => {});
			},
			{ cancellable: true }
		);
		const pending = action();

		action.cancel();
		action.cancel();

		await expect(pending).rejects.toBeInstanceOf(CancellationError);
		expect(observedSignal?.aborted).toBe(true);
		expect(action.pending).toBe(false);
	});

	it('keeps newer pending state isolated from late older completion', async () => {
		const resolvers = new Map<string, (value: string) => void>();
		const action = createCancellableAction(
			(id: string) =>
				new Promise<string>((resolve) => {
					resolvers.set(id, resolve);
				})
		);

		const first = action('first');
		const second = action('second');
		await expect(first).rejects.toBeInstanceOf(CancellationError);
		expect(action.pending).toBe(true);

		resolvers.get('first')?.('late-first');
		await Promise.resolve();
		expect(action.pending).toBe(true);

		resolvers.get('second')?.('second-result');
		await expect(second).resolves.toBe('second-result');
		expect(action.pending).toBe(false);
	});

	it.each(['resolve', 'reject', 'abort'] as const)(
		'removes the abort listener after %s settlement',
		async (outcome) => {
			const controller = new AbortController();
			const remove = vi.spyOn(controller.signal, 'removeEventListener');
			let resolveOperation: ((value: string) => void) | undefined;
			let rejectOperation: ((error: Error) => void) | undefined;
			const wrapped = withAbortSignal(
				() =>
					new Promise<string>((resolve, reject) => {
						resolveOperation = resolve;
						rejectOperation = reject;
					})
			);
			const pending = wrapped(controller.signal);

			if (outcome === 'resolve') resolveOperation?.('ok');
			if (outcome === 'reject') rejectOperation?.(new Error('failed'));
			if (outcome === 'abort') controller.abort();

			await pending.catch(() => undefined);
			expect(remove).toHaveBeenCalledWith('abort', expect.any(Function));
		}
	);
});
