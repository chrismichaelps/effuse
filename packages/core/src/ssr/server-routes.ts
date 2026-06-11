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

import type {
	AnyResolvedLayer,
	HttpMethod,
	ServerHandler,
	ServerMethodHandlers,
	ServerRoute,
	ServerRouteInput,
} from '../layers/types.js';

export type LayerServerRouteSource = 'api' | 'routes';

export interface LayerServerRouteEntry {
	readonly layer: AnyResolvedLayer;
	readonly source: LayerServerRouteSource;
	readonly route: ServerRoute;
}

const HTTP_METHODS = new Set<HttpMethod>([
	'GET',
	'POST',
	'PUT',
	'PATCH',
	'DELETE',
	'OPTIONS',
	'HEAD',
]);

export const isHttpMethod = (method: string): method is HttpMethod =>
	HTTP_METHODS.has(method as HttpMethod);

const isRecord = (value: unknown): value is Record<string, unknown> =>
	typeof value === 'object' && value !== null;

const isServerRoute = (value: unknown): value is ServerRoute =>
	isRecord(value) && typeof value.path === 'string' && isRecord(value.methods);

export const normalizeServerRouteInput = (
	path: string,
	input: ServerRouteInput
): ServerRoute => {
	if (isServerRoute(input)) {
		return input;
	}

	if (typeof input === 'function') {
		return { path, methods: { GET: input } };
	}

	const methods: ServerMethodHandlers = {};
	for (const [method, handler] of Object.entries(input)) {
		const normalizedMethod = method.toUpperCase();
		if (isHttpMethod(normalizedMethod) && typeof handler === 'function') {
			methods[normalizedMethod] = handler as ServerHandler;
		}
	}

	return { path, methods };
};

export const getLayerServerRouteEntries = (
	layer: AnyResolvedLayer
): readonly LayerServerRouteEntry[] => {
	const routes: LayerServerRouteEntry[] = [];
	const api = layer.server?.api;

	if (Array.isArray(api)) {
		for (const route of api as readonly ServerRoute[]) {
			routes.push({ layer, source: 'api', route });
		}
	} else if (api) {
		for (const [path, input] of Object.entries(api)) {
			routes.push({
				layer,
				source: 'api',
				route: normalizeServerRouteInput(path, input),
			});
		}
	}

	const serverRoutes = layer.server?.routes;
	if (serverRoutes) {
		for (const route of serverRoutes) {
			routes.push({ layer, source: 'routes', route });
		}
	}

	return routes;
};

export const getLayerServerRoutes = (
	layer: AnyResolvedLayer
): readonly ServerRoute[] =>
	getLayerServerRouteEntries(layer).map((entry) => entry.route);

export const getServerRouteMethods = (
	route: ServerRoute
): readonly HttpMethod[] => Object.keys(route.methods).filter(isHttpMethod);
