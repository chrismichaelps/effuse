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
import type { Component } from '../render/node.js';
import type { EffuseLayer } from '../layers/types.js';
import {
	combineLayers,
	RouterService,
	StoreService,
	StyleService,
	ProviderService,
	PluginService,
	type PluginConfig,
} from '../layers/index.js';
import { mount as mountComponent } from '../canvas/canvas.js';

export interface AppInstance {
	unmount: () => void;
}

export class EffuseApp {
	private layers: EffuseLayer[] = [];
	private rootComponent: Component;
	private styleElement: HTMLStyleElement | null = null;
	private cleanups: (() => void)[] = [];

	constructor(root: Component) {
		this.rootComponent = root;
	}

	async useLayers(
		layers: (EffuseLayer | (() => Promise<EffuseLayer>))[]
	): Promise<this> {
		const resolved = await Promise.all(
			layers.map((l) => (typeof l === 'function' ? l() : Promise.resolve(l)))
		);
		this.layers = resolved;
		return this;
	}

	async mount(selector: string): Promise<AppInstance> {
		const combinedLayer = combineLayers(...this.layers);

		const program = Effect.gen(function* () {
			const router = yield* RouterService;
			const stores = yield* StoreService;
			const styles = yield* StyleService;
			const providers = yield* ProviderService;
			const plugins = yield* PluginService;

			return { router, stores, styles, providers, plugins };
		});

		const configs = await Effect.runPromise(
			Effect.provide(program, combinedLayer)
		);

		this.installStyles(configs.styles.styles);

		await this.runPlugins(configs.plugins);

		mountComponent(this.rootComponent, selector);

		return {
			unmount: () => {
				this.cleanup();
			},
		};
	}

	private installStyles(styles: readonly (string | (() => string))[]): void {
		if (styles.length === 0) return;

		const css = styles
			.map((s) => (typeof s === 'function' ? s() : s))
			.join('\n\n');

		this.styleElement = document.createElement('style');
		this.styleElement.setAttribute('data-effuse-layers', 'true');
		this.styleElement.textContent = css;
		document.head.appendChild(this.styleElement);
	}

	private async runPlugins(config: PluginConfig): Promise<void> {
		for (const plugin of config.plugins) {
			const result = await Promise.resolve(plugin());
			if (typeof result === 'function') {
				this.cleanups.push(result);
			}
		}
	}

	private cleanup(): void {
		for (const cleanup of this.cleanups) {
			cleanup();
		}
		this.cleanups = [];

		if (this.styleElement) {
			this.styleElement.remove();
			this.styleElement = null;
		}
	}
}
