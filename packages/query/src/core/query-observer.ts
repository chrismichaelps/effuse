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
	QueryState,
	QueryObserverOptions,
	QueryObserverResult,
	QueryObserverListener,
} from './types.js';
import { Query } from './query.js';
import { deepEqual } from '../utils/index.js';

const getPlaceholderData = <T>(
	placeholderData: T | ((previousData: T | undefined) => T) | undefined,
	previousData: T | undefined
): T | undefined => {
	if (placeholderData === undefined) return undefined;
	if (typeof placeholderData === 'function') {
		return (placeholderData as (previousData: T | undefined) => T)(previousData);
	}
	return placeholderData;
};

const createResult = <TData, TError, TSelected>(
	query: Query<TData, TError>,
	options: QueryObserverOptions<TData, TError, TSelected>,
	previousResult?: QueryObserverResult<TSelected, TError>
): QueryObserverResult<TSelected, TError> => {
	const { currentState } = query;
	const { select, initialData } = options;

	let data: TSelected | undefined;
	let isPlaceholderData = false;

	if (currentState.data !== undefined) {
		if (select) {
			// Memoized select: only re-run if source data changed
			if (
				previousResult &&
				query.currentState.data === (query as unknown as { _lastData: unknown })._lastData
			) {
				data = previousResult.data;
			} else {
				data = select(currentState.data);
			}
		} else {
			data = currentState.data as unknown as TSelected;
		}
	} else if (initialData !== undefined) {
		const initial =
			typeof initialData === 'function'
				? (initialData as () => TData)()
				: initialData;
		data = select ? select(initial) : (initial as unknown as TSelected);
	} else {
		const placeholder = getPlaceholderData(
			options.placeholderData,
			previousResult?.data
		);
		if (placeholder !== undefined) {
			data = placeholder;
			isPlaceholderData = true;
		}
	}

	// When initialData is used and query hasn't fetched yet, override status to success
	const hasInitialData =
		initialData !== undefined && currentState.fetchCount === 0 && currentState.data === undefined;
	const status = hasInitialData ? 'success' : currentState.status;

	const isPending = status === 'pending';
	const isLoading = isPending && currentState.fetchStatus === 'fetching';
	const isSuccess = status === 'success';
	const isError = status === 'error';
	const isFetching = currentState.fetchStatus === 'fetching';
	const isRefetching = isFetching && data !== undefined;

	// Store last data reference for select memoization
	(query as unknown as { _lastData: unknown })._lastData = currentState.data;

	return {
		data,
		dataUpdatedAt: hasInitialData ? Date.now() : currentState.dataUpdatedAt,
		error: currentState.error,
		errorUpdatedAt: currentState.errorUpdatedAt,
		status,
		fetchStatus: currentState.fetchStatus,
		isPending,
		isLoading,
		isSuccess,
		isError,
		isFetching,
		isRefetching,
		isStale: query.isStale,
		isPlaceholderData,
		fetchCount: currentState.fetchCount,
	};
};

const shouldNotify = <TData, TError>(
	prev: QueryObserverResult<TData, TError>,
	next: QueryObserverResult<TData, TError>,
	notifyOnChangeProps?: Array<keyof QueryObserverResult<TData, TError>>
): boolean => {
	if (!notifyOnChangeProps) {
		// Default: notify on any change
		return !deepEqual(prev, next);
	}

	for (const prop of notifyOnChangeProps) {
		if (!deepEqual(prev[prop], next[prop])) {
			return true;
		}
	}
	return false;
};

/**
 * Bridges a Query and a UI subscriber.
 * Computes its own result from the query state and observer options,
 * with memoized select and granular change tracking.
 */
export class QueryObserver<TData = unknown, TError = Error, TSelected = TData> {
	private options: QueryObserverOptions<TData, TError, TSelected>;

	private query: Query<TData, TError>;
	private currentResult: QueryObserverResult<TSelected, TError>;
	private listener: QueryObserverListener<TSelected, TError> | null = null;
	private unsubscribeQuery: (() => void) | null = null;
	private previousSelectError: Error | null = null;

	constructor(
		query: Query<TData, TError>,
		options: QueryObserverOptions<TData, TError, TSelected>
	) {
		this.query = query;
		this.options = options;
		try {
			this.currentResult = createResult(query, options);
		} catch (error) {
			const err = error instanceof Error ? error : new Error(String(error));
			this.currentResult = {
				data: undefined,
				error: err as TError,
				status: 'error',
				fetchStatus: 'idle',
				dataUpdatedAt: 0,
				errorUpdatedAt: Date.now(),
				isPending: false,
				isLoading: false,
				isSuccess: false,
				isError: true,
				isFetching: false,
				isRefetching: false,
				isStale: query.isStale,
				isPlaceholderData: false,
				fetchCount: 0,
			};
		}
		this.subscribeToQuery();
	}

	getCurrentResult(): QueryObserverResult<TSelected, TError> {
		return this.currentResult;
	}

	/**
	 * Subscribe a listener to result changes.
	 * Returns an unsubscribe function.
	 */
	subscribe(
		listener: QueryObserverListener<TSelected, TError>
	): () => void {
		this.listener = listener;
		return () => {
			this.listener = null;
		};
	}

	/**
	 * Trigger a refetch of the underlying query.
	 */
	async refetch(): Promise<TData> {
		return this.query.fetch();
	}

	/**
	 * Update the observer options and recompute the result.
	 */
	setOptions(
		options: Partial<QueryObserverOptions<TData, TError, TSelected>>
	): void {
		const selectChanged = 'select' in options;
		this.options = { ...this.options, ...options };
		if (selectChanged) {
			// Force select re-evaluation by clearing memoization
			(this.query as unknown as { _lastData?: unknown })._lastData = undefined;
		}
		this.updateResult();
	}

	/**
	 * Called by the Query when its state changes.
	 */
	onQueryUpdate(): void {
		this.updateResult();
	}

	/**
	 * Clean up the observer and unsubscribe from the query.
	 */
	destroy(): void {
		if (this.unsubscribeQuery) {
			this.unsubscribeQuery();
			this.unsubscribeQuery = null;
		}
		this.listener = null;
	}

	private subscribeToQuery(): void {
		this.unsubscribeQuery = this.query.addObserver(this);
	}

	private updateResult(): void {
		const prevResult = this.currentResult;

		try {
			this.currentResult = createResult(this.query, this.options, prevResult);
			this.previousSelectError = null;
		} catch (error) {
			// If select throws, we treat it as an error state
			const err =
				error instanceof Error ? error : new Error(String(error));
			this.previousSelectError = err;
			this.currentResult = {
				...this.currentResult,
				data: undefined,
				error: err as TError,
				status: 'error',
				isPending: false,
				isLoading: false,
				isSuccess: false,
				isError: true,
				isFetching: false,
				isRefetching: false,
			};
		}

		if (
			shouldNotify(
				prevResult,
				this.currentResult,
				this.options.notifyOnChangeProps as Array<
					keyof QueryObserverResult<TSelected, TError>
				>
			)
		) {
			this.notify();
		}
	}

	private notify(): void {
		if (this.listener) {
			this.listener(this.currentResult);
		}
	}
}
