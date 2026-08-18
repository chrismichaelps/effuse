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
import { buildCacheControl } from './cache-control.js';
import {
	layerInputSourceToList,
	type LayerInputSource,
} from '../layers/api/defineLayer.js';
import type { RequestContext, ServerAppOptions } from './types.js';
import type { ServerTraceEvent } from './observability.js';
import { createServerApp } from './server-app.js';
import { RenderError, createErrorHtml } from './errors.js';
import { createHash } from 'node:crypto';
import {
	compileLayerServerRouter,
	handleLayerServerRequest,
	type CompiledLayerServerRouter,
} from './server-routing.js';

export interface HandlerConfig {
	root: Component;
	layers?: LayerInputSource;
	options?: ServerAppOptions;
	transform?: (req: Request) => Request;
	notFound?: () => Response;
	/** Cache-Control max-age for successful renders. Defaults to 0. */
	cacheMaxAge?: number;
	/** Cache-Control s-maxage for CDN caching. Defaults to undefined (not set). */
	cacheSMaxAge?: number;
	/**
	 * Window in which a CDN may serve a stale response while it refreshes.
	 *
	 * This is what keeps an origin cold start away from users: the edge answers
	 * from cache immediately and revalidates behind the response. Setting it
	 * drops `must-revalidate`, which forbids exactly the stale serving this
	 * asks for; pass `cacheMustRevalidate` to override that.
	 */
	cacheStaleWhileRevalidate?: number;
	/** Window in which a CDN may serve a stale response after an origin error. */
	cacheStaleIfError?: number;
	/** `public` or `private`. Defaults to `public`. */
	cacheVisibility?: 'public' | 'private';
	/** Defaults to true, or false when `cacheStaleWhileRevalidate` is set. */
	cacheMustRevalidate?: boolean;
	/** Emit `no-store` and drop every other cache directive. */
	cacheNoStore?: boolean;
	/** Literal `Cache-Control` value, overriding every option above. */
	cacheControl?: string;
	/** Optional error handler for logging/monitoring. Called before returning 500. */
	onError?: (error: unknown, request: Request) => void;
	onServerTrace?: (event: ServerTraceEvent) => void;
	onServerTraceError?: (error: unknown, event: ServerTraceEvent) => void;
}

type LayerServerDispatcher = (
	request: Request,
	hooks: Pick<HandlerConfig, 'onServerTrace' | 'onServerTraceError'>
) => Promise<Response | null> | null;

const createLayerServerDispatcher = (
	layers: LayerInputSource
): LayerServerDispatcher | undefined => {
	if (layerInputSourceToList(layers).length === 0) return undefined;

	let serverRouter: CompiledLayerServerRouter | undefined;
	let hasServerHandlers: boolean | undefined;
	return (request, hooks) => {
		if (hasServerHandlers === false) return null;
		serverRouter ??= compileLayerServerRouter(layers);
		hasServerHandlers ??=
			serverRouter.routeCount > 0 || serverRouter.actionCount > 0;
		if (!hasServerHandlers) return null;
		return handleLayerServerRequest(request, serverRouter, {
			onTrace: hooks.onServerTrace,
			onTraceError: hooks.onServerTraceError,
		});
	};
};

