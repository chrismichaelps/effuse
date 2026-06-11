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
	ServerActionDefinition,
	ServerActionInput,
	ServerHandler,
	ServerMiddleware,
	ServerMethodHandlers,
	ServerRouteMetadata,
	ServerLayerDiagnostic,
	ServerRoute,
	ServerRouteDefinition,
	ServerRouteInput,
} from '../layers/types.js';

export type LayerServerRouteSource = 'api' | 'routes';

export interface LayerServerRouteEntry {
	readonly diagnostics: readonly ServerMetadataDiagnostic[];
	readonly layer: AnyResolvedLayer;
	readonly metadata?: ServerRouteMetadata;
	readonly source: LayerServerRouteSource;
	readonly route: ServerRoute;
}

export interface LayerServerActionEntry {
	readonly action: ServerActionDefinition;
	readonly diagnostics: readonly ServerMetadataDiagnostic[];
	readonly layer: AnyResolvedLayer;
	readonly metadata?: ServerRouteMetadata;
	readonly name: string;
}

export type ServerMetadataDiagnostic = ServerLayerDiagnostic;

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

const hasRouteDefinitionOptions = (
	input: Record<string, unknown>
): input is ServerRouteDefinition =>
	'handler' in input ||
	'metadata' in input ||
	'methods' in input ||
	'middleware' in input;

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

	const methods: ServerMethodHandlers = hasRouteDefinitionOptions(input)
		? { ...input.methods }
		: {};
	if (hasRouteDefinitionOptions(input) && input.handler) {
		methods.GET = input.handler;
	}
	for (const [method, handler] of Object.entries(input)) {
		const normalizedMethod = method.toUpperCase();
		if (isHttpMethod(normalizedMethod) && typeof handler === 'function') {
			methods[normalizedMethod] = handler as ServerHandler;
		}
	}

	return {
		path,
		methods,
		...(hasRouteDefinitionOptions(input) && input.metadata
			? { metadata: input.metadata }
			: {}),
		...(hasRouteDefinitionOptions(input) && input.middleware
			? { middleware: input.middleware }
			: {}),
	};
};

export const normalizeServerActionInput = (
	input: ServerActionInput
): ServerActionDefinition =>
	typeof input === 'function' ? { handler: input } : input;

const metadataEqual = (left: unknown, right: unknown): boolean =>
	JSON.stringify(left) === JSON.stringify(right);

const attachDiagnosticLayer = (
	layer: AnyResolvedLayer,
	diagnostic: ServerMetadataDiagnostic
): ServerMetadataDiagnostic => ({
	...diagnostic,
	layer: diagnostic.layer ?? layer.name,
});

const attachDiagnosticLayers = (
	layer: AnyResolvedLayer,
	diagnostics: readonly ServerMetadataDiagnostic[] | undefined
): readonly ServerMetadataDiagnostic[] =>
	(diagnostics ?? []).map((diagnostic) =>
		attachDiagnosticLayer(layer, diagnostic)
	);

export const mergeServerRouteMetadata = (
	layer: AnyResolvedLayer,
	target: string,
	routeMetadata?: ServerRouteMetadata
): {
	readonly diagnostics: readonly ServerMetadataDiagnostic[];
	readonly metadata?: ServerRouteMetadata;
} => {
	const layerMetadata = layer.server?.metadata;
	if (!layerMetadata) {
		return routeMetadata ? { metadata: routeMetadata, diagnostics: [] } : { diagnostics: [] };
	}
	if (!routeMetadata) {
		return { metadata: layerMetadata, diagnostics: [] };
	}

	const diagnostics: ServerMetadataDiagnostic[] = [];
	for (const key of Object.keys(routeMetadata) as (keyof ServerRouteMetadata)[]) {
		if (
			layerMetadata[key] !== undefined &&
			!metadataEqual(layerMetadata[key], routeMetadata[key])
		) {
			diagnostics.push({
				code: 'metadata_conflict',
				key,
				layer: layer.name,
				message: `Server metadata "${key}" on ${target} overrides layer metadata from ${layer.name}.`,
				target,
			});
		}
	}

	return {
		metadata: { ...layerMetadata, ...routeMetadata },
		diagnostics,
	};
};

export const getLayerServerRouteEntries = (
	layer: AnyResolvedLayer
): readonly LayerServerRouteEntry[] => {
	const routes: LayerServerRouteEntry[] = [];
	const api = layer.server?.api;

	if (Array.isArray(api)) {
		for (const route of api as readonly ServerRoute[]) {
			const {
				metadata,
				diagnostics: metadataDiagnostics,
			} = mergeServerRouteMetadata(
				layer,
				route.path,
				route.metadata
			);
			const diagnostics = [
				...attachDiagnosticLayers(layer, route.diagnostics),
				...metadataDiagnostics,
			];
			routes.push({ layer, source: 'api', route, metadata, diagnostics });
		}
	} else if (api) {
		for (const [path, input] of Object.entries(api)) {
			const route = normalizeServerRouteInput(path, input);
			const {
				metadata,
				diagnostics: metadataDiagnostics,
			} = mergeServerRouteMetadata(
				layer,
				route.path,
				route.metadata
			);
			const diagnostics = [
				...attachDiagnosticLayers(layer, route.diagnostics),
				...metadataDiagnostics,
			];
			routes.push({
				layer,
				source: 'api',
				route,
				metadata,
				diagnostics,
			});
		}
	}

	const serverRoutes = layer.server?.routes;
	if (serverRoutes) {
		for (const route of serverRoutes) {
			const {
				metadata,
				diagnostics: metadataDiagnostics,
			} = mergeServerRouteMetadata(
				layer,
				route.path,
				route.metadata
			);
			const diagnostics = [
				...attachDiagnosticLayers(layer, route.diagnostics),
				...metadataDiagnostics,
			];
			routes.push({ layer, source: 'routes', route, metadata, diagnostics });
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

export const getLayerServerActionEntries = (
	layer: AnyResolvedLayer
): readonly LayerServerActionEntry[] => {
	const actions = layer.server?.actions ?? {};
	return Object.entries(actions).map(([name, input]) => {
		const action = normalizeServerActionInput(input);
		const {
			metadata,
			diagnostics: metadataDiagnostics,
		} = mergeServerRouteMetadata(
			layer,
			name,
			action.metadata
		);
		const diagnostics = [
			...attachDiagnosticLayers(layer, action.diagnostics),
			...metadataDiagnostics,
		];
		return {
			action,
			diagnostics,
			layer,
			metadata,
			name,
		};
	});
};

export const getLayerServerMiddleware = (
	layer: AnyResolvedLayer
): readonly ServerMiddleware[] => layer.server?.middleware ?? [];

export const getLayerServerDiagnostics = (
	layer: AnyResolvedLayer
): readonly ServerMetadataDiagnostic[] =>
	attachDiagnosticLayers(layer, layer.server?.diagnostics);
