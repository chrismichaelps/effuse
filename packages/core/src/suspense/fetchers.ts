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

import { Effect, pipe, Schedule } from 'effect';
import type { ResourceOptions } from './schema.js';
import {
	DEFAULT_RETRY_TIMES,
	DEFAULT_RETRY_DELAY_MS,
	DEFAULT_EXPONENTIAL_RETRY,
} from './config.js';
import { isEffect } from './utils.js';

export type EffectFetcher<T, E = Error> = () => Effect.Effect<T, E>;
export type PromiseFetcher<T> = () => Promise<T>;
export type Fetcher<T> = EffectFetcher<T> | PromiseFetcher<T>;

export const isEffectFetcher = <T>(
	fetcher: Fetcher<T>
): fetcher is EffectFetcher<T> => {
	const result = fetcher();
	return isEffect(result);
};

export const toEffect = <T>(fetcher: Fetcher<T>): Effect.Effect<T, Error> => {
	const result = fetcher();
	if (isEffect(result)) {
		return result;
	}
	return Effect.promise(() => result);
};

export const withTimeout = <T>(
	effect: Effect.Effect<T, Error>,
	timeoutMs: number
): Effect.Effect<T, Error> =>
	pipe(effect, Effect.timeout(timeoutMs)) as Effect.Effect<T, Error>;

export const withRetry = <T>(
	effect: Effect.Effect<T, Error>,
	times: number,
	delayMs: number,
	exponential = DEFAULT_EXPONENTIAL_RETRY
): Effect.Effect<T, Error> =>
	pipe(
		effect,
		Effect.retry({
			times,
			schedule: exponential
				? Schedule.exponential(delayMs)
				: Schedule.fixed(delayMs),
		})
	);

export const applyResourceOptions = <T>(
	fetcher: Fetcher<T>,
	options?: ResourceOptions
): Effect.Effect<T, Error> => {
	let effect = toEffect(fetcher);

	if (options?.timeout) {
		effect = withTimeout(effect, options.timeout);
	}

	if (options?.retry) {
		const {
			times = DEFAULT_RETRY_TIMES,
			delay = DEFAULT_RETRY_DELAY_MS,
			exponential = DEFAULT_EXPONENTIAL_RETRY,
		} = options.retry;
		effect = withRetry(effect, times, delay, exponential);
	}

	return effect;
};

export const fetchParallel = <A, E>(
	effects: Effect.Effect<A, E>[]
): Effect.Effect<A[], E> => Effect.all(effects, { concurrency: 'unbounded' });

export const fetchSequential = <A, E>(
	effects: Effect.Effect<A, E>[]
): Effect.Effect<A[], E> => Effect.all(effects, { concurrency: 1 });

export const fetchRace = <A, E>(
	effects: Effect.Effect<A, E>[]
): Effect.Effect<A, E> => Effect.raceAll(effects);

export const fetchAllSettled = <A, E>(
	effects: Effect.Effect<A, E>[]
): Effect.Effect<
	Array<{ status: 'success'; value: A } | { status: 'error'; error: E }>,
	never
> =>
	Effect.all(
		effects.map((eff) =>
			pipe(
				eff,
				Effect.map((value): { status: 'success'; value: A } => ({
					status: 'success',
					value,
				})),
				Effect.catchAll((error) =>
					Effect.succeed({
						status: 'error',
						error,
					} as { status: 'error'; error: E })
				)
			)
		)
	);
