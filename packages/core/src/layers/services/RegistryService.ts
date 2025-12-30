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

import { Effect } from 'effect';
import type { Component } from '../../render/node.js';
import type { AnyResolvedLayer } from '../types.js';

export interface LayerRegistry {
	readonly layers: Map<string, AnyResolvedLayer>;
	readonly components: Map<string, Component>;
	readonly services: Map<string, unknown>;

	getLayer: (name: string) => AnyResolvedLayer | undefined;
	getComponent: (name: string) => Component | undefined;
	getService: (key: string) => unknown;

	registerLayer: (layer: AnyResolvedLayer) => void;
	registerComponent: (name: string, component: Component) => void;
	registerService: (key: string, value: unknown) => void;

	hasLayer: (name: string) => boolean;
	hasComponent: (name: string) => boolean;
	hasService: (key: string) => boolean;
}

const createLayerRegistry = (): LayerRegistry => {
	const layers = new Map<string, AnyResolvedLayer>();
	const components = new Map<string, Component>();
	const services = new Map<string, unknown>();

	return {
		layers,
		components,
		services,

		getLayer: (name) => layers.get(name),
		getComponent: (name) => components.get(name),
		getService: (key) => services.get(key),

		registerLayer: (layer) => {
			if (layer.name) {
				layers.set(layer.name, layer);
			}
		},
		registerComponent: (name, component) => components.set(name, component),
		registerService: (key, value) => services.set(key, value),

		hasLayer: (name) => layers.has(name),
		hasComponent: (name) => components.has(name),
		hasService: (key) => services.has(key),
	};
};

export class RegistryService extends Effect.Service<RegistryService>()(
	'effuse/layer/Registry',
	{
		effect: Effect.succeed(createLayerRegistry()),
	}
) {}
