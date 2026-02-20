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

import { Option, pipe, Predicate } from 'effect';
import type { Component } from '../render/node.js';
import type {
	LayerProps,
	LayerProvides,
	AnyResolvedLayer,
	EffuseLayerRegistry,
	EffuseComponentRegistry,
	LayerPropsOf,
	LayerProvidesOf,
} from './types.js';
import type { PropsRegistry } from './services/PropsService.js';
import type { LayerRegistry } from './services/RegistryService.js';
import {
	LayerNotFoundError,
	LayerRuntimeNotInitializedError,
} from './errors.js';

export interface LayerContext<
	P extends LayerProps = LayerProps,
	S extends LayerProvides = LayerProvides,
> {
	readonly name: string;
	readonly props: P;
	readonly provides?: S;
	readonly deps: Record<string, LayerContext>;
	getService: (key: string) => unknown;
	getComponent: (name: string) => unknown;
}

export type TypedLayerContext<K extends keyof EffuseLayerRegistry> =
	LayerContext<LayerPropsOf<K>, LayerProvidesOf<K>>;

interface GlobalLayerState {
	propsRegistry: PropsRegistry | null;
	layerRegistry: LayerRegistry | null;
	layers: readonly AnyResolvedLayer[];
}

const globalState: GlobalLayerState = {
	propsRegistry: null,
	layerRegistry: null,
	layers: [],
};

export const initGlobalLayerContext = (
	propsRegistry: PropsRegistry,
	layerRegistry: LayerRegistry,
	layers: readonly AnyResolvedLayer[]
): void => {
	globalState.propsRegistry = propsRegistry;
	globalState.layerRegistry = layerRegistry;
	globalState.layers = layers;
};

export const clearGlobalLayerContext = (): void => {
	globalState.propsRegistry = null;
	globalState.layerRegistry = null;
	globalState.layers = [];
};

export const isLayerRuntimeReady = (): boolean => {
	return (
		Predicate.isNotNullable(globalState.propsRegistry) &&
		Predicate.isNotNullable(globalState.layerRegistry)
	);
};

export function getLayerContext<K extends keyof EffuseLayerRegistry>(
	name: K
): TypedLayerContext<K>;
export function getLayerContext(name: string): LayerContext;
export function getLayerContext(name: string): LayerContext {
	if (!globalState.layerRegistry || !globalState.propsRegistry) {
		throw new LayerRuntimeNotInitializedError({ resource: `layer "${name}"` });
	}

	const layer = globalState.layerRegistry.getLayer(name);
	if (!layer) {
		throw new LayerNotFoundError({ layerName: name });
	}

	const props = globalState.propsRegistry.get(name) ?? ({} as LayerProps);

	const deps: Record<string, LayerContext> = {};
	if (layer.dependencies) {
		for (const depName of layer.dependencies as readonly string[]) {
			Object.defineProperty(deps, depName, {
				get: () => getLayerContext(depName),
				enumerable: true,
			});
		}
	}

	return {
		name,
		props,
		...(layer.provides && {
			provides: layer.provides as Record<string, () => unknown>,
		}),
		deps,
		getService: (key: string) =>
			pipe(
				Option.fromNullable(globalState.layerRegistry),
				Option.map((registry) => registry.getService(key)),
				Option.getOrUndefined
			),
		getComponent: (componentName: string) =>
			pipe(
				Option.fromNullable(globalState.layerRegistry),
				Option.flatMap((registry) =>
					Option.fromNullable(registry.getComponent(componentName))
				),
				Option.getOrUndefined
			),
	};
}

export const getLayerService = (key: string): unknown => {
	if (!globalState.layerRegistry) {
		throw new LayerRuntimeNotInitializedError({ resource: `service "${key}"` });
	}
	return globalState.layerRegistry.getService(key);
};

export function getLayerComponent<K extends keyof EffuseComponentRegistry>(
	name: K
): EffuseComponentRegistry[K];
export function getLayerComponent(name: string): Component | undefined;
export function getLayerComponent(name: string): Component | undefined {
	if (!globalState.layerRegistry) {
		return undefined;
	}
	return globalState.layerRegistry.getComponent(name);
}
