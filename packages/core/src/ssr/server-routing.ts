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
	ServerMiddleware,
	ServerRouteMetadata,
	ServerResult,
	ServerRoute,
} from '../layers/types.js';
import { getLayerService } from '../layers/context.js';
import {
	resolveLayerDefinitions,
	type LayerInputSource,
} from '../layers/api/defineLayer.js';
import { createSSRRuntime } from './runtime.js';
import { createRequestScope, type RequestScope } from './request-scope.js';
import {
	createServerTraceError,
	emitServerTrace,
	type ServerObservabilityHooks,
	type ServerTraceKind,
} from './observability.js';
import {
	getLayerServerActionEntries,
	getLayerServerMiddleware,
	getLayerServerRouteEntries,
	getServerRouteMethods,
	isHttpMethod,
} from './server-routes.js';
import {
	isLayerServerError,
	LayerServerError,
	layerServerErrorResponse,
} from './server-errors.js';
import {
	createServerValidationHelpers,
	isServerValidationError,
	serverValidationErrorResponse,
} from './validation.js';
import { EFFUSE_ACTION_PREFIX } from './constants.js';
import {
	compareRoutePatterns,
	compileRoutePattern,
	matchRoutePattern,
} from '../routing/route-pattern.js';

interface MatchedServerHandler {
	readonly handler: ServerHandler;
	readonly kind: ServerTraceKind;
	readonly layer?: AnyResolvedLayer;
	readonly metadata?: ServerRouteMetadata;
	readonly middleware: readonly ServerMiddleware[];
	readonly params: Record<string, string>;
	readonly target: string;
	readonly allowedMethods: readonly HttpMethod[];
}

interface LayerWithServiceKeys {
	readonly serviceKeys: readonly string[];
}

