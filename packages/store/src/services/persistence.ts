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

import { Context, Effect, Layer, Duration, Option } from 'effect';
import {
	type StorageAdapter,
	localStorageAdapter,
	sessionStorageAdapter,
	noopAdapter,
	createMemoryAdapter,
} from '../persistence/adapters.js';
import { TimeoutError } from '../actions/async.js';
import { DEFAULT_TIMEOUT_MS } from '../config/constants.js';

// Persistence service API
export interface PersistenceServiceApi {
	get: (key: string) => Effect.Effect<Option.Option<string>>;
	set: (key: string, value: string) => Effect.Effect<void>;
	remove: (key: string) => Effect.Effect<void>;
	clear: () => Effect.Effect<void>;
	getWithTimeout: (
		key: string,
		timeoutMs?: number
	) => Effect.Effect<Option.Option<string>, TimeoutError>;
	setWithTimeout: (
		key: string,
		value: string,
		timeoutMs?: number
	) => Effect.Effect<void, TimeoutError>;
}

// Persistence service identifier
export class PersistenceService extends Context.Tag(
	'effuse/store/PersistenceService'
)<PersistenceService, PersistenceServiceApi>() {}

const createPersistenceApi = (
	adapter: StorageAdapter
): PersistenceServiceApi => ({
	get: (key: string) => {
		const result = adapter.getItem(key);
		return result instanceof Promise
			? Effect.promise(async () => Option.fromNullable(await result))
			: Effect.succeed(Option.fromNullable(result));
	},
	set: (key: string, value: string) => {
		const result = adapter.setItem(key, value);
		return result instanceof Promise
			? Effect.promise(() => result)
			: Effect.void;
	},
	remove: (key: string) => {
		const result = adapter.removeItem(key);
		return result instanceof Promise
			? Effect.promise(() => result)
			: Effect.void;
	},
	clear: () => Effect.void,
	getWithTimeout: (key: string, timeoutMs = DEFAULT_TIMEOUT_MS) => {
		const result = adapter.getItem(key);
		const effect =
			result instanceof Promise
				? Effect.promise(async () => Option.fromNullable(await result))
				: Effect.succeed(Option.fromNullable(result));

		return effect.pipe(
			Effect.timeoutFail({
				duration: Duration.millis(timeoutMs),
				onTimeout: () => new TimeoutError(timeoutMs),
			})
		);
	},
	setWithTimeout: (
		key: string,
		value: string,
		timeoutMs = DEFAULT_TIMEOUT_MS
	) => {
		const result = adapter.setItem(key, value);
		const effect =
			result instanceof Promise ? Effect.promise(() => result) : Effect.void;

		return effect.pipe(
			Effect.timeoutFail({
				duration: Duration.millis(timeoutMs),
				onTimeout: () => new TimeoutError(timeoutMs),
			})
		);
	},
});

// Browser local storage persistence
export const LocalStoragePersistenceLive: Layer.Layer<PersistenceService> =
	Layer.succeed(PersistenceService, createPersistenceApi(localStorageAdapter));

// Browser session storage persistence
export const SessionStoragePersistenceLive: Layer.Layer<PersistenceService> =
	Layer.succeed(
		PersistenceService,
		createPersistenceApi(sessionStorageAdapter)
	);

// Memory storage persistence
export const MemoryPersistenceLive: Layer.Layer<PersistenceService> =
	Layer.succeed(
		PersistenceService,
		createPersistenceApi(createMemoryAdapter())
	);

// No-op storage persistence
export const NoopPersistenceLive: Layer.Layer<PersistenceService> =
	Layer.succeed(PersistenceService, createPersistenceApi(noopAdapter));

// Build persistence layer
export const makePersistenceLayer = (
	adapter: StorageAdapter
): Layer.Layer<PersistenceService> =>
	Layer.succeed(PersistenceService, createPersistenceApi(adapter));

// Access persistence service
export const usePersistence = <A, E, R>(
	fn: (service: PersistenceServiceApi) => Effect.Effect<A, E, R>
) =>
	Effect.gen(function* () {
		const service = yield* PersistenceService;
		return yield* fn(service);
	});

// Run with persistence service
export const runWithPersistence = <A, E>(
	effect: Effect.Effect<A, E, PersistenceService>,
	adapter: 'local' | 'session' | 'memory' | 'noop' = 'local'
): Effect.Effect<A, E> => {
	const layer =
		adapter === 'local'
			? LocalStoragePersistenceLive
			: adapter === 'session'
				? SessionStoragePersistenceLive
				: adapter === 'memory'
					? MemoryPersistenceLive
					: NoopPersistenceLive;
	return Effect.provide(effect, layer);
};
