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

import { Layer } from 'effect';
import type {
	EffuseLayer,
	ResolvedLayer,
	RouteConfig,
	Guard,
} from './types.js';
import {
	RouterService,
	StoreService,
	ProviderService,
	PluginService,
	type RouterConfig,
	type StoreServiceConfig,
	type ProviderConfig,
	type PluginConfig,
} from './services.js';

export const resolveLayerExtends = (
	layers: readonly EffuseLayer[],
	visited = new Set<EffuseLayer>()
): ResolvedLayer[] => {
	const resolved: ResolvedLayer[] = [];

	for (const layer of layers) {
		if (visited.has(layer)) {
			throw new Error(
				`[Effuse] Layer cycle detected: ${layer.name ?? 'unnamed'}`
			);
		}

		visited.add(layer);

		if (layer.extends && layer.extends.length > 0) {
			resolved.push(...resolveLayerExtends(layer.extends, visited));
		}

		resolved.push({ ...layer, _resolved: true });
	}

	return resolved;
};

const prefixRoutes = (
	routes: readonly RouteConfig[],
	domain: string
): RouteConfig[] => {
	return routes.map((route) => {
		const prefixed: RouteConfig = {
			...route,
			path: `/${domain}${route.path === '/' ? '' : route.path}`,
		};
		if (route.children) {
			return { ...prefixed, children: prefixRoutes(route.children, domain) };
		}
		return prefixed;
	});
};

export const mergeLayerConfigs = (
	layers: readonly ResolvedLayer[]
): {
	router: RouterConfig;
	stores: StoreServiceConfig;
	providers: ProviderConfig;
	plugins: PluginConfig;
} => {
	const allRoutes: RouteConfig[] = [];
	const allGuards: Guard[] = [];
	const allStores: StoreServiceConfig['stores'][number][] = [];
	const allProviders: ProviderConfig['providers'][number][] = [];
	const allPlugins: PluginConfig['plugins'][number][] = [];

	for (const layer of layers) {
		if (layer.routes) {
			const routes = layer.domain
				? prefixRoutes(layer.routes, layer.domain)
				: [...layer.routes];
			allRoutes.push(...routes);
		}

		if (layer.routeOptions && layer.routeOptions.guards) {
			allGuards.push(...layer.routeOptions.guards);
		}

		if (layer.stores) {
			allStores.push(...layer.stores);
		}

		if (layer.providers) {
			allProviders.push(...layer.providers);
		}

		if (layer.plugins) {
			allPlugins.push(...layer.plugins);
		}
	}

	return {
		router: {
			routes: allRoutes,
			lazy: layers.some((l) => l.routeOptions?.lazy),
			guards: allGuards,
		},
		stores: { stores: allStores },
		providers: { providers: allProviders },
		plugins: { plugins: allPlugins },
	};
};

export const defineLayer = (
	def: EffuseLayer
): Layer.Layer<
	RouterService | StoreService | ProviderService | PluginService
> => {
	const resolved: ResolvedLayer = { ...def, _resolved: true };
	const configs = mergeLayerConfigs([resolved]);

	return Layer.mergeAll(
		Layer.succeed(RouterService, configs.router),
		Layer.succeed(StoreService, configs.stores),
		Layer.succeed(ProviderService, configs.providers),
		Layer.succeed(PluginService, configs.plugins)
	);
};

export const combineLayers = (
	...layers: readonly EffuseLayer[]
): Layer.Layer<
	RouterService | StoreService | ProviderService | PluginService
> => {
	const resolved = resolveLayerExtends(layers);
	const configs = mergeLayerConfigs(resolved);

	return Layer.mergeAll(
		Layer.succeed(RouterService, configs.router),
		Layer.succeed(StoreService, configs.stores),
		Layer.succeed(ProviderService, configs.providers),
		Layer.succeed(PluginService, configs.plugins)
	);
};
