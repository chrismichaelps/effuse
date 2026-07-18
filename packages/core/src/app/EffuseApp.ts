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

import { createServerApp, type ServerApp } from '../ssr/server-app.js';
import { createStreamingHandler } from '../ssr/handler.js';
import type { RenderResult, ServerAppOptions } from '../ssr/types.js';
import {
	BaseEffuseApp,
	type AppInstance,
	type MountOptions,
	type AppLayerInput,
	type LazyAppLayerInput,
	type AppLayerSource,
} from './BaseEffuseApp.js';

export type {
	AppInstance,
	MountOptions,
	AppLayerInput,
	LazyAppLayerInput,
	AppLayerSource,
};

export class EffuseApp extends BaseEffuseApp {
	/**
	 * Render the app to a full HTML string for SSR.
	 *
	 * Uses the same root component and layers configured via `useLayers()`.
	 * This is the server-side equivalent of `mount()`.
	 *
	 * ```ts
	 * // Server entry
	 * const app = new EffuseApp(App);
	 * await app.useLayers([ThemeLayer, RouterLayer]);
	 * const { html } = await app.renderToString('/about');
	 * ```
	 */
	async renderToString(url: string): Promise<RenderResult> {
		return this.getServerApp().renderToString(url);
	}

	/**
	 * Render the app to HTML string, with error fallback.
	 * Returns error HTML on failure instead of throwing.
	 */
	async renderToHtml(url: string): Promise<string> {
		return this.getServerApp().renderToHtml(url);
	}

	/**
	 * Streaming SSR — returns a `ReadableStream<Uint8Array>` for
	 * optimal Time-To-First-Byte. Flushes the `<head>` immediately,
	 * then streams the body, then closes with hydration data.
	 */
	async renderToStream(url: string): Promise<ReadableStream<Uint8Array>> {
		return this.getServerApp().renderToStream(url);
	}

	/**
	 * Handle a Fetch API request with layer-owned API routes/actions first,
	 * then stream the app shell as SSR fallback.
	 */
	async handleRequest(
		request: Request,
		options: ServerAppOptions = {}
	): Promise<Response> {
		const handler = createStreamingHandler({
			root: this.rootComponent,
			layers: this.layers,
			options,
		});
		return handler(request);
	}

	/**
	 * Get the underlying ServerApp for advanced SSR configuration.
	 */
	getServerApp(): ServerApp {
		return createServerApp(this.rootComponent).useLayers(this.layers);
	}
}
