/**
 * MIT License
 *
 * Copyright (c) 2025 Chris M. Perez
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 */

import { Effect } from 'effect';
import { CancellationError } from '../errors.js';

// Cancellation tracking token
export interface CancellationToken {
	readonly isCancelled: boolean;
	cancel: () => void;
	throwIfCancelled: () => void;
	onCancel: (callback: () => void) => () => void;
}

// Build cancellation token
export const createCancellationToken = (): CancellationToken => {
	let cancelled = false;
	const callbacks = new Set<() => void>();

	return {
		get isCancelled() {
			return cancelled;
		},
		cancel: () => {
			if (!cancelled) {
				cancelled = true;
				for (const cb of callbacks) cb();
				callbacks.clear();
			}
		},
		throwIfCancelled: () => {
			if (cancelled)
				throw new CancellationError({ message: 'Operation was cancelled' });
		},
		onCancel: (callback: () => void) => {
			if (cancelled) {
				callback();
				return () => {};
			}
			callbacks.add(callback);
			return () => callbacks.delete(callback);
		},
	};
};

// Nested cancellation scope
export interface CancellationScope {
	readonly token: CancellationToken;
	createChild: () => CancellationToken;
	dispose: () => void;
}

// Build cancellation scope
export const createCancellationScope = (): CancellationScope => {
	const children = new Set<CancellationToken>();
	const token = createCancellationToken();

	return {
		token,
		createChild: () => {
			const child = createCancellationToken();
			children.add(child);
			token.onCancel(() => {
				child.cancel();
			});
			return child;
		},
		dispose: () => {
			token.cancel();
			for (const child of children) child.cancel();
			children.clear();
		},
	};
};

// Connect external abort signal
export const runWithAbortSignal = <A, E>(
	effect: Effect.Effect<A, E>,
	signal: AbortSignal
): Effect.Effect<A, E | CancellationError> => {
	if (signal.aborted) {
		return Effect.fail(
			new CancellationError({ message: 'Operation was cancelled' }) as
				| E
				| CancellationError
		);
	}

	return Effect.async<A, E | CancellationError>((resume) => {
		const onAbort = () => {
			resume(
				Effect.fail(
					new CancellationError({ message: 'Operation was cancelled' })
				)
			);
		};

		signal.addEventListener('abort', onAbort, { once: true });

		Effect.runPromise(effect)
			.then((result) => {
				signal.removeEventListener('abort', onAbort);
				resume(Effect.succeed(result));
			})
			.catch((error: unknown) => {
				signal.removeEventListener('abort', onAbort);
				resume(Effect.fail(error as E));
			});
	});
};
