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

import { Cause, Effect, Exit, Fiber, Predicate } from 'effect';
import type {
	AnyResolvedLayer,
	SetupContext,
	LayerDependency,
	CleanupFn,
	LayerProps,
	LayerServiceFactoryContext,
} from '../types.js';
import { PropsService, type PropsRegistry } from '../services/PropsService.js';
import {
	RegistryService,
	type LayerRegistry,
} from '../services/RegistryService.js';
import type { Component } from '../../render/node.js';
import {
	DependencyNotFoundError,
	LayerSetupError,
	ServiceNotFoundError,
} from '../errors.js';
import {
	withLayerSpan,
	type TracingService,
	traceFiberBuildPhase,
} from '../tracing/index.js';
import { buildTopologyLevels, getMaxParallelism } from './topology.js';
import { getLayerDependencyNames } from '../utils/dependencies.js';

export const resolveLayerProps = (layer: AnyResolvedLayer): LayerProps =>
	layer.deriveProps
		? layer.deriveProps(layer.store)
		: (layer.props ?? ({} as LayerProps));

export const registerLayerMetadata = (
	layer: AnyResolvedLayer,
	propsRegistry: PropsRegistry,
	registry: LayerRegistry
): void => {
	registry.registerLayer(layer);
	propsRegistry.set(layer.name, resolveLayerProps(layer));
	if (layer.components) {
		for (const [name, component] of Object.entries(layer.components)) {
			registry.registerComponent(name, component as Component);
		}
	}
};

export const createSetupContext = (
	layer: AnyResolvedLayer,
	propsRegistry: PropsRegistry,
	registry: LayerRegistry,
	allLayers: readonly AnyResolvedLayer[]
): SetupContext => {
	const layerProps = propsRegistry.get(layer.name) ?? resolveLayerProps(layer);

	const getLayerDependency = (name: string): LayerDependency => {
		const depLayer = registry.getLayer(name);
		if (!depLayer) {
			throw new DependencyNotFoundError({
				layerName: layer.name,
				dependencyName: name,
			});
		}

		const depProps = propsRegistry.get(name) ?? ({} as LayerProps);

		return {
			name,
			props: depProps,
			get: (key: string) => registry.getService(key),
			component: (componentName: string) =>
				registry.getComponent(componentName),
		};
	};

	const deps: Record<string, LayerDependency> = {};
	for (const depName of getLayerDependencyNames(layer)) {
		deps[depName] = getLayerDependency(depName);
	}

	const requireService = <T = unknown>(key: string): T => {
		const service = registry.getService(key);
		if (service === undefined) {
			throw new ServiceNotFoundError({
				layerName: layer.name,
				serviceKey: key,
			});
		}
		return service as T;
	};

	return {
		props: layerProps,
		store: layer.store,
		deps,
		get: getLayerDependency,
		getService: <T = unknown>(key: string) =>
			registry.getService(key) as T | undefined,
		requireService,
		component: (name: string) => registry.getComponent(name),
		layers: allLayers,
	};
};

const createServiceFactoryContext = (
	layer: AnyResolvedLayer,
	serviceKey: string,
	propsRegistry: PropsRegistry,
	registry: LayerRegistry,
	allLayers: readonly AnyResolvedLayer[]
): LayerServiceFactoryContext => ({
	...createSetupContext(layer, propsRegistry, registry, allLayers),
	layer: layer.name,
	serviceKey,
});

export const buildLayerEffect = (
	layer: AnyResolvedLayer,
	allLayers: readonly AnyResolvedLayer[]
) =>
	withLayerSpan(
		layer,
		Effect.gen(function* () {
			const propsRegistry = yield* PropsService;
			const registry = yield* RegistryService;

			registerLayerMetadata(layer, propsRegistry, registry);

			if (layer.provides) {
				for (const [key, factory] of Object.entries(layer.provides)) {
					const serviceContext = createServiceFactoryContext(
						layer,
						key,
						propsRegistry,
						registry,
						allLayers
					);
					const service = yield* Effect.try({
						try: () => factory(serviceContext),
						catch: (error: unknown) =>
							new LayerSetupError({
								layerName: layer.name,
								phase: `service:${key}`,
								cause: error,
							}),
					});
					registry.registerService(key, service);
				}
			}

			const ctx = yield* Effect.try({
				try: () =>
					createSetupContext(layer, propsRegistry, registry, allLayers),
				catch: (error) => error as DependencyNotFoundError,
			});
			const cleanups: CleanupFn[] = [];

			const handleError = (error: unknown) => {
				if (layer.onError && error instanceof Error) {
					layer.onError(error, ctx);
				}
			};

			if (layer.onMount) {
				const onMountFn = layer.onMount;
				yield* Effect.tryPromise({
					try: () => Promise.resolve(onMountFn(ctx)),
					catch: (error: unknown) => {
						handleError(error);
						return new LayerSetupError({
							layerName: layer.name,
							phase: 'onMount',
							cause: error,
						});
					},
				});
			}

			if (layer.setup) {
				const setupFn = layer.setup;

				const result = yield* Effect.tryPromise({
					try: () => Promise.resolve(setupFn(ctx)),
					catch: (error: unknown) => {
						handleError(error);
						return new LayerSetupError({
							layerName: layer.name,
							phase: 'setup',
							cause: error,
						});
					},
				});

				if (Predicate.isFunction(result)) {
					cleanups.push(result);
				}
			}

			if (layer.onUnmount) {
				const onUnmountFn = layer.onUnmount;
				cleanups.push(() => onUnmountFn(ctx));
			}

			const cleanup: CleanupFn | undefined =
				cleanups.length > 0
					? async () => {
							const failures: unknown[] = [];
							const reversed = cleanups.slice().reverse();
							for (const cleanupFn of reversed) {
								try {
									await cleanupFn();
								} catch (error: unknown) {
									try {
										handleError(error);
										failures.push(error);
									} catch (handlerError) {
										failures.push(
											new AggregateError(
												[error, handlerError],
												`[Effuse] Layer "${layer.name}" error handler failed during cleanup.`
											)
										);
									}
								}
							}
							if (failures.length === 1) throw failures[0];
							if (failures.length > 1) {
								throw new AggregateError(
									failures,
									`[Effuse] Layer "${layer.name}" cleanup failed in ${failures.length} callbacks.`
								);
							}
						}
					: undefined;

			const layerOnReady = layer.onReady;
			const onReady = Predicate.isNotNullable(layerOnReady)
				? () => layerOnReady(ctx, allLayers)
				: undefined;

			return { layer, cleanup, onReady };
		})
	);

