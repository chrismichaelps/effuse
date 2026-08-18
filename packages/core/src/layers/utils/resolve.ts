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

import { Array as Arr, pipe, Option } from 'effect';
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
import {
	CircularDependencyError,
	DependencyNotFoundError,
	LayerNameCollisionError,
} from '../errors.js';
import type { Component } from '../../render/node.js';
import { getLayerDependencyNames } from './dependencies.js';

export const resolveLayerOrder = (
	layers: readonly AnyLayer[]
): AnyResolvedLayer[] => {
	const resolved: AnyResolvedLayer[] = [];
	const state = new Map<AnyLayer, 'visiting' | 'visited'>();
	const owners = new Map<string, AnyLayer>();
	const seen = new Set<string>();

	const visit = (layer: AnyLayer, path: string[]): void => {
		const layerName = layer.name;
		const currentState = state.get(layer);

		if (currentState === 'visiting') {
			throw new CircularDependencyError({
				layerName,
				dependencyChain: path,
			});
		}

		if (currentState === 'visited') {
			return;
		}

		const owner = owners.get(layerName);
		if (owner && owner !== layer) {
			throw new LayerNameCollisionError({ layerName });
		}
		owners.set(layerName, layer);

		state.set(layer, 'visiting');
		if (layer.extends && layer.extends.length > 0) {
			for (const extended of layer.extends) {
				visit(extended, [...path, layerName]);
			}
		}

		state.set(layer, 'visited');

		if (!seen.has(layerName)) {
			seen.add(layerName);
			resolved.push({
				...layer,
				_resolved: true,
				_order: resolved.length,
			});
		}
	};

	for (const layer of layers) {
		visit(layer, []);
	}

	for (const layer of resolved) {
		for (const dependencyName of getLayerDependencyNames(layer)) {
			if (!owners.has(dependencyName)) {
				throw new DependencyNotFoundError({
					layerName: layer.name,
					dependencyName,
				});
			}
		}
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

		pipe(
			Option.fromNullable(layer.routeOptions),
			Option.flatMap((opts) => Option.fromNullable(opts.guards)),
			Option.map((layerGuards) => {
				guards.push(...layerGuards);
			})
		);

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
		lazy: Arr.some(layers, (l) =>
			pipe(
				Option.fromNullable(l.routeOptions),
				Option.flatMap((opts) => Option.fromNullable(opts.lazy)),
				Option.getOrElse(() => false)
			)
		),
	};
};
