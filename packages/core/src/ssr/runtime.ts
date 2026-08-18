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
import {
	createPropsRegistry,
	PropsService,
} from '../layers/services/PropsService.js';
import {
	createLayerRegistry,
	RegistryService,
} from '../layers/services/RegistryService.js';
import {
	buildAllLayersEffect,
	registerLayerMetadata,
} from '../layers/internal/builder.js';
import {
	getGlobalLayerContextStore,
	isLayerContextStoreActive,
	markLayerContextStoreDisposed,
	restoreGlobalLayerContext,
	runWithLayerContext,
	type LayerContextStore,
} from '../layers/context.js';
import {
	TracingServiceLive,
	createTracingService,
	type TracingServiceApi,
} from '../layers/tracing/index.js';
import { TracingService } from '../layers/tracing/index.js';
import { runWithTracing } from '../layers/tracing/global.js';
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

const createLightweightRuntime = (
	layers: readonly AnyResolvedLayer[],
	headStack: HeadProps[],
	state: Map<string, unknown>,
	previousLayerContextStore: LayerContextStore | undefined,
	hasExistingLayerContext: boolean
): SSRRuntime => {
	const propsRegistry = createPropsRegistry();
	const layerRegistry = createLayerRegistry();
	const tracingService = createTracingService();
	layerRegistry.registerService('tracing', tracingService);
	for (const layer of layers) {
		registerLayerMetadata(layer, propsRegistry, layerRegistry);
	}

	const layerContextStore: LayerContextStore = {
		propsRegistry,
		layerRegistry,
		layers,
	};
	if (!hasExistingLayerContext) {
		restoreGlobalLayerContext(layerContextStore);
	}

	let disposePromise: Promise<void> | undefined;
	const dispose = (): Promise<void> => {
		disposePromise ??= Promise.resolve().then(() => {
			markLayerContextStoreDisposed(layerContextStore);
			if (getGlobalLayerContextStore() === layerContextStore) {
				restoreGlobalLayerContext(
					isLayerContextStoreActive(previousLayerContextStore)
						? previousLayerContextStore
						: undefined
				);
			}
		});
		return disposePromise;
	};

	return {
		layers,
		headStack,
		state,
		run: <T>(fn: () => T): T =>
			runWithLayerContext(layerContextStore, () =>
				runWithTracing(tracingService, fn)
			),
		dispose,
	};
};

const hasManagedRuntimeWork = (layer: AnyResolvedLayer): boolean =>
	Object.keys(layer.provides ?? {}).length > 0 ||
	Object.keys(layer.services ?? {}).length > 0 ||
	Predicate.isFunction(layer.setup) ||
	Predicate.isFunction(layer.onMount) ||
	Predicate.isFunction(layer.onUnmount) ||
	Predicate.isFunction(layer.onReady);

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
	const hasExistingLayerContext = Predicate.isNotNullable(
		previousLayerContextStore
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

	if (!runSetup || !layers.some(hasManagedRuntimeWork)) {
		return createLightweightRuntime(
			layers,
			headStack,
			state,
			previousLayerContextStore,
			hasExistingLayerContext
		);
	}

	const tracingLayer = TracingServiceLive({});
	const servicesLayer = Layer.mergeAll(CoreServicesLive, tracingLayer);
	const managedRuntime = ManagedRuntime.make(servicesLayer);

	let aggregatedCleanup: CleanupFn | undefined;
	let disposePromise: Promise<void> | undefined;
	let runtimeTracingService: TracingServiceApi | undefined;
	let layerContextStore: LayerContextStore = {
		propsRegistry: null,
		layerRegistry: null,
		layers: [],
	};
	const dispose = (): Promise<void> => {
		const disposeRuntime = async (): Promise<void> => {
			const failures: unknown[] = [];
			markLayerContextStoreDisposed(layerContextStore);
			if (getGlobalLayerContextStore() === layerContextStore) {
				restoreGlobalLayerContext(
					isLayerContextStoreActive(previousLayerContextStore)
						? previousLayerContextStore
						: undefined
				);
			}

			if (Predicate.isFunction(aggregatedCleanup)) {
				try {
					await aggregatedCleanup();
				} catch (error) {
					failures.push(error);
				}
			}

			try {
				await managedRuntime.dispose();
			} catch (error) {
				failures.push(error);
			}
			if (failures.length === 1) throw failures[0];
			if (failures.length > 1) {
				throw new AggregateError(
					failures,
					`[Effuse] SSR layer runtime cleanup failed in ${String(failures.length)} resources.`
				);
			}
		};
		disposePromise ??= runtimeTracingService
			? runWithTracing(runtimeTracingService, disposeRuntime)
			: disposeRuntime();
		return disposePromise;
	};

	try {
		if (runSetup) {
			runtimeTracingService = await managedRuntime.runPromise(TracingService);
			const tracingService = runtimeTracingService;
			const runEffect = Effect.gen(function* () {
				const layerRegistry = yield* RegistryService;

				layerRegistry.registerService('tracing', tracingService);

				return yield* buildAllLayersEffect(layers);
			});

			const buildResult = await runWithTracing(tracingService, () =>
				managedRuntime.runPromise(runEffect)
			);

			aggregatedCleanup = buildResult.cleanup;

			const initContextEffect = Effect.gen(function* () {
				const propsRegistry = yield* PropsService;
				const layerRegistry = yield* RegistryService;
				layerContextStore = { propsRegistry, layerRegistry, layers };
				if (!hasExistingLayerContext) {
					restoreGlobalLayerContext(layerContextStore);
				}
			});

			await managedRuntime.runPromise(initContextEffect);
		}
	} catch (error) {
		try {
			await dispose();
		} catch (disposeError) {
			throw new AggregateError(
				[error, disposeError],
				'[Effuse] SSR layer runtime initialization and rollback failed.'
			);
		}
		throw error;
	}

	return {
		layers,
		headStack,
		state,
		run: <T>(fn: () => T): T => {
			return runWithLayerContext(layerContextStore, () =>
				runtimeTracingService ? runWithTracing(runtimeTracingService, fn) : fn()
			);
		},
		dispose,
	};
};