const hasServiceKeys = (
	layer: AnyResolvedLayer
): layer is AnyResolvedLayer & LayerWithServiceKeys =>
	'serviceKeys' in layer &&
	Array.isArray((layer as { readonly serviceKeys?: unknown }).serviceKeys);

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

	const entries = layers
		.flatMap((layer, layerIndex) =>
			getLayerServerRouteEntries(layer).map((entry, routeIndex) => ({
				entry,
				layer,
				layerIndex,
				routeIndex,
				pattern: compileRoutePattern(entry.route.path),
			}))
		)
		.sort((left, right) => {
			const specificity = compareRoutePatterns(
				left.pattern.pattern,
				right.pattern.pattern
			);
			if (specificity !== 0) {
				return specificity;
			}
			if (left.layerIndex !== right.layerIndex) {
				return left.layerIndex - right.layerIndex;
			}
			return left.routeIndex - right.routeIndex;
		});

	for (const { entry, layer, pattern } of entries) {
		const route = entry.route;
		const params = matchRoutePattern(pattern, url.pathname);
		if (!params) continue;

		const handler = getHandlerForMethod(route, method);
		if (handler) {
			return {
				handler,
				kind: 'api',
				layer,
				metadata: entry.metadata,
				middleware: route.middleware ?? [],
				params,
				target: route.path,
				allowedMethods: getServerRouteMethods(route),
			};
		}

		return {
			handler: () =>
				new Response(null, {
					status: 405,
					headers: {
						Allow: getServerRouteMethods(route).join(', '),
					},
				}),
			kind: 'api',
			layer,
			metadata: entry.metadata,
			middleware: route.middleware ?? [],
			params,
			target: route.path,
			allowedMethods: getServerRouteMethods(route),
		};
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

	const actionSegments = splitPath(
		url.pathname.slice(EFFUSE_ACTION_PREFIX.length)
	);
	const decodedSegments = actionSegments.map(decodeSegment);
	const layerName = decodedSegments.length > 1 ? decodedSegments[0] : undefined;
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
			kind: 'action',
			middleware: [],
			params: { action: actionName },
			target: actionName,
			allowedMethods: ['POST'],
		};
	}

	if (layerName) {
		const layer = layers.find((candidate) => candidate.name === layerName);
		const action = layer
			? getLayerServerActionEntries(layer).find(
					(candidate) => candidate.name === actionName
				)
			: undefined;
		if (layer && action) {
			return {
				handler: action.action.handler,
				kind: 'action',
				layer,
				metadata: action.metadata,
				middleware: action.action.middleware ?? [],
				params: { layer: layerName, action: actionName },
				target: actionName,
				allowedMethods: ['POST'],
			};
		}
		return null;
	}

	for (const layer of layers) {
		const action = getLayerServerActionEntries(layer).find(
			(candidate) => candidate.name === actionName
		);
		if (action) {
			return {
				handler: action.action.handler,
				kind: 'action',
				layer,
				metadata: action.metadata,
				middleware: action.action.middleware ?? [],
				params: { action: actionName },
				target: actionName,
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

const metadataHeaderValue = (
	value: boolean | number | string | readonly string[] | undefined
): string | undefined => {
	if (value === undefined) {
		return undefined;
	}
	if (Array.isArray(value)) {
		return value.join(', ');
	}
	return String(value);
};

const applyServerMetadata = (
	response: Response,
	metadata: ServerRouteMetadata | undefined
): Response => {
	if (!metadata) {
		return response;
	}

	const headers = new Headers(response.headers);
	const cache = metadata.cache;
	if (cache?.cacheControl) {
		headers.set('Cache-Control', cache.cacheControl);
	} else if (cache?.revalidate === false) {
		headers.set('Cache-Control', 'no-store');
	} else if (typeof cache?.revalidate === 'number') {
		headers.set(
			'Cache-Control',
			`s-maxage=${String(cache.revalidate)}, stale-while-revalidate`
		);
	}
	if (cache?.tags && cache.tags.length > 0) {
		headers.set('X-Effuse-Cache-Tags', cache.tags.join(', '));
	}

	const cors = metadata.cors;
	const origin =
		cors?.origin === true ? '*' : metadataHeaderValue(cors?.origin);
	if (origin) {
		headers.set('Access-Control-Allow-Origin', origin);
	}
	const methods = cors?.methods?.join(', ');
	if (methods) {
		headers.set('Access-Control-Allow-Methods', methods);
	}
	const allowedHeaders = cors?.headers?.join(', ');
	if (allowedHeaders) {
		headers.set('Access-Control-Allow-Headers', allowedHeaders);
	}
	if (cors?.credentials !== undefined) {
		headers.set('Access-Control-Allow-Credentials', String(cors.credentials));
	}
	if (cors?.maxAge !== undefined) {
		headers.set('Access-Control-Max-Age', String(cors.maxAge));
	}

	const runtime = metadataHeaderValue(metadata.runtime);
	if (runtime) {
		headers.set('X-Effuse-Runtime', runtime);
	}
	const region = metadataHeaderValue(metadata.region);
	if (region) {
		headers.set('X-Effuse-Region', region);
	}
	if (metadata.maxDuration !== undefined) {
		headers.set('X-Effuse-Max-Duration', String(metadata.maxDuration));
	}

	return new Response(response.body, {
		headers,
		status: response.status,
		statusText: response.statusText,
	});
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

const collectMiddlewareLayers = (
	layers: readonly AnyResolvedLayer[],
	targetLayer: AnyResolvedLayer
): readonly AnyResolvedLayer[] => {
	const byName = new Map(layers.map((layer) => [layer.name, layer]));
	const selected = new Set<string>();
	const ordered: AnyResolvedLayer[] = [];
	const visit = (layer: AnyResolvedLayer): void => {
		if (selected.has(layer.name)) {
			return;
		}
		selected.add(layer.name);
		for (const depName of (layer.dependencies as
			| readonly string[]
			| undefined) ?? []) {
			const dependency = byName.get(depName);
			if (dependency) {
				visit(dependency);
			}
		}
		ordered.push(layer);
	};

	visit(targetLayer);
	return ordered;
};

const collectServerMiddleware = (
	layers: readonly AnyResolvedLayer[],
	targetLayer: AnyResolvedLayer | undefined,
	handlerMiddleware: readonly ServerMiddleware[]
): readonly ServerMiddleware[] => {
	if (!targetLayer) {
		return handlerMiddleware;
	}
	return [
		...collectMiddlewareLayers(layers, targetLayer).flatMap((layer) =>
			getLayerServerMiddleware(layer)
		),
		...handlerMiddleware,
	];
};

const runServerMiddleware = async (
	ctx: ServerLayerContext,
	middleware: readonly ServerMiddleware[],
	handler: () => Promise<Response>
): Promise<Response> => {
	const dispatch = async (index: number): Promise<Response> => {
		if (index >= middleware.length) {
			return handler();
		}
		const current = middleware[index];
		let called = false;
		const result = await current(ctx, async () => {
			if (called) {
				throw new Error(
					'Effuse server middleware called next() more than once.'
				);
			}
			called = true;
			return dispatch(index + 1);
		});
		return normalizeServerResult(result);
	};

	return dispatch(0);
};

const createContext = (
	request: Request,
	layers: readonly AnyResolvedLayer[],
	params: Record<string, string>,
	scope: RequestScope
): ServerLayerContext => {
	const url = new URL(request.url);
	const { services, layerServices } = collectServices(layers);
	const query = parseQuery(url);

	return {
		request,
		url,
		params,
		query,
		services,
		layerServices,
		locals: scope.locals,
		defer: scope.defer,
		getService: <T = unknown>(key: string): T | undefined =>
			getLayerService(key) as T | undefined,
		json: <T = unknown>() => request.json() as Promise<T>,
		text: () => request.text(),
		formData: () => request.formData(),
		validate: createServerValidationHelpers(request, params, query),
		response: {
			json: <T>(data: T, init?: ResponseInit) => Response.json(data, init),
			text: (body: string, init?: ResponseInit) =>
				new Response(body, withContentType(init, 'text/plain; charset=utf-8')),
			redirect: (target: string | URL, status = 302) =>
				Response.redirect(target, status),
			error: (code, message, options) =>
				layerServerErrorResponse(new LayerServerError(code, message, options)),
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
	rawLayers: LayerInputSource,
	observability?: ServerObservabilityHooks
): Promise<Response | null> => {
	const layers = resolveLayerDefinitions(rawLayers);
	const match = matchLayerServerRequest(request, layers);
	if (!match) {
		return null;
	}

	const runtime = await createSSRRuntime(layers, { runSetup: true });
	const scope = createRequestScope();
	const startedAt = performance.now();
	const timestamp = Date.now();

	try {
		return await runtime.run(async () => {
			const ctx = createContext(request, runtime.layers, match.params, scope);
			const middleware = collectServerMiddleware(
				runtime.layers,
				match.layer,
				match.middleware
			);
			const response = await runServerMiddleware(ctx, middleware, async () =>
				normalizeServerResult(await match.handler(ctx))
			);
			const tracedResponse = applyServerMetadata(response, match.metadata);
			emitServerTrace(observability, {
				durationMs: performance.now() - startedAt,
				kind: match.kind,
				layer: match.layer?.name,
				method: request.method.toUpperCase(),
				ok: tracedResponse.ok,
				path: new URL(request.url).pathname,
				route: match.kind === 'api' ? match.target : undefined,
				status: tracedResponse.status,
				target: match.target,
				timestamp,
			});
			return tracedResponse;
		});
	} catch (error) {
		const createErrorTrace = (status: number): void => {
			emitServerTrace(observability, {
				durationMs: performance.now() - startedAt,
				error: createServerTraceError(error),
				kind: match.kind,
				layer: match.layer?.name,
				method: request.method.toUpperCase(),
				ok: false,
				path: new URL(request.url).pathname,
				route: match.kind === 'api' ? match.target : undefined,
				status,
				target: match.target,
				timestamp,
			});
		};
		if (isLayerServerError(error)) {
			createErrorTrace(error.status);
			return layerServerErrorResponse(error);
		}
		if (isServerValidationError(error)) {
			createErrorTrace(error.status);
			return serverValidationErrorResponse(error);
		}
		createErrorTrace(500);
		throw error;
	} finally {
		// Run request-scoped disposers inside the runtime scope so they can still
		// reach scoped services, before the runtime itself is torn down.
		await runtime.run(() => scope.runDisposers());
		await runtime.dispose();
	}
};
