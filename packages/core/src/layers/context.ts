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
 * LIABILITY, WHETHER IN AN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 */

import { Predicate } from 'effect';
import { createAsyncContextStorage } from '../utils/async-context.js';
import type { Component } from '../render/node.js';
import type {
	LayerProps,
	AnyResolvedLayer,
	LayerProvides,
} from './types.js';
import type { PropsRegistry } from './services/PropsService.js';
import type { LayerRegistry } from './services/RegistryService.js';
import {
	LayerNotFoundError,
	LayerRuntimeNotInitializedError,
} from './errors.js';
import { devWarn } from '../utils/dev-warnings.js';
import { getLayerDependencyNames } from './utils/dependencies.js';

export interface LayerContext<P extends LayerProps = LayerProps> {
	readonly name: string;
	readonly props: P;
	readonly provides?: LayerProvides;
	readonly deps: Record<string, LayerContext>;
	getService: (key: string) => unknown;
	getComponent: (name: string) => unknown;
}

export interface LayerContextStore {
	propsRegistry: PropsRegistry | null;
	layerRegistry: LayerRegistry | null;
	layers: readonly AnyResolvedLayer[];
}

const layerContextStorage = createAsyncContextStorage<LayerContextStore>();
let globalLayerContextStore: LayerContextStore | undefined;
const disposedLayerContextStores = new WeakSet<LayerContextStore>();

export const markLayerContextStoreDisposed = (
	store: LayerContextStore
): void => {
	disposedLayerContextStores.add(store);
};

export const isLayerContextStoreActive = (
	store: LayerContextStore | undefined
): store is LayerContextStore =>
	store !== undefined && !disposedLayerContextStores.has(store);

export const getLayerContextStore = (): LayerContextStore | undefined => {
	return layerContextStorage.getStore() ?? globalLayerContextStore;
};

export const getGlobalLayerContextStore = (): LayerContextStore | undefined =>
	globalLayerContextStore;

export const runWithLayerContext = <T>(
	store: LayerContextStore,
	fn: () => T
): T => {
	return layerContextStorage.run(store, fn);
};

export const restoreGlobalLayerContext = (
	store: LayerContextStore | undefined
): void => {
	globalLayerContextStore = isLayerContextStoreActive(store) ? store : undefined;
};

export const initGlobalLayerContext = (
	propsRegistry: PropsRegistry,
	layerRegistry: LayerRegistry,
	layers: readonly AnyResolvedLayer[]
): void => {
	const store = layerContextStorage.getStore();
	if (store) {
		store.propsRegistry = propsRegistry;
		store.layerRegistry = layerRegistry;
		store.layers = layers;
		globalLayerContextStore = store;
		return;
	}

	globalLayerContextStore = {
		propsRegistry,
		layerRegistry,
		layers,
	};
};

export const clearGlobalLayerContext = (): void => {
	const store = layerContextStorage.getStore();
	if (store) {
		store.propsRegistry = null;
		store.layerRegistry = null;
		store.layers = [];
	}

	globalLayerContextStore = undefined;
};

interface NonNullLayerContextStore {
	propsRegistry: PropsRegistry;
	layerRegistry: LayerRegistry;
	layers: readonly AnyResolvedLayer[];
}

const getStoreOrThrow = (): NonNullLayerContextStore => {
	const store = getLayerContextStore();
	if (!store || !store.propsRegistry || !store.layerRegistry) {
		devWarn(
			'Layer runtime not initialized. ' +
				'Did you forget to call app.useLayers() or createSSRRuntime()?' +
				' If testing, wrap your code in runWithLayerContext(store, fn).'
		);
		throw new LayerRuntimeNotInitializedError({ resource: 'layer context' });
	}
	return store as NonNullLayerContextStore;
};

export const isLayerRuntimeReady = (): boolean => {
	const store = getLayerContextStore();
	return (
		Predicate.isNotNullable(store) &&
		Predicate.isNotNullable(store.propsRegistry) &&
		Predicate.isNotNullable(store.layerRegistry)
	);
};

export function getLayerContext(name: string): LayerContext {
	const store = getStoreOrThrow();

	const layer = store.layerRegistry.getLayer(name);
	if (!layer) {
		throw new LayerNotFoundError({ layerName: name });
	}

	const props = store.propsRegistry.get(name) ?? ({} as LayerProps);

	const deps: Record<string, LayerContext> = {};
	for (const depName of getLayerDependencyNames(layer)) {
		Object.defineProperty(deps, depName, {
			get: () => getLayerContext(depName),
			enumerable: true,
		});
	}

	return {
		name,
		props,
		...(layer.provides && {
			provides: layer.provides as LayerProvides,
		}),
		deps,
		getService: (key: string) => store.layerRegistry.getService(key),
		getComponent: (componentName: string) =>
			store.layerRegistry.getComponent(componentName),
	};
}

export const getLayerService = (key: string): unknown => {
	const store = getStoreOrThrow();
	return store.layerRegistry.getService(key);
};

export function getLayerComponent(name: string): Component | undefined {
	const store = getStoreOrThrow();
	return store.layerRegistry.getComponent(name);
}
