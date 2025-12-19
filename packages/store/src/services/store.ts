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

import { Context, Effect, Layer, Duration } from 'effect';
import type { Store, StoreDefinition, Middleware } from '../core/types.js';
import { createStore, type CreateStoreOptions } from '../core/store.js';
import {
	getStore,
	hasStore,
	removeStore,
	clearStores,
	getStoreNames,
} from '../registry/index.js';
import {
	createScope,
	disposeScope,
	getCurrentScope,
	getScopedStore,
	registerScopedStore,
	runInScope,
	type ScopeNode,
} from '../context/scope.js';
import { TimeoutError } from '../actions/async.js';
import { DEFAULT_TIMEOUT_MS } from '../config/constants.js';

// Store not found error
export class StoreNotFoundError extends Error {
	readonly _tag = 'StoreNotFoundError';
	constructor(name: string) {
		super(`Store "${name}" not found`);
	}
}

// Store already exists error
export class StoreAlreadyExistsError extends Error {
	readonly _tag = 'StoreAlreadyExistsError';
	constructor(name: string) {
		super(`Store "${name}" already exists`);
	}
}

export interface StoreServiceApi {
	create: <T extends object>(
		name: string,
		definition: StoreDefinition<T>,
		options?: CreateStoreOptions
	) => Effect.Effect<Store<T>>;
	get: <T>(name: string) => Effect.Effect<Store<T>, StoreNotFoundError>;
	getWithTimeout: <T>(
		name: string,
		timeoutMs?: number
	) => Effect.Effect<Store<T>, StoreNotFoundError | TimeoutError>;
	has: (name: string) => Effect.Effect<boolean>;
	remove: (name: string) => Effect.Effect<boolean>;
	clear: () => Effect.Effect<void>;
	names: () => Effect.Effect<string[]>;
	useMiddleware: (
		storeName: string,
		middleware: Middleware<Record<string, unknown>>
	) => Effect.Effect<() => void, StoreNotFoundError>;
}

// Store service identifier
export class StoreService extends Context.Tag('effuse/store/StoreService')<
	StoreService,
	StoreServiceApi
>() {}

// Live store service
export const StoreServiceLive: Layer.Layer<StoreService> = Layer.succeed(
	StoreService,
	{
		create: <T extends object>(
			name: string,
			definition: StoreDefinition<T>,
			options?: CreateStoreOptions
		) => Effect.sync(() => createStore(name, definition, options)),

		get: <T>(name: string) =>
			Effect.try({
				try: () => getStore<T>(name),
				catch: () => new StoreNotFoundError(name),
			}),

		getWithTimeout: <T>(name: string, timeoutMs = DEFAULT_TIMEOUT_MS) =>
			Effect.try({
				try: () => getStore<T>(name),
				catch: () => new StoreNotFoundError(name),
			}).pipe(
				Effect.timeoutFail({
					duration: Duration.millis(timeoutMs),
					onTimeout: () => new TimeoutError(timeoutMs),
				})
			),

		has: (name: string) => Effect.sync(() => hasStore(name)),
		remove: (name: string) => Effect.sync(() => removeStore(name)),
		clear: () =>
			Effect.sync(() => {
				clearStores();
			}),
		names: () => Effect.sync(() => getStoreNames()),

		useMiddleware: (
			storeName: string,
			middleware: Middleware<Record<string, unknown>>
		) =>
			Effect.gen(function* () {
				const store = yield* Effect.try({
					try: () => getStore(storeName),
					catch: () => new StoreNotFoundError(storeName),
				});
				return store.use(middleware);
			}),
	}
);

export interface ScopeServiceApi {
	create: (parent?: ScopeNode) => Effect.Effect<ScopeNode>;
	dispose: (scope: ScopeNode) => Effect.Effect<void>;
	current: () => Effect.Effect<ScopeNode>;
	run: <R>(scope: ScopeNode, fn: () => R) => Effect.Effect<R>;
	register: <T>(
		name: string,
		store: Store<T>,
		scope?: ScopeNode
	) => Effect.Effect<void>;
	get: <T>(
		name: string,
		scope?: ScopeNode
	) => Effect.Effect<Store<T>, StoreNotFoundError>;
}

// Scope service identifier
export class ScopeService extends Context.Tag('effuse/store/ScopeService')<
	ScopeService,
	ScopeServiceApi
>() {}

// Live scope service
export const ScopeServiceLive: Layer.Layer<ScopeService> = Layer.succeed(
	ScopeService,
	{
		create: (parent?: ScopeNode) => Effect.sync(() => createScope(parent)),
		dispose: (scope: ScopeNode) =>
			Effect.sync(() => {
				disposeScope(scope);
			}),
		current: () => Effect.sync(() => getCurrentScope()),
		run: <R>(scope: ScopeNode, fn: () => R) =>
			Effect.sync(() => runInScope(scope, fn)),
		register: <T>(name: string, store: Store<T>, scope?: ScopeNode) =>
			Effect.sync(() => {
				registerScopedStore(name, store, scope);
			}),
		get: <T>(name: string, scope?: ScopeNode) =>
			Effect.gen(function* () {
				const store = getScopedStore<T>(name, scope);
				if (!store) {
					return yield* Effect.fail(new StoreNotFoundError(name));
				}
				return store;
			}),
	}
);

// Combined live services layer
export const AllServicesLive = Layer.mergeAll(
	StoreServiceLive,
	ScopeServiceLive
);

// Access store service
export const useStoreService = <A, E, R>(
	fn: (service: StoreServiceApi) => Effect.Effect<A, E, R>
) =>
	Effect.gen(function* () {
		const service = yield* StoreService;
		return yield* fn(service);
	});

// Access scope service
export const useScopeService = <A, E, R>(
	fn: (service: ScopeServiceApi) => Effect.Effect<A, E, R>
) =>
	Effect.gen(function* () {
		const service = yield* ScopeService;
		return yield* fn(service);
	});

// Run with store service
export const runWithStore = <A, E>(
	effect: Effect.Effect<A, E, StoreService>
): Effect.Effect<A, E> => Effect.provide(effect, StoreServiceLive);

// Run with scope service
export const runWithScope = <A, E>(
	effect: Effect.Effect<A, E, ScopeService>
): Effect.Effect<A, E> => Effect.provide(effect, ScopeServiceLive);

// Run with all core services
export const runWithAllServices = <A, E>(
	effect: Effect.Effect<A, E, StoreService | ScopeService>
): Effect.Effect<A, E> => Effect.provide(effect, AllServicesLive);
