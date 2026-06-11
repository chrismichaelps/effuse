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
	ServerLayerContext,
	ServerMethodHandlers,
	ServerResult,
	ServerRoute,
	ServerRouteInput,
} from '../layers/types.js';
import { getLayerService } from '../layers/context.js';
import {
	resolveLayerDefinitions,
	type LayerInputSource,
} from '../layers/api/defineLayer.js';
import { createSSRRuntime } from './runtime.js';

export const EFFUSE_ACTION_PREFIX = '/_effuse/actions/';

const HTTP_METHODS = new Set<HttpMethod>([
	'GET',
	'POST',
	'PUT',
	'PATCH',
	'DELETE',
	'OPTIONS',
	'HEAD',
]);

interface MatchedServerHandler {
	readonly handler: ServerHandler;
	readonly params: Record<string, string>;
	readonly allowedMethods: readonly HttpMethod[];
}

interface LayerWithServiceKeys {
	readonly serviceKeys: readonly string[];
}

const isHttpMethod = (method: string): method is HttpMethod =>
	HTTP_METHODS.has(method as HttpMethod);

const isRecord = (value: unknown): value is Record<string, unknown> =>
	typeof value === 'object' && value !== null;

const isServerRoute = (value: unknown): value is ServerRoute =>
	isRecord(value) && typeof value.path === 'string' && isRecord(value.methods);

const hasServiceKeys = (
	layer: AnyResolvedLayer
): layer is AnyResolvedLayer & LayerWithServiceKeys =>
	'serviceKeys' in layer &&
	Array.isArray((layer as { readonly serviceKeys?: unknown }).serviceKeys);

