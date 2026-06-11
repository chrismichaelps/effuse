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

import type { AnyResolvedLayer, HttpMethod } from '../layers/types.js';
import {
	resolveLayerDefinitions,
	type LayerInputSource,
} from '../layers/api/defineLayer.js';
import { createLayerActionPath } from './actions.js';
import {
	getLayerServerRouteEntries,
	getServerRouteMethods,
	type LayerServerRouteSource,
} from './server-routes.js';

export interface LayerServerManifestRoute {
	readonly layer: string;
	readonly source: LayerServerRouteSource;
	readonly path: string;
	readonly methods: readonly HttpMethod[];
}

export interface LayerServerManifestAction {
	readonly layer: string;
	readonly name: string;
	readonly method: 'POST';
	readonly path: string;
	readonly legacyPath: string;
}

export interface LayerServerManifestLayer {
	readonly name: string;
	readonly routes: readonly LayerServerManifestRoute[];
	readonly actions: readonly LayerServerManifestAction[];
}

export interface LayerServerManifest {
	readonly layers: readonly LayerServerManifestLayer[];
	readonly routes: readonly LayerServerManifestRoute[];
	readonly actions: readonly LayerServerManifestAction[];
}

const createRouteManifest = (
	layer: AnyResolvedLayer
): readonly LayerServerManifestRoute[] =>
	getLayerServerRouteEntries(layer).map(({ route, source }) => ({
		layer: layer.name,
		source,
		path: route.path,
		methods: getServerRouteMethods(route),
	}));

const createActionManifest = (
	layer: AnyResolvedLayer
): readonly LayerServerManifestAction[] =>
	Object.keys(layer.server?.actions ?? {}).map((name) => ({
		layer: layer.name,
		name,
		method: 'POST' as const,
		path: createLayerActionPath(layer, name),
		legacyPath: createLayerActionPath(name),
	}));

export const createLayerServerManifestFromLayers = (
	layers: readonly AnyResolvedLayer[]
): LayerServerManifest => {
	const manifestLayers = layers.map((layer) => {
		const routes = createRouteManifest(layer);
		const actions = createActionManifest(layer);
		return {
			name: layer.name,
			routes,
			actions,
		};
	});

	return {
		layers: manifestLayers,
		routes: manifestLayers.flatMap((layer) => layer.routes),
		actions: manifestLayers.flatMap((layer) => layer.actions),
	};
};

export const createLayerServerManifest = (
	layers: LayerInputSource
): LayerServerManifest =>
	createLayerServerManifestFromLayers(resolveLayerDefinitions(layers));
