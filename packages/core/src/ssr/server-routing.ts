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
import { createSSRRuntime, type SSRRuntime } from './runtime.js';
import { createRequestScope, type RequestScope } from './request-scope.js';
import type { AnyServerRequestContract } from './request-contract.js';
import type { AnyServerValidator } from './validation.js';
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
	type LayerServerActionEntry,
	type LayerServerRouteEntry,
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
	validateServerValue,
} from './validation.js';
import { EFFUSE_ACTION_PREFIX } from './constants.js';
import type { ResponseCache } from './response-cache.js';
import type { CompiledServerMiddlewareGraph } from './middleware-graph.js';
import { runServerRequestPipeline } from './middleware-pipeline.js';
import {
	compareRoutePatterns,
	compileRoutePattern,
	matchRoutePattern,
} from '../routing/route-pattern.js';
import {
	createRouteTrie,
	isTrieRoutable,
	matchRouteTrie,
	type RouteTrie,
} from '../routing/route-trie.js';

interface MatchedServerHandler {
	readonly handler: ServerHandler;
	readonly kind: ServerTraceKind;
	readonly layer?: AnyResolvedLayer;
	readonly metadata?: ServerRouteMetadata;
	readonly middleware: readonly ServerMiddleware[];
	readonly params: Record<string, string>;
	readonly target: string;
	readonly allowedMethods: readonly HttpMethod[];
	readonly request?: AnyServerRequestContract;
	readonly response?: AnyServerValidator;
}

interface CompiledApiEntry {
	readonly allowedMethods: readonly HttpMethod[];
	readonly entry: LayerServerRouteEntry;
	readonly layer: AnyResolvedLayer;
	readonly path: string;
	readonly pattern: ReturnType<typeof compileRoutePattern>;
}

interface CompiledActionEntry {
	readonly entry: LayerServerActionEntry;
	readonly layer: AnyResolvedLayer;
}

interface CompiledLayerServerRouterData {
	readonly layers: readonly AnyResolvedLayer[];
	readonly routes: readonly CompiledApiEntry[];
	/**
	 * Prefix-tree index over `routes`, present only when every route is
	 * expressible in it. Lookups then cost O(path depth) instead of one regex
	 * per route; otherwise the linear scan preserves regex semantics.
	 */
	readonly trie: RouteTrie<CompiledApiEntry> | null;
	readonly qualifiedActions: ReadonlyMap<string, CompiledActionEntry>;
	readonly unqualifiedActions: ReadonlyMap<string, CompiledActionEntry>;
}

export interface CompiledLayerServerRouter {
	readonly kind: 'effuse-layer-server-router';
	readonly layerCount: number;
	readonly routeCount: number;
	readonly actionCount: number;
}

export type LayerServerRouterSource =
	| LayerInputSource
	| CompiledLayerServerRouter;

const compiledRouterData = new WeakMap<
	CompiledLayerServerRouter,
	CompiledLayerServerRouterData
>();

const isCompiledLayerServerRouter = (
	source: LayerServerRouterSource
): source is CompiledLayerServerRouter =>
	compiledRouterData.has(source as CompiledLayerServerRouter);