const toRoute = (path: string, input: ServerRouteInput): ServerRoute => {
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

const getLayerRoutes = (layer: AnyResolvedLayer): readonly ServerRoute[] => {
	const routes: ServerRoute[] = [];
	const api = layer.server?.api;

	if (Array.isArray(api)) {
		for (const route of api as readonly ServerRoute[]) {
			routes.push(route);
		}
	} else if (api) {
		for (const [path, input] of Object.entries(api)) {
			routes.push(toRoute(path, input));
		}
	}

	const serverRoutes = layer.server?.routes;
	if (serverRoutes) {
		for (const route of serverRoutes) {
			routes.push(route);
		}
	}

	return routes;
};

const splitPath = (path: string): readonly string[] => {
	const trimmed = path.replace(/^\/+|\/+$/g, '');
	return trimmed.length > 0 ? trimmed.split('/') : [];
};

const decodeSegment = (segment: string): string => {
	try {
		return decodeURIComponent(segment);
	} catch {
		return segment;
	}
};

const matchRoutePath = (
	routePath: string,
	pathname: string
): Record<string, string> | null => {
	if (routePath === '*' || routePath === '/*') {
		return {};
	}

	const routeSegments = splitPath(routePath);
	const requestSegments = splitPath(pathname);
	const catchAllIndex = routeSegments.findIndex(
		(segment) => segment.startsWith('[...') && segment.endsWith(']')
	);

	if (catchAllIndex === -1 && routeSegments.length !== requestSegments.length) {
		return null;
	}

	if (catchAllIndex !== -1 && requestSegments.length < catchAllIndex) {
		return null;
	}

	const params: Record<string, string> = {};

	for (let i = 0; i < routeSegments.length; i++) {
		const routeSegment = routeSegments[i];
		const requestSegment = requestSegments[i];

		if (routeSegment.startsWith('[...') && routeSegment.endsWith(']')) {
			const name = routeSegment.slice(4, -1);
			params[name] = requestSegments.slice(i).map(decodeSegment).join('/');
			return params;
		}

		if (routeSegment.startsWith(':')) {
			params[routeSegment.slice(1)] = decodeSegment(requestSegment);
			continue;
		}

		if (routeSegment.startsWith('[') && routeSegment.endsWith(']')) {
			params[routeSegment.slice(1, -1)] = decodeSegment(requestSegment);
			continue;
		}

		if (routeSegment !== requestSegment) {
			return null;
		}
	}

	return routeSegments.length === requestSegments.length ? params : null;
};

const getHandlerForMethod = (
	route: ServerRoute,
	method: HttpMethod
): ServerHandler | undefined => {
	if (method === 'HEAD') {
		return route.methods.HEAD ?? route.methods.GET;
	}
	return route.methods[method];
};

const findApiHandler = (
	request: Request,
	layers: readonly AnyResolvedLayer[]
): MatchedServerHandler | null => {
	const url = new URL(request.url);
	const method = request.method.toUpperCase();
	if (!isHttpMethod(method)) {
		return null;
	}

	for (const layer of layers) {
		for (const route of getLayerRoutes(layer)) {
			const params = matchRoutePath(route.path, url.pathname);
			if (!params) continue;

			const handler = getHandlerForMethod(route, method);
			if (handler) {
				return {
					handler,
					params,
					allowedMethods: Object.keys(route.methods) as HttpMethod[],
				};
			}

			return {
				handler: () =>
					new Response(null, {
						status: 405,
						headers: {
							Allow: Object.keys(route.methods).join(', '),
						},
					}),
				params,
				allowedMethods: Object.keys(route.methods) as HttpMethod[],
			};
		}
	}

	return null;
};

const findActionHandler = (
	request: Request,
	layers: readonly AnyResolvedLayer[]
): MatchedServerHandler | null => {
	const url = new URL(request.url);
	if (!url.pathname.startsWith(EFFUSE_ACTION_PREFIX)) {
		return null;
	}

	const actionSegments = splitPath(url.pathname.slice(EFFUSE_ACTION_PREFIX.length));
	const decodedSegments = actionSegments.map(decodeSegment);
	const layerName =
		decodedSegments.length > 1 ? decodedSegments[0] : undefined;
	const actionName =
		decodedSegments.length > 1
			? decodedSegments.slice(1).join('/')
			: decodedSegments[0];

	if (!actionName) {
		return null;
	}

	if (request.method.toUpperCase() !== 'POST') {
		return {
			handler: () =>
				new Response(null, {
					status: 405,
					headers: { Allow: 'POST' },
				}),
			params: { action: actionName },
			allowedMethods: ['POST'],
		};
	}

	if (layerName) {
		const layer = layers.find((candidate) => candidate.name === layerName);
		const handler = layer?.server?.actions?.[actionName];
		if (handler) {
			return {
				handler,
				params: { layer: layerName, action: actionName },
				allowedMethods: ['POST'],
			};
		}
		return null;
	}

	for (const layer of layers) {
		const handler = layer.server?.actions?.[actionName];
		if (handler) {
			return {
				handler,
				params: { action: actionName },
				allowedMethods: ['POST'],
			};
		}
	}

	return null;
};

const parseQuery = (url: URL): Record<string, string> => {
	const query: Record<string, string> = {};
	url.searchParams.forEach((value, key) => {
		query[key] = value;
	});
	return query;
};

const withContentType = (
	init: ResponseInit | undefined,
	contentType: string
): ResponseInit => {
	const headers = new Headers(init?.headers);
	if (!headers.has('Content-Type')) {
		headers.set('Content-Type', contentType);
	}
	return { ...init, headers };
};

const isBodyInit = (value: unknown): value is BodyInit =>
	typeof value === 'string' ||
	value instanceof Blob ||
	value instanceof FormData ||
	value instanceof URLSearchParams ||
	value instanceof ArrayBuffer ||
	ArrayBuffer.isView(value) ||
	value instanceof ReadableStream;

export const normalizeServerResult = (result: ServerResult): Response => {
	if (result instanceof Response) {
		return result;
	}

	if (result === undefined || result === null) {
		return new Response(null, { status: 204 });
	}

	if (isBodyInit(result)) {
		return new Response(result);
	}

	return Response.json(result);
};

const collectServices = (
	layers: readonly AnyResolvedLayer[]
): {
	readonly services: Record<string, unknown>;
	readonly layerServices: Record<string, Record<string, unknown>>;
} => {
	const services: Record<string, unknown> = {};
	const layerServices: Record<string, Record<string, unknown>> = {};

	for (const layer of layers) {
		const serviceKeys = new Set([
			...(hasServiceKeys(layer) ? layer.serviceKeys : []),
			...Object.keys(layer.provides ?? {}),
		]);

		const entries: Record<string, unknown> = {};
		for (const key of serviceKeys) {
			const value = getLayerService(key);
			services[key] = value;
			entries[key] = value;
		}
		layerServices[layer.name] = entries;
	}

	return { services, layerServices };
};

const createContext = (
	request: Request,
	layers: readonly AnyResolvedLayer[],
	params: Record<string, string>
): ServerLayerContext => {
	const url = new URL(request.url);
	const { services, layerServices } = collectServices(layers);

	return {
		request,
		url,
		params,
		query: parseQuery(url),
		services,
		layerServices,
		// eslint-disable-next-line @typescript-eslint/no-unnecessary-type-parameters -- call sites choose the expected service shape.
		getService: <T = unknown>(key: string): T | undefined =>
			getLayerService(key) as T | undefined,
		json: <T = unknown>() => request.json() as Promise<T>,
		text: () => request.text(),
		formData: () => request.formData(),
		response: {
			// eslint-disable-next-line @typescript-eslint/no-unnecessary-type-parameters -- preserves the response payload type for helper users.
			json: <T>(data: T, init?: ResponseInit) => Response.json(data, init),
			text: (body: string, init?: ResponseInit) =>
				new Response(body, withContentType(init, 'text/plain; charset=utf-8')),
			redirect: (target: string | URL, status = 302) =>
				Response.redirect(target, status),
		},
	};
};

export const matchLayerServerRequest = (
	request: Request,
	layers: readonly AnyResolvedLayer[]
): MatchedServerHandler | null =>
	findActionHandler(request, layers) ?? findApiHandler(request, layers);

export const handleLayerServerRequest = async (
	request: Request,
	rawLayers: LayerInputSource
): Promise<Response | null> => {
	const layers = resolveLayerDefinitions(rawLayers);
	const match = matchLayerServerRequest(request, layers);
	if (!match) {
		return null;
	}

	const runtime = await createSSRRuntime(layers, { runSetup: true });

	try {
		return await runtime.run(async () => {
			const ctx = createContext(request, runtime.layers, match.params);
			const result = await match.handler(ctx);
			return normalizeServerResult(result);
		});
	} finally {
		await runtime.dispose();
	}
};
