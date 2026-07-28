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

import { Effect, Layer, ManagedRuntime } from 'effect';
import type { AnyResolvedLayer, CleanupFn } from '../types.js';
import { PropsService } from '../services/PropsService.js';
import { RegistryService } from '../services/RegistryService.js';
import { buildAllLayersEffect } from './builder.js';
import {
	getGlobalLayerContextStore,
	initGlobalLayerContext,
	isLayerContextStoreActive,
	markLayerContextStoreDisposed,
	restoreGlobalLayerContext,
	type LayerContextStore,
} from '../context.js';
import {
	TracingService,
	TracingServiceLive,
	logDependencyGraph,
	setGlobalTracing,
	getGlobalTracing,
	clearGlobalTracing,
	type TracingConfig,
} from '../tracing/index.js';

/** Internal — not exported to users. */
export const CoreServicesLive = Layer.mergeAll(
	PropsService.Default,
	RegistryService.Default
);

const disposedTracingServices = new WeakSet<object>();

const isActiveTracingService = <T extends object | null>(
	service: T
): service is Exclude<T, null> =>
	service !== null && !disposedTracingServices.has(service);

export interface LayerRuntimeOptions {
	tracing?: Partial<TracingConfig>;
}

export interface LayerRuntime {
	readonly cleanups: readonly CleanupFn[];
	dispose: () => Promise<void>;
}

export const createLayerRuntime = async (
	layers: readonly AnyResolvedLayer[],
	options: LayerRuntimeOptions = {}
): Promise<LayerRuntime> => {
	const previousLayerContextStore = getGlobalLayerContextStore();
	const previousTracingService = getGlobalTracing();
	let layerContextStore: LayerContextStore | undefined;
	let runtimeTracingService: ReturnType<typeof getGlobalTracing> = null;
	const tracingLayer = TracingServiceLive(options.tracing ?? {});
	const servicesLayer = Layer.mergeAll(CoreServicesLive, tracingLayer);
	const runtime = ManagedRuntime.make(servicesLayer);

	const runEffect = Effect.gen(function* () {
		const layerRegistry = yield* RegistryService;
		const tracingService = yield* TracingService;

		layerRegistry.registerService('tracing', tracingService);
		setGlobalTracing(tracingService);
		runtimeTracingService = tracingService;

		yield* logDependencyGraph(layers);
		return yield* buildAllLayersEffect(layers);
	});

	const buildResult = await runtime.runPromise(runEffect);

	const initContextEffect = Effect.gen(function* () {
		const propsRegistry = yield* PropsService;
		const layerRegistry = yield* RegistryService;
		initGlobalLayerContext(propsRegistry, layerRegistry, layers);
		layerContextStore = getGlobalLayerContextStore();
	});

	await runtime.runPromise(initContextEffect);

	const cleanups = buildResult.results
		.map((r) => r.cleanup)
		.filter((c): c is CleanupFn => c !== undefined);
	let disposePromise: Promise<void> | undefined;

	return {
		runtime,
		cleanups,
		dispose: () => {
			disposePromise ??= (async () => {
				const failures: unknown[] = [];
				if (layerContextStore) {
					markLayerContextStoreDisposed(layerContextStore);
				}
				if (runtimeTracingService) {
					disposedTracingServices.add(runtimeTracingService);
				}

				if (getGlobalLayerContextStore() === layerContextStore) {
					restoreGlobalLayerContext(
						isLayerContextStoreActive(previousLayerContextStore)
							? previousLayerContextStore
							: undefined
					);
				}
				if (getGlobalTracing() === runtimeTracingService) {
					if (isActiveTracingService(previousTracingService)) {
						setGlobalTracing(previousTracingService);
					} else {
						clearGlobalTracing();
					}
				}

				if (buildResult.cleanup) {
					try {
						await buildResult.cleanup();
					} catch (error) {
						failures.push(error);
					}
				}
				try {
					await runtime.dispose();
				} catch (error) {
					failures.push(error);
				}
				if (failures.length === 1) throw failures[0];
				if (failures.length > 1) {
					throw new AggregateError(
						failures,
						`[Effuse] Layer runtime cleanup failed in ${failures.length} resources.`
					);
				}
			})();
			return disposePromise;
		},
	} as LayerRuntime;
};
