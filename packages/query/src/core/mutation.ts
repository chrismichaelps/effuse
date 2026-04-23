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

import type { RetryConfig } from '../execution/index.js';

export type MutationStatus = 'idle' | 'pending' | 'success' | 'error';

export interface MutationState<TData = unknown, TError extends Error = Error, TVariables = unknown> {
	readonly data: TData | undefined;
	readonly error: TError | null;
	readonly variables: TVariables | undefined;
	readonly status: MutationStatus;
	readonly submittedAt: number;
	readonly failureCount: number;
	readonly failureReason: TError | null;
}

export type MutationAction<TData = unknown, TError extends Error = Error, TVariables = unknown> =
	| { readonly type: 'run'; readonly variables: TVariables }
	| { readonly type: 'success'; readonly data: TData }
	| { readonly type: 'error'; readonly error: TError }
	| { readonly type: 'reset' };

export interface MutationConfig<TData = unknown, TError extends Error = Error, TVariables = unknown, TContext = unknown> {
	readonly mutationFn: (variables: TVariables) => Promise<TData>;
	readonly mutationKey?: readonly unknown[];
	readonly retry?: RetryConfig | number | boolean;
	readonly retryDelay?: number;
	readonly timeout?: number;
	readonly onMutate?: (variables: TVariables) => TContext | Promise<TContext>;
	readonly onSuccess?: (data: TData, variables: TVariables, context: TContext | undefined) => void;
	readonly onError?: (error: TError, variables: TVariables, context: TContext | undefined) => void;
	readonly onSettled?: (data: TData | undefined, error: TError | null, variables: TVariables, context: TContext | undefined) => void;
}

export interface MutationObserver {
	readonly onMutationUpdate: () => void;
}

let mutationIdCounter = 0;

const createInitialState = <TData, TError extends Error, TVariables>(): MutationState<TData, TError, TVariables> => ({
	data: undefined,
	error: null,
	variables: undefined,
	status: 'idle',
	submittedAt: 0,
	failureCount: 0,
	failureReason: null,
});

const mutationReducer = <TData, TError extends Error, TVariables>(
	state: MutationState<TData, TError, TVariables>,
	action: MutationAction<TData, TError, TVariables>
): MutationState<TData, TError, TVariables> => {
	switch (action.type) {
		case 'run':
			return {
				...state,
				variables: action.variables,
				status: 'pending',
				submittedAt: Date.now(),
			};
		case 'success':
			return {
				...state,
				data: action.data,
				error: null,
				status: 'success',
				failureCount: 0,
				failureReason: null,
			};
		case 'error':
			return {
				...state,
				error: action.error,
				status: 'error',
				failureCount: state.failureCount + 1,
				failureReason: action.error,
			};
		case 'reset':
			return createInitialState<TData, TError, TVariables>();
		default:
			return state;
	}
};

const sleep = (ms: number): Promise<void> =>
	new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Represents a single mutation.
 * Manages its own state machine and lifecycle.
 */
export class Mutation<TData = unknown, TError extends Error = Error, TVariables = unknown, TContext = unknown> {
	readonly mutationId: number;
	readonly options: MutationConfig<TData, TError, TVariables, TContext>;

	private state: MutationState<TData, TError, TVariables>;
	private observers: Set<MutationObserver> = new Set();
	private abortController: AbortController | null = null;
	private promise: Promise<TData> | null = null;

	constructor(options: MutationConfig<TData, TError, TVariables, TContext>) {
		this.options = options;
		this.state = createInitialState<TData, TError, TVariables>();
		this.mutationId = ++mutationIdCounter;
	}

	get currentState(): MutationState<TData, TError, TVariables> {
		return this.state;
	}

	get isPending(): boolean {
		return this.state.status === 'pending';
	}

	addObserver(observer: MutationObserver): () => void {
		this.observers.add(observer);
		return () => {
			this.observers.delete(observer);
		};
	}

	dispatch(action: MutationAction<TData, TError, TVariables>): void {
		const prevState = this.state;
		this.state = mutationReducer(prevState, action);
		if (prevState !== this.state) {
			this.notifyObservers();
		}
	}

	reset(): void {
		if (this.abortController) {
			this.abortController.abort();
			this.abortController = null;
		}
		this.promise = null;
		this.dispatch({ type: 'reset' });
	}

	async execute(variables: TVariables): Promise<TData> {
		if (this.promise) {
			return this.promise;
		}

		this.reset();
		this.dispatch({ type: 'run', variables });

		const { mutationFn, timeout, onMutate, onSuccess, onError, onSettled } = this.options;

		let context: TContext | undefined;
		if (onMutate) {
			try {
				const result = onMutate(variables);
				context = result instanceof Promise ? await result : result;
		} catch (mutateError) {
			const error = (mutateError instanceof Error ? mutateError : new Error(String(mutateError))) as TError;
			this.dispatch({ type: 'error', error });
			if (onError) onError(error, variables, context);
			if (onSettled) onSettled(undefined, error, variables, context);
			throw error;
		}
		}

		this.promise = this.runWithRetry(mutationFn, variables, timeout, context);

		try {
			const data = await this.promise;
			this.dispatch({ type: 'success', data });
			if (onSuccess) onSuccess(data, variables, context);
			if (onSettled) onSettled(data, null, variables, context);
			return data;
		} catch (error) {
			const err = error instanceof Error ? error : new Error(String(error));
			this.dispatch({ type: 'error', error: err as TError });
			if (onError) onError(err as TError, variables, context);
			if (onSettled) onSettled(undefined, err as TError, variables, context);
			throw err;
		} finally {
			this.promise = null;
			this.abortController = null;
		}
	}

	private async runWithRetry(
		mutationFn: (variables: TVariables) => Promise<TData>,
		variables: TVariables,
		timeout: number | undefined,
		_context: TContext | undefined
	): Promise<TData> {
		const { retry = 0, retryDelay = 1000 } = this.options;
		const maxRetries =
			typeof retry === 'number'
				? retry
				: retry === true
					? 3
					: retry === false
						? 0
						: retry.times ?? 0;

		let lastError: Error | undefined;
		this.abortController = new AbortController();
		const signal = this.abortController.signal;

		for (let attempt = 0; attempt <= maxRetries; attempt++) {
			if (signal.aborted) {
				throw new Error('Mutation was cancelled');
			}

			try {
				const promise = mutationFn(variables);

				if (timeout && timeout > 0) {
					const timeoutPromise = new Promise<never>((_, reject) => {
						const timer = setTimeout(() => {
							reject(new Error(`Mutation timed out after ${timeout}ms`));
						}, timeout);
						signal.addEventListener('abort', () => {
							clearTimeout(timer);
							reject(new Error('Mutation was cancelled'));
						});
					});

					return await Promise.race([promise, timeoutPromise]);
				}

				return await promise;
			} catch (error) {
				if (signal.aborted) {
					throw new Error('Mutation was cancelled');
				}

				lastError = error instanceof Error ? error : new Error(String(error));

				if (attempt < maxRetries) {
					const delay = typeof retryDelay === 'number' ? retryDelay * Math.pow(2, attempt) : 1000 * Math.pow(2, attempt);
					await sleep(delay);
				}
			}
		}

		throw lastError;
	}

	private notifyObservers(): void {
		for (const observer of this.observers) {
			observer.onMutationUpdate();
		}
	}
}
