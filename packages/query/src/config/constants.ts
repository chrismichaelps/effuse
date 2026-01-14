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

import { Config, Duration, Effect } from 'effect';

export const DEFAULT_STALE_TIME_MS = 0;
export const DEFAULT_CACHE_TIME_MS = 300000;
export const DEFAULT_GC_TIME_MS = 300000;

export const DEFAULT_RETRY_COUNT = 3;
export const DEFAULT_RETRY_DELAY_MS = 1000;
export const DEFAULT_RETRY_MAX_DELAY_MS = 30000;
export const DEFAULT_RETRY_BACKOFF_FACTOR = 2;

export const DEFAULT_TIMEOUT_MS = 30000;

export const DEFAULT_REFETCH_INTERVAL_MS = 0;
export const DEFAULT_REFETCH_ON_WINDOW_FOCUS = true;
export const DEFAULT_REFETCH_ON_RECONNECT = true;

export const DEFAULT_TIMEOUT = Duration.millis(DEFAULT_TIMEOUT_MS);
export const DEFAULT_RETRY_DELAY = Duration.millis(DEFAULT_RETRY_DELAY_MS);
export const DEFAULT_STALE_TIME = Duration.millis(DEFAULT_STALE_TIME_MS);
export const DEFAULT_CACHE_TIME = Duration.millis(DEFAULT_CACHE_TIME_MS);

export const QueryConfigOptions = {
	staleTime: Config.integer('EFFUSE_QUERY_STALE_TIME').pipe(
		Config.withDefault(DEFAULT_STALE_TIME_MS)
	),
	cacheTime: Config.integer('EFFUSE_QUERY_CACHE_TIME').pipe(
		Config.withDefault(DEFAULT_CACHE_TIME_MS)
	),
	retryCount: Config.integer('EFFUSE_QUERY_RETRY_COUNT').pipe(
		Config.withDefault(DEFAULT_RETRY_COUNT)
	),
	retryDelay: Config.integer('EFFUSE_QUERY_RETRY_DELAY').pipe(
		Config.withDefault(DEFAULT_RETRY_DELAY_MS)
	),
	timeout: Config.integer('EFFUSE_QUERY_TIMEOUT').pipe(
		Config.withDefault(DEFAULT_TIMEOUT_MS)
	),
	debug: Config.boolean('EFFUSE_QUERY_DEBUG').pipe(Config.withDefault(false)),
};

export interface QueryConfigValues {
	staleTime: number;
	cacheTime: number;
	retryCount: number;
	retryDelay: number;
	timeout: number;
	debug: boolean;
}

export const loadQueryConfig: Effect.Effect<QueryConfigValues> = Effect.all({
	staleTime: QueryConfigOptions.staleTime,
	cacheTime: QueryConfigOptions.cacheTime,
	retryCount: QueryConfigOptions.retryCount,
	retryDelay: QueryConfigOptions.retryDelay,
	timeout: QueryConfigOptions.timeout,
	debug: QueryConfigOptions.debug,
}).pipe(
	Effect.catchAll(() =>
		Effect.succeed({
			staleTime: DEFAULT_STALE_TIME_MS,
			cacheTime: DEFAULT_CACHE_TIME_MS,
			retryCount: DEFAULT_RETRY_COUNT,
			retryDelay: DEFAULT_RETRY_DELAY_MS,
			timeout: DEFAULT_TIMEOUT_MS,
			debug: false,
		})
	)
);

let cachedConfig: QueryConfigValues | null = null;

export const getQueryConfig = (): QueryConfigValues => {
	if (!cachedConfig) {
		cachedConfig = Effect.runSync(loadQueryConfig);
	}
	return cachedConfig;
};

export const resetQueryConfigCache = (): void => {
	cachedConfig = null;
};
