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

import { Predicate } from 'effect';
import type { Component } from '../render/node.js';
import type { AnyLayer, AnyResolvedLayer } from '../layers/types.js';
import {
	type CompiledLayer,
	createLayerRuntime,
	type LayerRuntime,
	type LayerRuntimeOptions,
	type LayerInputSource,
	resolveLayerDefinitions,
} from '../layers/index.js';
import { mount as mountComponent, type Canvas } from '../canvas/canvas.js';

export interface AppInstance {
	unmount: () => Promise<void>;
}

export type MountOptions = LayerRuntimeOptions;

export type AppLayerInput = AnyLayer | CompiledLayer<any>;

export type LazyAppLayerInput =
	| AppLayerInput
	| (() => Promise<AppLayerInput>);

export type AppLayerSource =
	| readonly LazyAppLayerInput[]
	| Readonly<Record<string, LazyAppLayerInput>>;

const appLayerSourceToList = (
	layers: AppLayerSource
): readonly LazyAppLayerInput[] =>
	Array.isArray(layers)
		? layers
		: (Object.values(layers) as readonly LazyAppLayerInput[]);

export class BaseEffuseApp {
	protected layers: LayerInputSource = [];
	protected readonly rootComponent: Component;
	private layerRuntime: LayerRuntime | null = null;
	private mountedCanvas: Canvas | null = null;
	private activeMountId: number | null = null;
	private nextMountId = 1;

	constructor(root: Component) {
		this.rootComponent = root;
	}

	async useLayers(layers: AppLayerSource): Promise<this> {
		const resolved = await Promise.all(
			appLayerSourceToList(layers).map((l) =>
				Predicate.isFunction(l) ? l() : Promise.resolve(l)
			)
		);
		this.layers = resolved;
		return this;
	}

	async mount(
		selector: string,
		options: MountOptions = {}
	): Promise<AppInstance> {
		const resolvedLayers = resolveLayerDefinitions(this.layers);
		await this.cleanup();
		const mountId = this.nextMountId++;
		this.activeMountId = mountId;
		this.layers = resolvedLayers;

		try {
			this.layerRuntime = await createLayerRuntime(
				resolvedLayers as AnyResolvedLayer[],
				options
			);
			this.mountedCanvas = mountComponent(this.rootComponent, selector);
		} catch (error) {
			if (this.activeMountId === mountId) {
				await this.cleanup();
			}
			throw error;
		}

		return {
			unmount: async () => {
				if (this.activeMountId === mountId) {
					await this.cleanup();
				}
			},
		};
	}

	private async cleanup(): Promise<void> {
		const canvas = this.mountedCanvas;
		const layerRuntime = this.layerRuntime;
		let cleanupError: unknown;

		this.mountedCanvas = null;
		this.layerRuntime = null;
		this.activeMountId = null;

		if (canvas) {
			try {
				canvas.dispose();
			} catch (error) {
				cleanupError = error;
			}
		}

		if (layerRuntime) {
			try {
				await layerRuntime.dispose();
			} catch (error) {
				cleanupError ??= error;
			}
		}

		if (cleanupError) {
			throw cleanupError;
		}
	}
}