export const compileLayerServerRouter = (
	source: LayerServerRouterSource
): CompiledLayerServerRouter => {
	if (isCompiledLayerServerRouter(source)) return source;
	const layers = Object.freeze([...resolveLayerDefinitions(source)]);
	const routes = Object.freeze(
		layers
			.flatMap((layer, layerIndex) =>
				getLayerServerRouteEntries(layer).map((entry, routeIndex) => ({
					allowedMethods: Object.freeze([
						...getServerRouteMethods(entry.route),
					]),
					entry,
					layer,
					layerIndex,
					path: entry.route.path,
					pattern: compileRoutePattern(entry.route.path),
					routeIndex,
				}))
			)
			.sort((left, right) => {
				const specificity = compareRoutePatterns(
					left.pattern.pattern,
					right.pattern.pattern
				);
				if (specificity !== 0) return specificity;
				if (left.layerIndex !== right.layerIndex) {
					return left.layerIndex - right.layerIndex;
				}
				return left.routeIndex - right.routeIndex;
			})
			.map(({ allowedMethods, entry, layer, path, pattern }) =>
				Object.freeze({ allowedMethods, entry, layer, path, pattern })
			)
	);
	const qualifiedActions = new Map<string, CompiledActionEntry>();
	const unqualifiedActions = new Map<string, CompiledActionEntry>();
	const claimedLayerNames = new Set<string>();
	let actionCount = 0;
	for (const layer of layers) {
		const actions = getLayerServerActionEntries(layer);
		actionCount += actions.length;
		const ownsQualifiedName = !claimedLayerNames.has(layer.name);
		claimedLayerNames.add(layer.name);
		for (const entry of actions) {
			const compiled = Object.freeze({ entry, layer });
			if (!unqualifiedActions.has(entry.name)) {
				unqualifiedActions.set(entry.name, compiled);
			}
			if (ownsQualifiedName) {
				qualifiedActions.set(`${layer.name}\u0000${entry.name}`, compiled);
			}
		}
	}
	const router = Object.freeze({
		kind: 'effuse-layer-server-router' as const,
		layerCount: layers.length,
		routeCount: routes.length,
		actionCount,
	});
	// Index the sorted table into a prefix tree when every route is
	// expressible in it. Routes are already ordered by specificity, and the
	// trie descends static before param before catch-all, so it selects the
	// same winner the linear scan would.
	const trie = routes.every((route) => isTrieRoutable(route.pattern.pattern))
		? createRouteTrie(
				routes.map((route) => ({
					pattern: route.pattern.pattern,
					value: route,
				}))
			)
		: null;

	compiledRouterData.set(router, {
		layers,
		routes,
		trie,
		qualifiedActions,
		unqualifiedActions,
	});
	return router;
};

const getCompiledRouterData = (
	source: LayerServerRouterSource
): CompiledLayerServerRouterData => {
	const router = compileLayerServerRouter(source);
	const data = compiledRouterData.get(router);
	if (!data) throw new TypeError('Invalid Effuse compiled server router.');
	return data;
};

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

/**
 * Builds the matched handler for a route that already matched by path. Shared
 * by the trie fast path and the regex fallback so both produce identical
 * results, including the 405 response and its Allow header.
 */
const buildApiMatch = (
	{ allowedMethods, entry, layer, path }: CompiledApiEntry,
	params: Record<string, string>,
	method: HttpMethod
): MatchedServerHandler => {
	const route = entry.route;
	const handler = getHandlerForMethod(route, method);

	if (handler) {
		return {
			handler,
			kind: 'api',
			layer,
			metadata: entry.metadata,
			middleware: route.middleware ?? [],
			params,
			target: path,
			allowedMethods,
			...(route.request ? { request: route.request } : {}),
			...(route.response ? { response: route.response } : {}),
		};
	}

	return {
		handler: () =>
			new Response(null, {
				status: 405,
				headers: {
					Allow: allowedMethods.join(', '),
				},
			}),
		kind: 'api',
		layer,
		metadata: entry.metadata,
		middleware: route.middleware ?? [],
		params,
		target: path,
		allowedMethods,
	};
};

const findApiHandler = (
	request: Request,
	data: CompiledLayerServerRouterData
): MatchedServerHandler | null => {
	const url = new URL(request.url);
	const method = request.method.toUpperCase();
	if (!isHttpMethod(method)) {
		return null;
	}

	// Fast path: one O(depth) trie lookup instead of a regex per route.
	if (data.trie) {
		const found = matchRouteTrie(data.trie, url.pathname);
		if (!found) return null;
		return buildApiMatch(found.value, found.params, method);
	}

	for (const { allowedMethods, entry, layer, path, pattern } of data.routes) {
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
				target: path,
				allowedMethods,
				...(route.request ? { request: route.request } : {}),
				...(route.response ? { response: route.response } : {}),
			};
		}

		return {
			handler: () =>
				new Response(null, {
					status: 405,
					headers: {
						Allow: allowedMethods.join(', '),
					},
				}),
			kind: 'api',
			layer,
			metadata: entry.metadata,
			middleware: route.middleware ?? [],
			params,
			target: path,
			allowedMethods,
		};
	}

	return null;
};

