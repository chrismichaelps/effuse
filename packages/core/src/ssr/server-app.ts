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
import type { LayerInputSource } from '../layers/api/defineLayer.js';
import type { RenderResult, ServerAppOptions, HeadProps } from './types.js';
import { renderToString, renderToFragment } from './render.js';
import { RenderError, createErrorHtml } from './errors.js';
import { headToHtml, mergeLayerHeads } from './head-registry.js';
import { runWithSSRContext } from './use-head.js';
import { serializeHydrationData, type HydrationData } from './hydration.js';
import {
	appendBodyTail,
	collectEntryAssets,
	renderEntryLinkTags,
	renderEntryScriptTags,
	splitTemplate,
	omitTemplateDeclaredScripts,
	DEFAULT_CONTAINER_ID,
} from './document.js';
import { escapeAttr } from './escape.js';
import { createSSRRuntime, type SSRRuntime } from './runtime.js';

export interface ServerApp {
	useLayers(layers: LayerInputSource): ServerApp;

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

/**
 * Yields a full macrotask so a ReadableStream flushes an already-enqueued chunk
 * to the consumer before the producer continues with synchronous work. Uses
 * `setImmediate` on Node and Bun for negligible latency, and `setTimeout` as
 * the portable fallback for other runtimes.
 */
const yieldMacrotask = (): Promise<void> =>
	new Promise<void>((resolve) => {
		if (typeof setImmediate === 'function') {
			setImmediate(resolve);
		} else {
			setTimeout(resolve, 0);
		}
	});

export const createServerApp = (root: Component): ServerApp => {
	let layers: LayerInputSource = [];
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
			const ssrRuntime = await createSSRRuntime(layers, {
				runSetup: true,
			});

			try {
				const result = ssrRuntime.run(() =>
					renderToString(root, url, ssrRuntime, options)
				);

				return result;
			} finally {
				await ssrRuntime.dispose();
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


				const containerId = options.containerId ?? DEFAULT_CONTAINER_ID;
				const assets = omitTemplateDeclaredScripts(
					collectEntryAssets(options.manifest, options.clientEntry),
					options.template
				);
				const entryScripts = renderEntryScriptTags(assets);

				return new ReadableStream<Uint8Array>({
					async start(controller) {
						try {
							// Deferred-head streaming: the head known before the render
							// (layer/static head) is enough to flush the document shell
							// immediately, so time-to-first-chunk is the shell-flush cost
							// and does not grow with body size. Head discovered during the
							// render via useHead() is carried in the hydration payload and
							// applied by the client head reconciler, the same tradeoff every
							// streaming renderer makes. renderToString keeps full head in
							// <head> for full-head SEO.
							const staticHead = mergeLayerHeads(runtime.headStack);
							const staticHeadHtml = `${headToHtml(staticHead)}${renderEntryLinkTags(assets)}`;
							const lang = staticHead.lang ?? 'en';

							// With a template, the document is the user's own: split it at
							// the render outlet so the shell flushes first and the tail —
							// including the template's client entry script — closes the
							// stream verbatim.
							const templateParts = options.template
								? splitTemplate(options.template, {
										headHtml: staticHeadHtml,
										bodyTailHtml: entryScripts,
										containerId,
										url,
									})
								: null;

							controller.enqueue(
								encoder.encode(
									templateParts
										? templateParts.shell
										: `<!DOCTYPE html>\n<html lang="${lang}">\n<head>\n\t${staticHeadHtml}\n</head>\n<body>\n\t<div id="${escapeAttr(containerId)}">`
								)
							);

							// Yield a full macrotask so the runtime writes the shell to
							// the consumer before the synchronous body render blocks the
							// event loop. A microtask is not enough: the render would
							// resume before any pending read drains. setImmediate keeps the
							// latency negligible on Node and Bun; setTimeout is the
							// portable fallback.
							await yieldMacrotask();

							const bodyHtml = runtime.run(() =>
								runWithSSRContext(
									{
										push: (head: HeadProps) => {
											runtime.headStack.push(head);
										},
									},
									() => renderToFragment(root, runtime, url)
								)
							);
							controller.enqueue(encoder.encode(bodyHtml));

							// Full head now includes anything useHead() collected during
							// render; it ships in the hydration payload for the client.
							const mergedHead = mergeLayerHeads(runtime.headStack);
							const serializedState: Record<string, unknown> = {};
							for (const [key, value] of runtime.state) {
								serializedState[key] = value;
							}

							const hydrationData: HydrationData = {
								head: mergedHead,
								state: serializedState,
								url,
							};
							const hydrationScript =
								options.hydrate !== false
									? serializeHydrationData(hydrationData)
									: '';

							controller.enqueue(
								encoder.encode(
									templateParts
										? appendBodyTail(templateParts.tail, hydrationScript)
										: `</div>${entryScripts}\n\t${hydrationScript}\n</body>\n</html>`
								)
							);
							controller.close();
						} catch (error) {
							controller.error(error);
						} finally {
							// Awaited, and its failure handled. `dispose` rethrows a
							// failing layer cleanup by design, so discarding the promise
							// left an unhandled rejection, which terminates the process on
							// Node 15 and later. The response is already streamed and the
							// controller closed, so this cannot reach the consumer;
							// reporting it matches how a failing request disposer is
							// handled in `request-scope.ts`.
							try {
								await runtime.dispose();
							} catch (disposeError) {
								// eslint-disable-next-line no-console
								console.error(
									'[effuse] SSR stream runtime disposal failed:',
									disposeError
								);
							}
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
