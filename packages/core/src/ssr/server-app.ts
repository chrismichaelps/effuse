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
import type { CompiledLayer } from '../layers/api/defineLayer.js';
import type { RenderResult, ServerAppOptions, HeadProps } from './types.js';
import { renderToString, renderToFragment } from './render.js';
import { RenderError, createErrorHtml } from './errors.js';
import { headToHtml } from './head-registry.js';
import { runWithSSRContext } from './use-head.js';
import { serializeHydrationData, type HydrationData } from './hydration.js';
import { createSSRRuntime, type SSRRuntime } from './runtime.js';

export interface ServerApp {
	useLayers(layers: readonly (AnyLayer | CompiledLayer<any>)[]): ServerApp;

	configure(options: ServerAppOptions): ServerApp;

	renderToString(url: string): Promise<RenderResult>;

	renderToHtml(url: string): Promise<string>;

	/**
	 * Streaming SSR — returns a `ReadableStream<string>` that
	 * flushes the HTML shell (head + opening tags) immediately,
	 * then streams the rendered body, then closes with hydration data.
	 *
	 *
	 * This optimizes Time-To-First-Byte (TTFB) by sending the
	 * `<head>` and CSS before the body is fully rendered.
	 */
	renderToStream(url: string): Promise<ReadableStream<Uint8Array>>;
}

export const createServerApp = (root: Component): ServerApp => {
	let layers: readonly (AnyLayer | CompiledLayer<any>)[] = [];
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
			let ssrRuntime: SSRRuntime | null = null;

			try {
				ssrRuntime = await createSSRRuntime(layers, {
					runSetup: true,
				});

				const result = renderToString(root, url, ssrRuntime, options);

				return result;
			} finally {
				if (ssrRuntime) {
					await ssrRuntime.dispose();
				}
			}
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

		async renderToStream(url: string): Promise<ReadableStream<Uint8Array>> {
			let ssrRuntime: SSRRuntime | null = null;
			const encoder = new TextEncoder();

			try {
				ssrRuntime = await createSSRRuntime(layers, {
					runSetup: true,
				});

				const runtime = ssrRuntime;

				return new ReadableStream<Uint8Array>({
					start(controller) {
						try {
							// 1. Render body fragment inside SSR context
							const bodyHtml = runWithSSRContext(
								{
									push: (head: HeadProps) => {
										runtime.headStack.push(head);
									},
								},
								() => renderToFragment(root, runtime)
							);

							// 2. Merge all collected heads
							const mergedHead = runtime.headStack.reduce<HeadProps>(
								(acc, head) => ({ ...acc, ...head }),
								{}
							);

							let headHtml = headToHtml(mergedHead);
							const lang = mergedHead.lang ?? 'en';

							// If manifest is provided, inject preload/styles for the main entry point
							if (options.manifest) {
								for (const [key, chunk] of Object.entries(options.manifest)) {
									if (chunk.isEntry) {
										// Preload JS Entry
										headHtml += `\n\t<link rel="modulepreload" crossorigin href="/${chunk.file}">`;
										// Inject CSS
										if (chunk.css) {
											for (const cssFile of chunk.css) {
												headHtml += `\n\t<link rel="stylesheet" href="/${cssFile}">`;
											}
										}
									}
								}
							}

							// 3. Serialize state for hydration
							const serializedState: Record<string, unknown> = {};
							for (const [key, value] of runtime.state) {
								serializedState[key] = value;
							}

							const hydrationData: HydrationData = {
								head: mergedHead,
								state: serializedState,
								url,
								timestamp: Date.now(),
							};

							const hydrationScript = options.hydrate !== false ? serializeHydrationData(hydrationData) : '';

							// 4. Stream in order: shell → body → hydration → close
							controller.enqueue(encoder.encode(`<!DOCTYPE html>\n<html lang="${lang}">\n<head>\n\t${headHtml}\n</head>\n<body>\n\t<div id="app">`));
							controller.enqueue(encoder.encode(bodyHtml));
							controller.enqueue(encoder.encode(`</div>\n\t${hydrationScript}\n</body>\n</html>`));
							controller.close();
						} catch (error) {
							controller.error(error);
						} finally {
							void runtime.dispose();
						}
					},
				});
			} catch (error) {
				// If runtime creation fails, still release the lock
				if (ssrRuntime) {
					await ssrRuntime.dispose();
				}
				throw error;
			}
		},
	};

	return app;
};
