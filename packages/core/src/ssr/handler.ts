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
import type { EffuseLayer } from '../layers/types.js';
import type { RequestContext, ServerAppOptions } from './types.js';
import { createServerApp } from './server-app.js';

export interface HandlerConfig {
	root: Component;
	layers?: readonly EffuseLayer[];
	options?: ServerAppOptions;
	transform?: (req: Request) => Request;
	notFound?: () => Response;
}

export const createHandler = (config: HandlerConfig) => {
	const serverApp = createServerApp(config.root)
		.useLayers(config.layers ?? [])
		.configure(config.options ?? {});

	return async (request: Request): Promise<Response> => {
		try {
			const req = config.transform ? config.transform(request) : request;

			const url = new URL(req.url);
			const pathname = url.pathname;

			if (shouldSkip(pathname)) {
				return new Response(null, { status: 404 });
			}

			const html = await serverApp.renderToHtml(pathname);

			return new Response(html, {
				status: 200,
				headers: {
					'Content-Type': 'text/html; charset=utf-8',
					'Cache-Control': 'public, max-age=0, must-revalidate',
				},
			});
		} catch {
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
