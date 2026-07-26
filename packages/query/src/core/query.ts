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

import type {
	QueryKey,
	QueryState,
	QueryAction,
	QueryConfig,
	QueryFunction,
	QueryObserver,
	QuerySnapshot,
} from './types.js';
import { deepEqual } from '../utils/index.js';
import type { QueryCache } from './query-cache.js';

let queryIdCounter = 0;

const hashKey = (key: QueryKey): string => JSON.stringify(key);

const createInitialState = <TData, TError = Error>(): QueryState<TData, TError> => ({
	data: undefined,
	dataUpdatedAt: 0,
	error: null,
	errorUpdatedAt: 0,
	status: 'pending',
	fetchStatus: 'idle',
	fetchCount: 0,
	isInvalidated: false,
});

const queryReducer = <TData, TError = Error>(
	state: QueryState<TData, TError>,
	action: QueryAction<TData, TError>
): QueryState<TData, TError> => {
	switch (action.type) {
		case 'fetch':
			return {
				...state,
				fetchStatus: 'fetching',
				status: state.data === undefined ? 'pending' : state.status,
			};

		case 'success': {
			const nextData = state.data !== undefined && deepEqual(state.data, action.data)
				? state.data
				: action.data;
			return {
				...state,
				data: nextData,
				dataUpdatedAt: Date.now(),
				error: null,
				errorUpdatedAt: 0,
				status: 'success',
				fetchStatus: 'idle',
				fetchCount: state.fetchCount + 1,
				isInvalidated: false,
			};
		}

		case 'error':
			return {
				...state,
				error: action.error,
				errorUpdatedAt: Date.now(),
				status: 'error',
				fetchStatus: 'idle',
				fetchCount: state.fetchCount + 1,
			};

		case 'invalidate':
			return {
				...state,
				isInvalidated: true,
			};

		case 'cancel':
			return {
				...state,
				fetchStatus: 'idle',
			};

		case 'setState':
			return { ...state, ...action.state };

		default:
			return state;
	}
};

/**
 * Represents a single query in the cache.
 * Manages its own state machine, fetch lifecycle, and observer notifications.
 */
export class Query<TData = unknown, TError = Error> {
	readonly queryHash: string;
	readonly queryKey: QueryKey;
	options: QueryConfig<TData>;

	private state: QueryState<TData, TError>;
	private observers: Set<QueryObserver> = new Set();
	private abortController: AbortController | null = null;
	private gcTimeout: ReturnType<typeof setTimeout> | null = null;
	private promise: Promise<unknown> | null = null;
	private queryId: number;
	private fetchId = 0;
	private cancelledFetchId = 0;
	private cache: QueryCache | null = null;

	constructor(options: QueryConfig<TData>, cache?: QueryCache) {
		this.queryKey = options.queryKey;
		this.queryHash = hashKey(options.queryKey);
		this.options = options;
		this.state = createInitialState<TData, TError>();
		this.queryId = ++queryIdCounter;
		this.cache = cache ?? null;
	}

	get id(): number {
		return this.queryId;
	}

	get currentState(): QueryState<TData, TError> {
		return this.state;
	}

	get observerCount(): number {
		return this.observers.size;
	}

	get isActive(): boolean {
		return this.observers.size > 0;
	}

	get isFetching(): boolean {
		return this.state.fetchStatus === 'fetching';
	}

	get isStale(): boolean {
		const { staleTime = 0 } = this.options;
		return (
			this.state.isInvalidated ||
			Date.now() - this.state.dataUpdatedAt > staleTime
		);
	}

	snapshot(): QuerySnapshot<TData, TError> {
		return {
			queryKey: this.queryKey,
			state: this.state,
			observerCount: this.observerCount,
			isActive: this.isActive,
		};
	}

	/**
	 * Subscribe an observer to this query.
	 * Returns an unsubscribe function.
	 */
	addObserver(observer: QueryObserver): () => void {
		this.observers.add(observer);
		this.cancelGc();
		return () => {
			this.observers.delete(observer);
			if (!this.isActive) {
				this.scheduleGc();
			}
		};
	}

	/**
	 * Dispatch an action to the state machine and notify observers.
	 */
	dispatch(action: QueryAction<TData, TError>): void {
		const prevState = this.state;
		this.state = queryReducer(prevState, action);

		if (prevState !== this.state) {
			this.notifyObservers();
			this.cache?.notify();
		}
	}

