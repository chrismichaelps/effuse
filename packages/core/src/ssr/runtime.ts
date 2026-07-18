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

import { Effect, Layer, ManagedRuntime, Predicate } from 'effect';
import type { AnyResolvedLayer, CleanupFn } from '../layers/types.js';
import type { LayerInputSource } from '../layers/api/defineLayer.js';
import type { HeadProps } from './types.js';
import { PropsService } from '../layers/services/PropsService.js';
import { RegistryService } from '../layers/services/RegistryService.js';
import { buildAllLayersEffect } from '../layers/internal/builder.js';
import {
	initGlobalLayerContext,
	clearGlobalLayerContext,
	getGlobalLayerContextStore,
	restoreGlobalLayerContext,
	runWithLayerContext,
	type LayerContextStore,
} from '../layers/context.js';
import {
	TracingServiceLive,
	setGlobalTracing,
	getGlobalTracing,
	clearGlobalTracing,
} from '../layers/tracing/index.js';
import { TracingService } from '../layers/tracing/index.js';
import { CoreServicesLive } from '../layers/internal/runtime.js';
import { resolveLayerDefinitions } from '../layers/api/defineLayer.js';

export interface SSRRuntime {
	/** Resolved layers in topological order. */
	readonly layers: readonly AnyResolvedLayer[];
	/** Per-request head stack accumulated during rendering. */
	readonly headStack: HeadProps[];
	/** Per-request serializable state for hydration. */
	readonly state: Map<string, unknown>;
	/** Run a function within this runtime's context */
	run<T>(fn: () => T): T;
	/** Dispose the runtime and run all cleanups. */
	dispose(): Promise<void>;
}

export interface SSRRuntimeOptions {
	/** Whether to run layer setup() functions. Defaults to true. */
	readonly runSetup?: boolean;
}

/**
 * Creates a per-request SSR runtime scoped to a single render pass.
 *
 * Layer context is stored in AsyncLocalStorage, so concurrent requests
 * no longer corrupt shared state. Each request gets its own isolated
 * context that follows the render lifecycle (init → render → cleanup).
 */
export const createSSRRuntime = async (
	rawLayers: LayerInputSource,
	options: SSRRuntimeOptions = {}
): Promise<SSRRuntime> => {
	const { runSetup = true } = options;
	const previousLayerContextStore = getGlobalLayerContextStore();
	const previousTracingService = getGlobalTracing();
	const hasExistingLayerContext = Predicate.isNotNullable(
		previousLayerContextStore
	);
	const shouldInstallGlobalTracing = !Predicate.isNotNullable(
		previousTracingService
	);

	const layers: AnyResolvedLayer[] = resolveLayerDefinitions(rawLayers);

	const headStack: HeadProps[] = [];
	const state = new Map<string, unknown>();

	// Collect static heads from layer definitions
	for (const layer of layers) {
		if (layer.head) {
			headStack.push(layer.head);
		}
	}

	const tracingLayer = TracingServiceLive({});
	const servicesLayer = Layer.mergeAll(CoreServicesLive, tracingLayer);
	const managedRuntime = ManagedRuntime.make(servicesLayer);

	let aggregatedCleanup: CleanupFn | undefined;
	let layerContextStore: LayerContextStore = {
		propsRegistry: null,
		layerRegistry: null,
		layers: [],
	};

	if (runSetup) {
		const runEffect = Effect.gen(function* () {
			const layerRegistry = yield* RegistryService;
			const tracingService = yield* TracingService;

			layerRegistry.registerService('tracing', tracingService);
			if (shouldInstallGlobalTracing) {
				setGlobalTracing(tracingService);
			}

			return yield* buildAllLayersEffect(layers);
		});

		const buildResult = await managedRuntime.runPromise(runEffect);

		aggregatedCleanup = buildResult.cleanup;

		const initContextEffect = Effect.gen(function* () {
			const propsRegistry = yield* PropsService;
			const layerRegistry = yield* RegistryService;
			layerContextStore = { propsRegistry, layerRegistry, layers };
			if (!hasExistingLayerContext) {
				initGlobalLayerContext(propsRegistry, layerRegistry, layers);
			}
		});

		await managedRuntime.runPromise(initContextEffect);
	}

	return {
		layers,
		headStack,
		state,
		run: <T>(fn: () => T): T => {
			return runWithLayerContext(layerContextStore, fn);
		},
		dispose: async () => {
			try {
				clearGlobalLayerContext();
				clearGlobalTracing();
				restoreGlobalLayerContext(previousLayerContextStore);
				if (previousTracingService) {
					setGlobalTracing(previousTracingService);
				}

				if (Predicate.isFunction(aggregatedCleanup)) {
					aggregatedCleanup();
				}

				await managedRuntime.dispose();
			} catch {
				// Ignore cleanup errors
			}
		},
	};
};