const findActionHandler = (
	request: Request,
	data: CompiledLayerServerRouterData
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
		const compiled = data.qualifiedActions.get(
			`${layerName}\u0000${actionName}`
		);
		if (compiled) {
			const { entry: action, layer } = compiled;
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

	const compiled = data.unqualifiedActions.get(actionName);
	if (compiled) {
		const { entry: action, layer } = compiled;
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

export const normalizeServerResult = (
	result: ServerResult | void
): Response => {
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

	if (metadata.headers) {
		for (const [key, value] of Object.entries(metadata.headers)) {
			headers.set(key, value);
		}
	}
	if (metadata.renderMode) {
		headers.set('X-Effuse-Render-Mode', metadata.renderMode);
	}
	if (metadata.prerender !== undefined) {
		headers.set(
			'X-Effuse-Prerender',
			typeof metadata.prerender === 'object'
				? `revalidate=${String(metadata.prerender.revalidate ?? 0)}`
				: String(metadata.prerender)
		);
	}
	if (metadata.fallback !== undefined) {
		headers.set('X-Effuse-Fallback', String(metadata.fallback));
	}

	if (metadata.redirect) {
		headers.set('Location', metadata.redirect.to);
	}

	const status =
		metadata.redirect?.status ?? metadata.status ?? response.status;

	return new Response(response.body, {
		headers,
		status,
		statusText: response.statusText,
	});
};

/**
 * Validate a handler's result against the route's response contract. A mismatch
 * is a server-side bug, not a client error, so it fails closed with a stable 500
 * that reports the offending field paths only — the non-conforming payload is
 * never echoed back to the caller.
 *
 * A handler that returns a `Response` has taken over serialization and is left
 * alone; response contracts describe data results.
 */
const validateServerResponseContract = (
	result: ServerResult,
	validator: AnyServerValidator | undefined
): ServerResult => {
	if (!validator || result instanceof Response) {
		return result;
	}
	try {
		return validateServerValue('value', result, validator) as ServerResult;
	} catch (error) {
		if (isServerValidationError(error)) {
			throw new LayerServerError(
				'server_response_contract',
				'Server response did not match the route response contract.',
				{
					status: 500,
					details: {
						// Only the offending field paths cross the wire. Validator
						// messages embed the rejected value ("Expected number, actual
						// \"lots\""), which for a response contract is server-side data
						// the client must never see.
						issues: error.issues.map((issue) => ({
							path: issue.path,
							...(issue.code ? { code: issue.code } : {}),
						})),
					},
				}
			);
		}
		throw error;
	}
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
		let downstream: Response | undefined;
		const result = await current(ctx, async () => {
			if (called) {
				throw new Error(
					'Effuse server middleware called next() more than once.'
				);
			}
			called = true;
			downstream = await dispatch(index + 1);
			return downstream;
		});
		// A middleware that ran next() for its side effects but returned nothing
		// (the common "await next(); /* after-work */" shape) propagates the
		// downstream response rather than collapsing it into an empty 204.
		if ((result === undefined || result === null) && called && downstream) {
			return downstream;
		}
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
	source: LayerServerRouterSource
): MatchedServerHandler | null => {
	const data = getCompiledRouterData(source);
	return findActionHandler(request, data) ?? findApiHandler(request, data);
};

/**
 * Dispatch options. `cache` is deliberately opt-in: a route's `revalidate`
 * policy declares that its response *may* be cached (and always emits the CDN
 * headers), while supplying a cache says this process should also cache it.
 * A CDN-fronted deployment wants only the headers; a self-hosted one wants
 * both. Caching is never implicit — stale data that nobody asked for is the
 * failure mode every framework that cached by default had to reverse.
 */
export interface ServerDispatchOptions extends ServerObservabilityHooks {
	readonly cache?: ResponseCache;
	/**
	 * Compiled filesystem middleware. Runs *outside* the response cache so an
	 * authorization guard can never be bypassed by a cached response, and
	 * before contract parsing so handlers only ever see input that passed
	 * authentication.
	 */
	readonly middleware?: CompiledServerMiddlewareGraph;
}

export const handleLayerServerRequest = async (
	request: Request,
	source: LayerServerRouterSource,
	observability?: ServerDispatchOptions
): Promise<Response | null> => {
	const data = getCompiledRouterData(source);
	const layers = data.layers;
	const match =
		findActionHandler(request, data) ?? findApiHandler(request, data);
	if (!match) {
		return null;
	}

	// Matching is a cheap trie lookup, so it happens first; the cache then wraps
	// everything expensive after it — SSR runtime creation, middleware, and the
	// handler itself. A hit skips all of that rather than just the response
	// serialisation.
	const cache = observability?.cache;
	// Re-match inside the terminal because request-phase middleware may rewrite
	// the URL. The full middleware pipeline bounds rewrites and re-selects the
	// destination guards before this terminal is reached.
	const dispatch = (
		current: Request,
		requestScope?: Pick<RequestScope, 'locals' | 'defer'>
	): Promise<Response> => {
		const currentMatch =
			findActionHandler(current, data) ?? findApiHandler(current, data);
		if (!currentMatch) {
			return Promise.resolve(
				Response.json({ error: 'No Effuse handler matched.' }, { status: 404 })
			);
		}
		const invoke = () =>
			dispatchMatched(
				current,
				layers,
				currentMatch,
				observability,
				requestScope
			);
		// The cache sits inside middleware: a guard must reject before a cached
		// response can be served, otherwise an unauthenticated request could be
		// answered with an authenticated one.
		return cache
			? cache.handle(current, currentMatch.metadata?.cache, invoke)
			: invoke();
	};

	const graph = observability?.middleware;
	if (graph) {
		return runServerRequestPipeline(graph, {
			request,
			target: match.kind === 'action' ? 'action' : 'api',
			resolve: (current, context) => dispatch(current, context),
		});
	}

	return dispatch(request);
};

const dispatchMatched = async (
	request: Request,
	layers: readonly AnyResolvedLayer[],
	match: MatchedServerHandler,
	observability?: ServerObservabilityHooks,
	requestScope?: Pick<RequestScope, 'locals' | 'defer'>
): Promise<Response> => {
	const ownsScope = requestScope === undefined;
	const startedAt = performance.now();
	const timestamp = Date.now();
	let runtime: SSRRuntime | undefined;
	let scope: RequestScope | undefined;
	let response: Response | undefined;
	let handledError: unknown;
	const failures: unknown[] = [];

	try {
		const activeRuntime = await createSSRRuntime(layers, { runSetup: true });
		runtime = activeRuntime;
		const activeScope: RequestScope = requestScope
			? { ...requestScope, runDisposers: async () => undefined }
			: createRequestScope();
		scope = activeScope;
		response = await activeRuntime.run(async () => {
			const ctx = createContext(
				request,
				activeRuntime.layers,
				match.params,
				activeScope
			);
			const middleware = collectServerMiddleware(
				activeRuntime.layers,
				match.layer,
				match.middleware
			);
			const response = await runServerMiddleware(ctx, middleware, async () => {
				// Contracts parse after middleware so auth and other cross-cutting
				// concerns still run first, and before the handler so it only ever
				// sees validated input.
				const handlerCtx = match.request
					? { ...ctx, input: await match.request.parse(ctx) }
					: ctx;
				const result = await match.handler(handlerCtx);
				return normalizeServerResult(
					validateServerResponseContract(result, match.response)
				);
			});
			return applyServerMetadata(response, match.metadata);
		});
	} catch (error) {
		handledError = error;
		if (isLayerServerError(error)) {
			response = layerServerErrorResponse(error);
		} else if (isServerValidationError(error)) {
			response = serverValidationErrorResponse(error);
		} else {
			failures.push(error);
		}
	}

	if (runtime) {
		// Run request-scoped disposers inside the runtime scope so they can still
		// reach scoped services. Runtime disposal remains independent so a failing
		// request cleanup can never strand the layer runtime.
		const activeScope = scope;
		if (ownsScope && activeScope) {
			try {
				await runtime.run(() => activeScope.runDisposers());
			} catch (error) {
				failures.push(error);
			}
		}
		try {
			await runtime.dispose();
		} catch (error) {
			failures.push(error);
		}
	}

	if (!response && failures.length === 0) {
		failures.push(
			new Error(
				'[Effuse] Server route completed without a response or failure.'
			)
		);
	}

	const failure =
		failures.length > 1
			? new AggregateError(
					failures,
					'[Effuse] Server route execution and cleanup failed.'
				)
			: failures[0];
	const status = failures.length > 0 ? 500 : (response?.status ?? 500);
	emitServerTrace(observability, {
		durationMs: performance.now() - startedAt,
		...(failures.length > 0 || handledError !== undefined
			? { error: createServerTraceError(failure ?? handledError) }
			: {}),
		kind: match.kind,
		layer: match.layer?.name,
		method: request.method.toUpperCase(),
		ok: failures.length === 0 && (response?.ok ?? false),
		path: new URL(request.url).pathname,
		route: match.kind === 'api' ? match.target : undefined,
		status,
		target: match.target,
		timestamp,
	});

	if (failures.length > 0) throw failure;
	return response!;
};
