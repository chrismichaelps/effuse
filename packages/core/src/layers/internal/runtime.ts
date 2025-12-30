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
import { initGlobalLayerContext, clearGlobalLayerContext } from '../context.js';
import {
	TracingService,
	TracingServiceLive,
	logDependencyGraph,
	setGlobalTracing,
	clearGlobalTracing,
	type TracingConfig,
} from '../tracing/index.js';

export type LayerRuntimeServices =
	| PropsService
	| RegistryService
	| TracingService;

export const CoreServicesLive = Layer.mergeAll(
	PropsService.Default,
	RegistryService.Default
);

export interface LayerRuntimeOptions {
	tracing?: Partial<TracingConfig>;
}

export interface LayerRuntime {
	readonly runtime: ManagedRuntime.ManagedRuntime<LayerRuntimeServices, never>;
	readonly cleanups: readonly CleanupFn[];
	dispose: () => Promise<void>;
}

export const createLayerRuntime = async (
	layers: readonly AnyResolvedLayer[],
	options: LayerRuntimeOptions = {}
): Promise<LayerRuntime> => {
	const tracingLayer = TracingServiceLive(options.tracing ?? {});
	const servicesLayer = Layer.mergeAll(CoreServicesLive, tracingLayer);
	const runtime = ManagedRuntime.make(servicesLayer);

	const runEffect = Effect.gen(function* () {
		const layerRegistry = yield* RegistryService;
		const tracingService = yield* TracingService;

		layerRegistry.registerService('tracing', tracingService);
		setGlobalTracing(tracingService);

		yield* logDependencyGraph(layers);
		return yield* buildAllLayersEffect(layers);
	});

	const buildResult = await runtime.runPromise(runEffect);

	const initContextEffect = Effect.gen(function* () {
		const propsRegistry = yield* PropsService;
		const layerRegistry = yield* RegistryService;
		initGlobalLayerContext(propsRegistry, layerRegistry, layers);
	});

	await runtime.runPromise(initContextEffect);

	const cleanups = buildResult.results
		.map((r) => r.cleanup)
		.filter((c): c is CleanupFn => c !== undefined);

	return {
		runtime,
		cleanups,
		dispose: async () => {
			clearGlobalLayerContext();
			clearGlobalTracing();

			if (buildResult.cleanup) {
				buildResult.cleanup();
			}
			await runtime.dispose();
		},
	};
};
