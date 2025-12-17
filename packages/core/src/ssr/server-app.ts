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
import type { HeadProps, RenderResult, ServerAppOptions } from './types.js';
import { renderToString } from './render.js';
import { RenderError, createErrorHtml } from './errors.js';

export interface ServerApp {
	useLayers(layers: readonly EffuseLayer[]): ServerApp;

	configure(options: ServerAppOptions): ServerApp;

	renderToString(url: string): Promise<RenderResult>;

	renderToHtml(url: string): Promise<string>;
}

export const createServerApp = (root: Component): ServerApp => {
	let layers: readonly EffuseLayer[] = [];
	let options: ServerAppOptions = { hydrate: true };

	const app: ServerApp = {
		useLayers(newLayers) {
			layers = newLayers;
			return app;
		},

		configure(newOptions) {
			options = { ...options, ...newOptions };
			return app;
		},

		async renderToString(url: string): Promise<RenderResult> {
			const layerHeads = collectLayerHeads(layers);

			const effect = renderToString(root, url, layerHeads);
			const result = await Effect.runPromise(effect);

			return result;
		},

		async renderToHtml(url: string): Promise<string> {
			try {
				const result = await app.renderToString(url);
				return result.html;
			} catch (error) {
				const renderError =
					error instanceof RenderError
						? error
						: new RenderError({
								message: String(error),
								url,
								cause: error,
							});
				return createErrorHtml(renderError);
			}
		},
	};

	return app;
};

const collectLayerHeads = (
	layers: readonly EffuseLayer[],
	visited = new Set<EffuseLayer>()
): HeadProps[] => {
	const heads: HeadProps[] = [];

	for (const layer of layers) {
		if (visited.has(layer)) continue;
		visited.add(layer);

		if (layer.extends) {
			heads.push(...collectLayerHeads(layer.extends, visited));
		}

		if (layer.head) {
			heads.push(layer.head);
		}
	}

	return heads;
};
