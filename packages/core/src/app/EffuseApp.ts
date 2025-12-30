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

import type { Component } from '../render/node.js';
import type { AnyLayer } from '../layers/types.js';
import {
	combineLayers,
	createLayerRuntime,
	type LayerRuntime,
	type LayerRuntimeOptions,
} from '../layers/index.js';
import { mount as mountComponent } from '../canvas/canvas.js';

export interface AppInstance {
	unmount: () => Promise<void>;
}

export type MountOptions = LayerRuntimeOptions;

export class EffuseApp {
	private layers: AnyLayer[] = [];
	private rootComponent: Component;
	private layerRuntime: LayerRuntime | null = null;

	constructor(root: Component) {
		this.rootComponent = root;
	}

	async useLayers(
		layers: (AnyLayer | (() => Promise<AnyLayer>))[]
	): Promise<this> {
		const resolved = await Promise.all(
			layers.map((l) => (typeof l === 'function' ? l() : Promise.resolve(l)))
		);
		this.layers = resolved;
		return this;
	}

	async mount(selector: string, options: MountOptions = {}): Promise<AppInstance> {
		const combined = combineLayers(...this.layers);

		this.layerRuntime = await createLayerRuntime(combined.layers, options);

		mountComponent(this.rootComponent, selector);

		return {
			unmount: async () => {
				await this.cleanup();
			},
		};
	}

	private async cleanup(): Promise<void> {
		if (this.layerRuntime) {
			await this.layerRuntime.dispose();
			this.layerRuntime = null;
		}
	}
}
