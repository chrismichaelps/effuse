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

import { Effect, Schedule, pipe } from 'effect';
import { signal } from '../reactivity/index.js';
import type { Signal } from '../types/index.js';
import {
	type ResourceState,
	type ResourceOptions,
	createPendingState,
	createSuccessState,
	createErrorState,
} from './schema.js';
import { createSuspendToken, type SuspendToken } from './token.js';
import { suspenseApi } from './service.js';
import {
	RESOURCE_ID_PREFIX,
	DEFAULT_RETRY_TIMES,
	DEFAULT_RETRY_DELAY_MS,
	ResourceErrorMessages,
} from './config.js';
import { isEffect, generateResourceId } from './utils.js';

export interface Resource<T> {
	readonly value: T;
	readonly state: Signal<ResourceState<T>>;
	readonly loading: boolean;
	readonly error: unknown | undefined;
	readonly refetch: () => void;
	readonly mutate: (data: T | ((prev: T | undefined) => T)) => void;
}

type Fetcher<T> = () => Effect.Effect<T, Error> | Promise<T>;

export const createResource = <T>(
	fetcher: Fetcher<T>,
	options?: ResourceOptions
): Resource<T> => {
	const resourceId = generateResourceId(RESOURCE_ID_PREFIX);
	const state = signal<ResourceState<T>>(
		options?.initialValue !== undefined
			? createSuccessState(options.initialValue as T)
			: createPendingState<T>()
	);

	let currentPromise: Promise<void> | null = null;
	let abortController: AbortController | null = null;

	const buildFetchEffect = (): Effect.Effect<T, Error> => {
		const result = fetcher();

		let baseEffect: Effect.Effect<T, Error>;
		if (isEffect(result)) {
			baseEffect = result;
		} else {
			baseEffect = Effect.promise(() => result as Promise<T>);
		}

		if (options?.timeout) {
			baseEffect = pipe(
				baseEffect,
				Effect.timeout(options.timeout)
			) as Effect.Effect<T, Error>;
		}

		if (options?.retry) {
			const retryConfig = options.retry;
			const delayMs = retryConfig.delay ?? DEFAULT_RETRY_DELAY_MS;
			const times = retryConfig.times ?? DEFAULT_RETRY_TIMES;

			baseEffect = pipe(
				baseEffect,
				Effect.retry({
					times,
					schedule: retryConfig.exponential
						? Schedule.exponential(delayMs)
						: Schedule.fixed(delayMs),
				})
			);
		}

		return baseEffect;
	};

	const doFetch = (): void => {
		if (abortController) {
			abortController.abort();
		}
		abortController = new AbortController();

		const needsEffectFeatures = options?.timeout || options?.retry;

		let fetchPromise: Promise<T>;

		if (needsEffectFeatures) {
			const fetchEffect = buildFetchEffect();
			fetchPromise = Effect.runPromise(fetchEffect);
		} else {
			const fetcherResult = fetcher();
			fetchPromise = isEffect(fetcherResult)
				? Effect.runPromise(fetcherResult as Effect.Effect<T, Error>)
				: (fetcherResult as Promise<T>);
		}

		const resolvePromise = fetchPromise
			.then((data: T) => {
				state.value = createSuccessState(data);
				currentPromise = null;
				const boundary = suspenseApi.getCurrentBoundary();
				if (boundary) {
					boundary.unregisterPending(resourceId);
				}
			})
			.catch((error: unknown) => {
				console.error(`[Resource ${resourceId}] Fetch error:`, error);
				state.value = createErrorState<T>(error);
				currentPromise = null;
				const boundary = suspenseApi.getCurrentBoundary();
				if (boundary) {
					boundary.unregisterPending(resourceId);
				}
			});

		currentPromise = resolvePromise;

		const boundary = suspenseApi.getCurrentBoundary();
		if (boundary) {
			boundary.registerPending(resourceId, resolvePromise);
		}

		state.value = createPendingState<T>();
	};

	if (options?.initialValue === undefined) {
		doFetch();
	}

	const resource: Resource<T> = {
		get value(): T {
			const currentState = state.value;

			if (currentState.status === 'pending') {
				if (!currentPromise) {
					throw new Error(ResourceErrorMessages.PENDING_NO_PROMISE);
				}
				const token: SuspendToken = createSuspendToken(
					currentPromise,
					resourceId
				);
				throw token;
			}

			if (currentState.status === 'error') {
				throw currentState.error;
			}

			return currentState.data as T;
		},

		state,

		get loading(): boolean {
			return state.value.status === 'pending';
		},

		get error(): unknown | undefined {
			return state.value.error;
		},

		refetch: () => {
			doFetch();
		},

		mutate: (dataOrFn: T | ((prev: T | undefined) => T)) => {
			const currentData = state.value.data;
			const newData =
				typeof dataOrFn === 'function'
					? (dataOrFn as (prev: T | undefined) => T)(currentData)
					: dataOrFn;
			state.value = createSuccessState(newData);
		},
	};

	return resource;
};
