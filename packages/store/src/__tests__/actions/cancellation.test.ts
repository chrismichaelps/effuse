import { describe, it, expect, vi } from 'vitest';
import {
	createCancellationToken,
	createCancellationScope,
	runWithAbortSignal,
} from '../../actions/cancellation.js';
import { CancellationError } from '../../errors.js';

describe('cancellation', () => {
	describe('createCancellationToken', () => {
		it('should start not cancelled', () => {
			const token = createCancellationToken();
			expect(token.isCancelled).toBe(false);
		});

		it('should become cancelled after cancel()', () => {
			const token = createCancellationToken();
			token.cancel();
			expect(token.isCancelled).toBe(true);
		});

		it('should throw if throwIfCancelled called after cancel', () => {
			const token = createCancellationToken();
			token.cancel();
			expect(() => { token.throwIfCancelled(); }).toThrow(CancellationError);
		});

		it('should call onCancel callbacks', () => {
			const token = createCancellationToken();
			const cb = vi.fn();
			token.onCancel(cb);
			token.cancel();
			expect(cb).toHaveBeenCalled();
		});

		it('should call onCancel immediately if already cancelled', () => {
			const token = createCancellationToken();
			token.cancel();
			const cb = vi.fn();
			token.onCancel(cb);
			expect(cb).toHaveBeenCalled();
		});

		it('should allow unsubscribing onCancel', () => {
			const token = createCancellationToken();
			const cb = vi.fn();
			const unsub = token.onCancel(cb);
			unsub();
			token.cancel();
			expect(cb).not.toHaveBeenCalled();
		});
	});

	describe('createCancellationScope', () => {
		it('should create child tokens', () => {
			const scope = createCancellationScope();
			const child = scope.createChild();
			expect(child.isCancelled).toBe(false);
		});

		it('should cancel children when parent is cancelled', () => {
			const scope = createCancellationScope();
			const child = scope.createChild();
			scope.token.cancel();
			expect(child.isCancelled).toBe(true);
		});

		it('should cancel all on dispose', () => {
			const scope = createCancellationScope();
			const child = scope.createChild();
			scope.dispose();
			expect(scope.token.isCancelled).toBe(true);
			expect(child.isCancelled).toBe(true);
		});
	});

	describe('runWithAbortSignal', () => {
		it('should fail immediately if signal already aborted', async () => {
			const controller = new AbortController();
			controller.abort();
			const promise = Promise.resolve('ok');
			await expect(
				runWithAbortSignal(promise, controller.signal)
			).rejects.toThrow(CancellationError);
		});

		it('should succeed if signal not aborted', async () => {
			const controller = new AbortController();
			const promise = Promise.resolve('ok');
			const result = await runWithAbortSignal(promise, controller.signal);
			expect(result).toBe('ok');
		});

		it('should fail if signal aborted during execution', async () => {
			const controller = new AbortController();
			const promise = new Promise<string>((r) => setTimeout(() => { r('ok'); }, 1000));
			const wrapped = runWithAbortSignal(promise, controller.signal);
			controller.abort();
			await expect(wrapped).rejects.toThrow(CancellationError);
		});
	});
});
