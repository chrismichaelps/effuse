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

/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-argument */
import { Effect } from 'effect';
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
import { DependencyNotFoundError } from '../errors.js';

export const createSetupContext = (
	layer: AnyResolvedLayer,
	propsRegistry: PropsRegistry,
	registry: LayerRegistry,
	allLayers: readonly AnyResolvedLayer[]
): SetupContext => {
	const layerProps = layer.props ?? ({} as LayerProps);

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
	Effect.gen(function* () {
		const propsRegistry = yield* PropsService;
		const registry = yield* RegistryService;

		registry.registerLayer(layer);

		if (layer.props) {
			propsRegistry.set(layer.name, layer.props);
		}

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

		const cleanups: CleanupFn[] = [];

		if (layer.onMount) {
			const onMountFn = layer.onMount;
			yield* Effect.tryPromise({
				try: () => Promise.resolve(onMountFn()),
				catch: (error: unknown) => {
					if (layer.onError && error instanceof Error) {
						layer.onError(error);
					}
					return error;
				},
			});
		}

		if (layer.setup) {
			const ctx = createSetupContext(layer, propsRegistry, registry, allLayers);
			const setupFn = layer.setup;

			const result = yield* Effect.tryPromise({
				try: () => Promise.resolve(setupFn(ctx)),
				catch: (error: unknown) => {
					if (layer.onError && error instanceof Error) {
						layer.onError(error);
					}
					return error;
				},
			});

			if (typeof result === 'function') {
				cleanups.push(result);
			}
		}

		if (layer.onUnmount) {
			const onUnmountFn = layer.onUnmount;
			cleanups.push(() => {
				try {
					const maybePromise = onUnmountFn();
					if (maybePromise instanceof Promise) {
						void maybePromise.catch(() => {
							// Silent catch - cleanup errors shouldn't propagate
						});
					}
				} catch (error: unknown) {
					if (layer.onError && error instanceof Error) {
						layer.onError(error);
					}
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
								if (layer.onError && error instanceof Error) {
									layer.onError(error);
								}
							}
						}
					}
				: undefined;

		return { layer, cleanup };
	});

export interface LayerBuildResult {
	readonly layer: AnyResolvedLayer;
	readonly cleanup: CleanupFn | undefined;
}

export interface AllLayersBuildResult {
	readonly results: readonly LayerBuildResult[];
	readonly cleanup: CleanupFn | undefined;
}

export const buildAllLayersEffect = (
	layers: readonly AnyResolvedLayer[]
): Effect.Effect<
	AllLayersBuildResult,
	unknown,
	PropsService | RegistryService
> =>
	Effect.gen(function* () {
		const results: LayerBuildResult[] = [];

		for (const layer of layers) {
			const result = yield* buildLayerEffect(layer, layers);
			results.push(result);
		}

		const aggregatedCleanup: CleanupFn | undefined =
			results.length > 0
				? () => {
						for (const { cleanup } of results.slice().reverse()) {
							if (cleanup) {
								try {
									cleanup();
								} catch (error: unknown) {
									// Silently handle cleanup errors to ensure all cleanups run
									void error;
								}
							}
						}
					}
				: undefined;

		return {
			results,
			cleanup: aggregatedCleanup,
		};
	});