export interface LayerBuildResult {
	readonly layer: AnyResolvedLayer;
	readonly cleanup: CleanupFn | undefined;
	readonly onReady: (() => void | Promise<void>) | undefined;
}

export interface AllLayersBuildResult {
	readonly results: readonly LayerBuildResult[];
	readonly cleanup: CleanupFn | undefined;
	readonly metrics: BuildMetrics;
}

export interface BuildMetrics {
	readonly totalLayers: number;
	readonly levels: number;
	readonly maxParallelism: number;
}

const cleanupBuildResults = async (
	results: readonly LayerBuildResult[]
): Promise<unknown[]> => {
	const failures: unknown[] = [];
	for (let index = results.length - 1; index >= 0; index -= 1) {
		const cleanup = results[index]?.cleanup;
		if (!cleanup) continue;
		try {
			await cleanup();
		} catch (error) {
			failures.push(error);
		}
	}
	return failures;
};

const failBuildAfterRollback = (
	results: readonly LayerBuildResult[],
	causes: readonly Cause.Cause<unknown>[]
): Effect.Effect<never, unknown> =>
	Effect.gen(function* () {
		const cleanupFailures = yield* Effect.promise(() =>
			cleanupBuildResults(results)
		);
		if (causes.length === 1 && cleanupFailures.length === 0) {
			return yield* Effect.failCause(causes[0] as Cause.Cause<unknown>);
		}

		const setupFailures = causes.map(Cause.squash);
		return yield* Effect.fail(
			new AggregateError(
				[...setupFailures, ...cleanupFailures],
				`[Effuse] Layer initialization failed with ${String(setupFailures.length)} setup and ${String(cleanupFailures.length)} rollback errors.`
			)
		);
	});

const appendLayerExits = (
	results: LayerBuildResult[],
	exits: readonly Exit.Exit<LayerBuildResult, unknown>[]
): Effect.Effect<void, unknown> =>
	Effect.gen(function* () {
		const causes: Cause.Cause<unknown>[] = [];
		for (const exit of exits) {
			if (Exit.isSuccess(exit)) results.push(exit.value);
			else causes.push(exit.cause);
		}

		if (causes.length > 0) {
			yield* failBuildAfterRollback(results, causes);
		}
	});

export const buildAllLayersEffect = (
	layers: readonly AnyResolvedLayer[]
): Effect.Effect<
	AllLayersBuildResult,
	unknown,
	PropsService | RegistryService | TracingService
> =>
	Effect.gen(function* () {
		const topology = yield* buildTopologyLevels(layers);
		const results: LayerBuildResult[] = [];

		for (const level of topology) {
			traceFiberBuildPhase(
				level.level,
				level.layers.map((l) => l.name)
			);

			if (level.layers.length === 1) {
				const singleLayer = level.layers[0];
				if (singleLayer) {
					const exit = yield* Effect.exit(
						buildLayerEffect(singleLayer, layers)
					);
					yield* appendLayerExits(results, [exit]);
				}
			} else if (level.layers.length > 1) {
				const fibers = yield* Effect.all(
					level.layers.map((layer) =>
						Effect.fork(buildLayerEffect(layer, layers))
					)
				) as Effect.Effect<
					Fiber.Fiber<LayerBuildResult, unknown>[],
					never,
					PropsService | RegistryService | TracingService
				>;

				const exits = yield* Effect.all(fibers.map(Fiber.await));
				yield* appendLayerExits(results, exits);
			}
		}

		const onReadyCallbacks = results.flatMap((result) =>
			result.onReady
				? [{ callback: result.onReady, layer: result.layer.name }]
				: []
		);

		if (onReadyCallbacks.length > 0) {
			const exits = yield* Effect.all(
				onReadyCallbacks.map(({ callback, layer }) =>
					Effect.exit(
						Effect.tryPromise({
							try: () => Promise.resolve(callback()),
							catch: (error: unknown) =>
								new LayerSetupError({
									layerName: layer,
									phase: 'onReady',
									cause: error,
								}),
						})
					)
				),
				{ concurrency: 'unbounded' }
			);
			const causes = exits.flatMap((exit) =>
				Exit.isFailure(exit) ? [exit.cause] : []
			);
			if (causes.length > 0) {
				yield* failBuildAfterRollback(results, causes);
			}
		}

		const aggregatedCleanup: CleanupFn | undefined =
			results.length > 0
				? async () => {
						const failures = await cleanupBuildResults(results);
						if (failures.length === 1) throw failures[0];
						if (failures.length > 1) {
							throw new AggregateError(
								failures,
								`[Effuse] Layer cleanup failed in ${failures.length} layers.`
							);
						}
					}
				: undefined;

		const metrics: BuildMetrics = {
			totalLayers: layers.length,
			levels: topology.length,
			maxParallelism: getMaxParallelism(topology),
		};

		return {
			results,
			cleanup: aggregatedCleanup,
			metrics,
		};
	});
