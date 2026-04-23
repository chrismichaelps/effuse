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

import { CancellationError } from '../errors.js';

export interface CancellationToken {
	readonly isCancelled: boolean;
	cancel: () => void;
	throwIfCancelled: () => void;
	onCancel: (callback: () => void) => () => void;
}

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
				throw new CancellationError('Operation was cancelled');
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

export interface CancellationScope {
	readonly token: CancellationToken;
	createChild: () => CancellationToken;
	dispose: () => void;
}

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

export const runWithAbortSignal = <A>(
	promise: Promise<A>,
	signal: AbortSignal
): Promise<A> => {
	if (signal.aborted) {
		return Promise.reject(
			new CancellationError('Operation was cancelled')
		);
	}

	return new Promise((resolve, reject) => {
		const onAbort = () => {
			reject(new CancellationError('Operation was cancelled'));
		};

		signal.addEventListener('abort', onAbort, { once: true });

		promise
			.then((result) => {
				signal.removeEventListener('abort', onAbort);
				resolve(result);
			})
			.catch((error: unknown) => {
				signal.removeEventListener('abort', onAbort);
				reject(
					error instanceof Error
						? error
						: new Error(String(error))
				);
			});
	});
};
