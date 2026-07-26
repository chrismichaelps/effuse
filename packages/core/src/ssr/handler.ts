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
import type { RequestContext, ServerAppOptions } from './types.js';
import type { ServerTraceEvent } from './observability.js';
import { createServerApp } from './server-app.js';
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
	/** Optional error handler for logging/monitoring. Called before returning 500. */
	onError?: (error: unknown, request: Request) => void;
	onServerTrace?: (event: ServerTraceEvent) => void;
	onServerTraceError?: (error: unknown, event: ServerTraceEvent) => void;
}

export const createHandler = (config: HandlerConfig) => {
	let serverRouter: CompiledLayerServerRouter | undefined;
	const getServerRouter = (): CompiledLayerServerRouter =>
		(serverRouter ??= compileLayerServerRouter(config.layers ?? []));
	const serverApp = createServerApp(config.root)
		.useLayers(config.layers ?? [])
		.configure(config.options ?? {});

	return async (request: Request): Promise<Response> => {
		let req = request;
		try {
			req = config.transform ? config.transform(request) : request;

			const url = new URL(req.url);
			const pathname = url.pathname;

			const serverResponse = await handleLayerServerRequest(
				req,
				getServerRouter(),
				{
					onTrace: config.onServerTrace,
					onTraceError: config.onServerTraceError,
				}
			);
			if (serverResponse) {
				return serverResponse;
			}

			if (shouldSkip(pathname)) {
				return new Response(null, { status: 404 });
			}

			const html = await serverApp.renderToHtml(pathname);

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

			// Build Cache-Control header
			const cacheDirectives: string[] = ['public'];
			cacheDirectives.push(`max-age=${String(config.cacheMaxAge ?? 0)}`);
			if (config.cacheSMaxAge !== undefined) {
				cacheDirectives.push(`s-maxage=${String(config.cacheSMaxAge)}`);
			}
			cacheDirectives.push('must-revalidate');

			return new Response(html, {
				status: 200,
				headers: {
					'Content-Type': 'text/html; charset=utf-8',
					'Content-Length': String(new TextEncoder().encode(html).byteLength),
					'Cache-Control': cacheDirectives.join(', '),
					ETag: etag,
					'X-Content-Type-Options': 'nosniff',
				},
			});
		} catch (error) {
			if (config.onError) {
				config.onError(error, req);
			} else {
				// eslint-disable-next-line no-console
				console.error('[effuse-ssr] Render error:', error);
			}
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
	let serverRouter: CompiledLayerServerRouter | undefined;
	const getServerRouter = (): CompiledLayerServerRouter =>
		(serverRouter ??= compileLayerServerRouter(config.layers ?? []));
	const serverApp = createServerApp(config.root)
		.useLayers(config.layers ?? [])
		.configure(config.options ?? {});

	return async (request: Request): Promise<Response> => {
		let req = request;
		try {
			req = config.transform ? config.transform(request) : request;

			const url = new URL(req.url);
			const pathname = url.pathname;

			const serverResponse = await handleLayerServerRequest(
				req,
				getServerRouter(),
				{
					onTrace: config.onServerTrace,
					onTraceError: config.onServerTraceError,
				}
			);
			if (serverResponse) {
				return serverResponse;
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
			if (config.onError) {
				config.onError(error, req);
			} else {
				// eslint-disable-next-line no-console
				console.error('[effuse-ssr] Streaming render error:', error);
			}
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
