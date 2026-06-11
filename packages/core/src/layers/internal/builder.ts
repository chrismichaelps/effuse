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

import { Effect, Fiber, Predicate } from 'effect';
import type {
	AnyResolvedLayer,
	SetupContext,
	LayerDependency,
	CleanupFn,
	LayerProps,
} from '../types.js';
import { PropsService, type PropsRegistry } from '../services/PropsService.js';
import {
	RegistryService,
	type LayerRegistry,
} from '../services/RegistryService.js';
import type { Component } from '../../render/node.js';
import { DependencyNotFoundError, LayerSetupError } from '../errors.js';
import {
	withLayerSpan,
	type TracingService,
	traceFiberBuildPhase,
} from '../tracing/index.js';
import { buildTopologyLevels, getMaxParallelism } from './topology.js';

const resolveLayerProps = (layer: AnyResolvedLayer): LayerProps =>
	layer.deriveProps
		? layer.deriveProps(layer.store)
		: (layer.props ?? ({} as LayerProps));

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
	if (layer.dependencies) {
		for (const depName of layer.dependencies) {
			deps[depName] = getLayerDependency(depName);
		}
	}

	return {
		props: layerProps,
		store: layer.store,
		deps,
		get: getLayerDependency,
		getService: (key: string) => registry.getService(key),
		component: (name: string) => registry.getComponent(name),
		layers: allLayers,
	};
};

export const buildLayerEffect = (
	layer: AnyResolvedLayer,
	allLayers: readonly AnyResolvedLayer[]
) =>
	withLayerSpan(
		layer,
		Effect.gen(function* () {
			const propsRegistry = yield* PropsService;
			const registry = yield* RegistryService;

			registry.registerLayer(layer);

			propsRegistry.set(layer.name, resolveLayerProps(layer));

			if (layer.components) {
				for (const [name, component] of Object.entries(layer.components)) {
					registry.registerComponent(name, component as Component);
				}
			}

			if (layer.provides) {
				for (const [key, factory] of Object.entries(layer.provides)) {
					registry.registerService(key, factory());
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
				cleanups.push(() => {
					try {
						const maybePromise = onUnmountFn(ctx);
						if (maybePromise instanceof Promise) {
							void maybePromise.catch(() => {});
						}
					} catch (error: unknown) {
						handleError(error);
					}
				});
			}

			const cleanup: CleanupFn | undefined =
				cleanups.length > 0
					? () => {
							const reversed = cleanups.slice().reverse();
							for (const cleanupFn of reversed) {
								try {
									cleanupFn();
								} catch (error: unknown) {
									handleError(error);
								}
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
					const result = yield* buildLayerEffect(singleLayer, layers);
					results.push(result);
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

				const levelResults = yield* Fiber.joinAll(fibers);
				results.push(...levelResults);
			}
		}

		const onReadyCallbacks = results.flatMap((r) =>
			r.onReady ? [r.onReady] : []
		);

		if (onReadyCallbacks.length > 0) {
			yield* Effect.all(
				onReadyCallbacks.map((cb, index) =>
					Effect.tryPromise({
						try: () => Promise.resolve(cb()),
						catch: (error: unknown) =>
							new LayerSetupError({
								layerName: results[index]?.layer.name ?? 'unknown',
								phase: 'onReady',
								cause: error,
							}),
					})
				),
				{ concurrency: 'unbounded' }
			);
		}

		const aggregatedCleanup: CleanupFn | undefined =
			results.length > 0
				? () => {
						for (const { cleanup } of results.slice().reverse()) {
							if (cleanup) {
								try {
									cleanup();
								} catch {
									void 0;
								}
							}
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
