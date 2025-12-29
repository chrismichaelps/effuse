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

import type {
	AnyLayer,
	AnyResolvedLayer,
	RouteConfig,
	Guard,
	MergedConfig,
	LayerSetupFn,
	PluginFn,
	StoreConfig,
} from '../types.js';
import { CircularDependencyError } from '../errors.js';
import type { Component } from '../../render/node.js';

export const resolveLayerOrder = (
	layers: readonly AnyLayer[],
	visited = new Set<AnyLayer>(),
	path: string[] = []
): AnyResolvedLayer[] => {
	const resolved: AnyResolvedLayer[] = [];
	let order = 0;

	for (const layer of layers) {
		const layerName = layer.name;

		if (visited.has(layer)) {
			throw new CircularDependencyError({
				layerName,
				dependencyChain: path,
			});
		}

		visited.add(layer);

		if (layer.extends && layer.extends.length > 0) {
			const extended = resolveLayerOrder(layer.extends, visited, [
				...path,
				layerName,
			]);
			resolved.push(...extended);
			order = extended.length;
		}

		resolved.push({
			...layer,
			_resolved: true,
			_order: order++,
		});
	}

	return resolved;
};

export const prefixRoutes = (
	routes: readonly RouteConfig[],
	domain: string
): RouteConfig[] => {
	return routes.map((route): RouteConfig => {
		const prefixed: RouteConfig = {
			...route,
			path: `/${domain}${route.path === '/' ? '' : route.path}`,
		};

		if (route.children && route.children.length > 0) {
			return { ...prefixed, children: prefixRoutes(route.children, domain) };
		}

		return prefixed;
	});
};

export const mergeLayerConfigs = (
	layers: readonly AnyResolvedLayer[]
): MergedConfig => {
	const routes: RouteConfig[] = [];
	const guards: Guard[] = [];
	const stores: StoreConfig[] = [];
	const providers: Component[] = [];
	const plugins: PluginFn[] = [];
	const setups: LayerSetupFn[] = [];

	for (const layer of layers) {
		if (layer.routes) {
			const layerRoutes = layer.domain
				? prefixRoutes(layer.routes, layer.domain)
				: [...layer.routes];
			routes.push(...layerRoutes);
		}

		if (layer.routeOptions?.guards) {
			guards.push(...layer.routeOptions.guards);
		}

		if (layer.stores) {
			stores.push(...layer.stores);
		}

		if (layer.providers) {
			providers.push(...layer.providers);
		}

		if (layer.plugins) {
			plugins.push(...layer.plugins);
		}

		if (layer.setup) {
			setups.push(layer.setup);
		}
	}

	return {
		routes,
		guards,
		stores,
		providers,
		plugins,
		setups,
		lazy: layers.some((l) => l.routeOptions?.lazy === true),
	};
};
