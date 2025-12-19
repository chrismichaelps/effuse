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
import type { Store } from '../core/types.js';

export interface ActionResult<T> {
	data: T | null;
	error: Error | null;
	loading: boolean;
}

export interface AsyncAction<A extends unknown[], R> {
	(...args: A): Promise<R>;
	pending: boolean;
}

type ActionFn<A extends unknown[], R> = (...args: A) => Promise<R> | R;

export const createAsyncAction = <A extends unknown[], R>(
	fn: ActionFn<A, R>
): AsyncAction<A, R> => {
	let pending = false;

	const action = async (...args: A): Promise<R> => {
		pending = true;
		const result = await Effect.runPromise(
			Effect.tryPromise({
				try: async () => fn(...args),
				catch: (error) => error as Error,
			}).pipe(
				Effect.tapBoth({
					onSuccess: () =>
						Effect.sync(() => {
							pending = false;
						}),
					onFailure: () =>
						Effect.sync(() => {
							pending = false;
						}),
				})
			)
		);
		return result;
	};

	Object.defineProperty(action, 'pending', {
		get: () => pending,
		enumerable: true,
	});

	return action as AsyncAction<A, R>;
};

export const dispatch = <T>(
	store: Store<T>,
	actionName: keyof T,
	...args: unknown[]
): Promise<unknown> => {
	const storeRecord = store as unknown as Record<string, unknown>;
	const action = storeRecord[actionName as string];
	if (typeof action !== 'function') {
		return Promise.reject(
			new Error(`Action "${String(actionName)}" not found`)
		);
	}
	const actionFn = action as (...a: unknown[]) => unknown;
	return Effect.runPromise(
		Effect.tryPromise({
			try: () => Promise.resolve(actionFn(...args)),
			catch: (error) => error as Error,
		})
	);
};

export const dispatchSync = <T>(
	store: Store<T>,
	actionName: keyof T,
	...args: unknown[]
): unknown => {
	const storeRecord = store as unknown as Record<string, unknown>;
	const action = storeRecord[actionName as string];
	if (typeof action !== 'function') {
		throw new Error(`Action "${String(actionName)}" not found`);
	}
	const actionFn = action as (...a: unknown[]) => unknown;
	return actionFn(...args);
};