export const createHandler = (config: HandlerConfig) => {
	const layers = config.layers ?? [];
	const dispatchServerRequest = createLayerServerDispatcher(layers);
	const serverApp = createServerApp(config.root)
		.useLayers(layers)
		.configure(config.options ?? {});

	return async (request: Request): Promise<Response> => {
		let req = request;
		try {
			req = config.transform ? config.transform(request) : request;

			const url = new URL(req.url);
			const pathname = url.pathname;

			const serverDispatch = dispatchServerRequest?.(req, config);
			if (serverDispatch) {
				const serverResponse = await serverDispatch;
				if (serverResponse) return serverResponse;
			}

			if (shouldSkip(pathname)) {
				return new Response(null, { status: 404 });
			}

			let html: string;
			try {
				html = (await serverApp.renderToString(pathname)).html;
			} catch (error) {
				if (!(error instanceof RenderError)) throw error;
				reportError(config, error, req, 'Render');
				return new Response(createErrorHtml(error), {
					status: 500,
					headers: {
						'Content-Type': 'text/html; charset=utf-8',
						'Cache-Control': 'no-store',
						'X-Content-Type-Options': 'nosniff',
					},
				});
			}

			// Compute ETag from content hash
			const hash = createHash('md5').update(html).digest('hex');
			const etag = `"${hash}"`;

			// Check If-None-Match for conditional requests
			const ifNoneMatch = req.headers.get('If-None-Match');
			if (ifNoneMatch === etag) {
				return new Response(null, {
					status: 304,
					headers: { ETag: etag },
				});
			}

			// `must-revalidate` forbids serving stale once expired, which is what
			// `stale-while-revalidate` exists to do, so asking for one drops the
			// other unless the caller says otherwise.
			const cacheControl =
				config.cacheControl ??
				buildCacheControl({
					noStore: config.cacheNoStore,
					visibility: config.cacheVisibility ?? 'public',
					maxAge: config.cacheMaxAge ?? 0,
					sMaxAge: config.cacheSMaxAge,
					staleWhileRevalidate: config.cacheStaleWhileRevalidate,
					staleIfError: config.cacheStaleIfError,
					mustRevalidate:
						config.cacheMustRevalidate ??
						config.cacheStaleWhileRevalidate === undefined,
				});

			return new Response(html, {
				status: 200,
				headers: {
					'Content-Type': 'text/html; charset=utf-8',
					'Content-Length': String(new TextEncoder().encode(html).byteLength),
					'Cache-Control': cacheControl,
					ETag: etag,
					'X-Content-Type-Options': 'nosniff',
				},
			});
		} catch (error) {
			reportError(config, error, req, 'Render');
			return new Response(
				`<!DOCTYPE html><html><head><title>Error</title></head><body><h1>Server Error</h1></body></html>`,
				{
					status: 500,
					headers: { 'Content-Type': 'text/html; charset=utf-8' },
				}
			);
		}
	};
};

/**
 * Streaming handler — returns responses with `Transfer-Encoding: chunked`
 * for optimal Time-To-First-Byte. The `<head>` and CSS are sent before
 * the body is fully rendered.
 *
 * Use this when TTFB is critical (e.g., large pages, slow data fetching).
 */
export const createStreamingHandler = (config: HandlerConfig) => {
	const layers = config.layers ?? [];
	const dispatchServerRequest = createLayerServerDispatcher(layers);
	const serverApp = createServerApp(config.root)
		.useLayers(layers)
		.configure(config.options ?? {});

	return async (request: Request): Promise<Response> => {
		let req = request;
		try {
			req = config.transform ? config.transform(request) : request;

			const url = new URL(req.url);
			const pathname = url.pathname;

			const serverDispatch = dispatchServerRequest?.(req, config);
			if (serverDispatch) {
				const serverResponse = await serverDispatch;
				if (serverResponse) return serverResponse;
			}

			if (shouldSkip(pathname)) {
				return new Response(null, { status: 404 });
			}

			const stream = await serverApp.renderToStream(pathname);

			return new Response(stream as unknown as BodyInit, {
				status: 200,
				headers: {
					'Content-Type': 'text/html; charset=utf-8',
					'Transfer-Encoding': 'chunked',
					'X-Content-Type-Options': 'nosniff',
				},
			});
		} catch (error) {
			reportError(config, error, req, 'Streaming render');
			return new Response(
				`<!DOCTYPE html><html><head><title>Error</title></head><body><h1>Server Error</h1></body></html>`,
				{
					status: 500,
					headers: { 'Content-Type': 'text/html; charset=utf-8' },
				}
			);
		}
	};
};

const reportError = (
	config: HandlerConfig,
	error: unknown,
	request: Request,
	operation: string
): void => {
	if (config.onError) {
		try {
			config.onError(error, request);
			return;
		} catch (reportingError) {
			// eslint-disable-next-line no-console
			console.error('[effuse-ssr] onError callback failed:', reportingError);
		}
	}
	// eslint-disable-next-line no-console
	console.error(`[effuse-ssr] ${operation} error:`, error);
};

const shouldSkip = (pathname: string): boolean => {
	const staticExtensions = [
		'.js',
		'.css',
		'.json',
		'.ico',
		'.png',
		'.jpg',
		'.jpeg',
		'.gif',
		'.svg',
		'.webp',
		'.woff',
		'.woff2',
		'.ttf',
		'.eot',
		'.map',
		'.txt',
		'.xml',
		'.webmanifest',
	];

	return staticExtensions.some((ext) => pathname.endsWith(ext));
};

export const parseQuery = (url: URL): Record<string, string> => {
	const query: Record<string, string> = {};
	url.searchParams.forEach((value, key) => {
		query[key] = value;
	});
	return query;
};

export const createRequestContext = (
	request: Request,
	params: Record<string, string> = {}
): RequestContext => {
	const url = new URL(request.url);
	return {
		request,
		url,
		params,
		query: parseQuery(url),
	};
};