	/**
	 * Set arbitrary state and notify.
	 */
	setState(state: Partial<QueryState<TData, TError>>): void {
		this.dispatch({ type: 'setState', state });
	}

	/**
	 * Mark the query as invalidated (stale).
	 */
	invalidate(): void {
		this.dispatch({ type: 'invalidate' });
	}

	/**
	 * Cancel the current in-flight fetch.
	 */
	cancel(): void {
		this.cancelledFetchId = this.fetchId;
		if (this.abortController) {
			this.abortController.abort();
			this.abortController = null;
		}
		if (this.isFetching) {
			this.dispatch({ type: 'cancel' });
		}
	}

	/**
	 * Execute the query function.
	 * Deduplicates concurrent fetches.
	 */
	async fetch(): Promise<TData> {
		if (this.promise) {
			return this.promise as Promise<TData>;
		}

		this.cancel();
		const currentFetchId = ++this.fetchId;
		this.abortController = new AbortController();
		this.dispatch({ type: 'fetch' });

		const { queryFn, timeout } = this.options;

		this.promise = this.runWithRetry(
			queryFn,
			this.abortController.signal,
			timeout,
			currentFetchId
		);

		try {
			const data = await this.promise;
			if (currentFetchId <= this.cancelledFetchId) {
				// Fetch was cancelled, ignore result
				return data as TData;
			}
			this.dispatch({ type: 'success', data: data as TData });
			return data as TData;
		} catch (error) {
			if (currentFetchId <= this.cancelledFetchId) {
				// Fetch was cancelled, ignore error
				throw error;
			}
			const err = error instanceof Error ? error : new Error(String(error));
			this.dispatch({ type: 'error', error: err as TError });
			throw err;
		} finally {
			this.promise = null;
			this.abortController = null;
		}
	}

	private async runWithRetry(
		queryFn: QueryFunction<TData>,
		signal: AbortSignal,
		timeout: number | undefined,
		fetchId: number
	): Promise<TData> {
		const { retry = 3 } = this.options;
		const maxRetries =
			typeof retry === 'number'
				? retry
				: retry === true
					? 3
					: retry === false
						? 0
						: retry.times ?? 3;

		let lastError: Error | undefined;

		for (let attempt = 0; attempt <= maxRetries; attempt++) {
			if (fetchId <= this.cancelledFetchId) {
				throw new Error('Query was cancelled');
			}

			try {
				if (signal.aborted) {
					throw new Error('Query was cancelled');
				}

				const promise = queryFn({ signal });

				if (timeout && timeout > 0) {
					const timeoutPromise = new Promise<never>((_, reject) => {
						const timer = setTimeout(() => {
							reject(new Error(`Query timed out after ${timeout}ms`));
						}, timeout);
						signal.addEventListener('abort', () => {
							clearTimeout(timer);
							reject(new Error('Query was cancelled'));
						});
					});

					return await Promise.race([promise, timeoutPromise]);
				}

				return await promise;
			} catch (error) {
				if (signal.aborted || fetchId <= this.cancelledFetchId) {
					throw new Error('Query was cancelled');
				}

				lastError = error instanceof Error ? error : new Error(String(error));

				if (attempt < maxRetries) {
					const delay = this.calculateRetryDelay(attempt);
					await sleep(delay);
				}
			}
		}

		throw lastError;
	}

	private calculateRetryDelay(attempt: number): number {
		const { retryDelay = 1000 } = this.options;
		if (typeof retryDelay === 'number') {
			return retryDelay * Math.pow(2, attempt);
		}
		return 1000 * Math.pow(2, attempt);
	}

	private notifyObservers(): void {
		for (const observer of this.observers) {
			observer.onQueryUpdate();
		}
	}

	private scheduleGc(): void {
		const { gcTime = 5 * 60 * 1000 } = this.options;
		if (gcTime === Infinity || gcTime === 0) return;

		this.gcTimeout = setTimeout(() => {
			this.destroy();
		}, gcTime);
	}

	private cancelGc(): void {
		if (this.gcTimeout) {
			clearTimeout(this.gcTimeout);
			this.gcTimeout = null;
		}
	}

	destroy(): void {
		this.cancel();
		this.cancelGc();
		this.observers.clear();
	}
}

const sleep = (ms: number): Promise<void> =>
	new Promise((resolve) => setTimeout(resolve, ms));
