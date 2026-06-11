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

import type { HttpMethod } from '../layers/types.js';
import {
	callLayerAction,
	type LayerActionCallOptions,
	type LayerActionResponseMode,
} from './actions.js';
import type {
	LayerServerManifest,
	LayerServerManifestAction,
	LayerServerManifestRoute,
} from './manifest.js';

export type ManifestLayerName<M extends LayerServerManifest> = Extract<
	M['layers'][number]['name'],
	string
>;

export type ManifestActionForLayer<
	M extends LayerServerManifest,
	Layer extends string,
> =
	Extract<M['actions'][number], { readonly layer: Layer }> extends infer Action
		? [Action] extends [never]
			? M['actions'][number]
			: Action
		: never;

export type ManifestActionName<
	M extends LayerServerManifest,
	Layer extends string,
> = ManifestActionForLayer<M, Layer> extends { readonly name: infer Name }
	? Extract<Name, string>
	: string;

export type ManifestRoutePath<M extends LayerServerManifest> = Extract<
	M['routes'][number]['path'],
	string
>;

export type ManifestRouteForPath<
	M extends LayerServerManifest,
	Path extends string,
> =
	Extract<M['routes'][number], { readonly path: Path }> extends infer Route
		? [Route] extends [never]
			? M['routes'][number]
			: Route
		: never;

export type ManifestRouteMethod<
	M extends LayerServerManifest,
	Path extends string,
> = ManifestRouteForPath<M, Path> extends {
	readonly methods: readonly (infer Method)[];
}
	? Extract<Method, HttpMethod>
	: HttpMethod;

type SegmentParam<Segment extends string> =
	Segment extends `:${infer Name}`
		? Name
		: Segment extends `[...${infer Name}]`
			? Name
			: Segment extends `[${infer Name}]`
				? Name
				: never;

type PathParamNames<Path extends string> =
	Path extends `${infer Head}/${infer Tail}`
		? SegmentParam<Head> | PathParamNames<Tail>
		: SegmentParam<Path>;

type RouteParamValue =
	| string
	| number
	| boolean
	| readonly (string | number | boolean)[];

export type ManifestRouteParams<Path extends string> = [
	PathParamNames<Path>,
] extends [never]
	? Record<string, never>
	: {
			readonly [K in PathParamNames<Path>]: RouteParamValue;
		};

export interface LayerRouteCallOptions<
	M extends LayerServerManifest,
	Path extends ManifestRoutePath<M>,
> extends Omit<RequestInit, 'body' | 'method'> {
	readonly baseUrl?: string | URL;
	readonly fetch?: typeof fetch;
	readonly method?: ManifestRouteMethod<M, Path>;
	readonly params?: ManifestRouteParams<Path>;
	readonly query?: Readonly<Record<string, RouteParamValue | null | undefined>>;
	readonly response?: LayerActionResponseMode;
	readonly body?: unknown;
}

export interface LayerRoutePathOptions<Path extends string> {
	readonly params?: ManifestRouteParams<Path>;
	readonly query?: Readonly<Record<string, RouteParamValue | null | undefined>>;
}

export interface LayerServerManifestClient<M extends LayerServerManifest> {
	action: <Layer extends ManifestLayerName<M>>(
		layer: Layer,
		action: ManifestActionName<M, Layer>,
		input?: unknown,
		options?: LayerActionCallOptions
	) => Promise<unknown>;
	route: <Path extends ManifestRoutePath<M>>(
		path: Path,
		options?: LayerRouteCallOptions<M, Path>
	) => Promise<unknown>;
}

export interface GenerateLayerServerClientModuleOptions {
	readonly clientTypeName?: string;
	readonly factoryName?: string;
	readonly importSource?: string;
	readonly manifestName?: string;
}

export class LayerServerClientError extends Error {
	readonly status: number;
	readonly statusText: string;
	readonly body: string;
	readonly response: Response;

	constructor(response: Response, body: string) {
		super(
			`Effuse server request failed with ${String(response.status)} ${response.statusText}`
		);
		this.name = 'LayerServerClientError';
		this.status = response.status;
		this.statusText = response.statusText;
		this.body = body;
		this.response = response;
	}
}

const isBodyPayload = (value: unknown): value is BodyInit =>
	typeof value === 'string' ||
	value instanceof Blob ||
	value instanceof FormData ||
	value instanceof URLSearchParams ||
	value instanceof ArrayBuffer ||
	ArrayBuffer.isView(value) ||
	value instanceof ReadableStream;

const toPathPart = (value: RouteParamValue): string => {
	if (Array.isArray(value)) {
		return value.map((item) => encodeURIComponent(String(item))).join('/');
	}
	return encodeURIComponent(String(value));
};

const appendQuery = (
	url: string,
	query: Readonly<Record<string, RouteParamValue | null | undefined>> | undefined
): string => {
	if (!query) {
		return url;
	}

	const params = new URLSearchParams();
	for (const [key, value] of Object.entries(query)) {
		if (value === null || value === undefined) {
			continue;
		}
		if (Array.isArray(value)) {
			for (const item of value) {
				params.append(key, String(item));
			}
			continue;
		}
		params.set(key, String(value));
	}

	const queryString = params.toString();
	return queryString ? `${url}?${queryString}` : url;
};

const replaceParamSegment = <Path extends string>(
	segment: string,
	path: Path,
	params: ManifestRouteParams<Path> | undefined
): string => {
	const name = segment.startsWith(':')
		? segment.slice(1)
		: segment.startsWith('[...') && segment.endsWith(']')
			? segment.slice(4, -1)
			: segment.startsWith('[') && segment.endsWith(']')
				? segment.slice(1, -1)
				: null;

	if (!name) {
		return segment;
	}

	const value = params?.[name as keyof ManifestRouteParams<Path>];
	if (value === undefined) {
		throw new TypeError(`Missing route param "${name}" for "${path}".`);
	}

	return toPathPart(value);
};

export const createLayerRoutePath = <Path extends string>(
	path: Path,
	options: LayerRoutePathOptions<Path> = {}
): string => {
	const segments = path
		.split('/')
		.map((segment) => replaceParamSegment(segment, path, options.params));
	return appendQuery(segments.join('/'), options.query);
};

export const createLayerRouteUrl = <Path extends string>(
	path: Path,
	options: LayerRoutePathOptions<Path> & { readonly baseUrl?: string | URL } = {}
): string => {
	const resolvedPath = createLayerRoutePath(path, options);
	return options.baseUrl
		? new URL(resolvedPath, options.baseUrl).toString()
		: resolvedPath;
};

interface ResolvedLayerRouteCallOptions extends Omit<RequestInit, 'body' | 'method'> {
	readonly baseUrl?: string | URL;
	readonly body?: unknown;
	readonly fetch?: typeof fetch;
	readonly method: HttpMethod;
	readonly params?: unknown;
	readonly query?: unknown;
	readonly response?: LayerActionResponseMode;
}

const createRequestInit = (
	options: ResolvedLayerRouteCallOptions
): RequestInit => {
	const { body } = options;
	const headers = new Headers(options.headers);
	const requestInit: RequestInit = {
		cache: options.cache,
		credentials: options.credentials,
		headers,
		integrity: options.integrity,
		keepalive: options.keepalive,
		method: options.method,
		mode: options.mode,
		redirect: options.redirect,
		referrer: options.referrer,
		referrerPolicy: options.referrerPolicy,
		signal: options.signal,
		window: options.window,
	};

	if (body === undefined) {
		return requestInit;
	}

	if (isBodyPayload(body)) {
		return { ...requestInit, body };
	}

	if (!headers.has('Content-Type')) {
		headers.set('Content-Type', 'application/json');
	}

	return {
		...requestInit,
		body: JSON.stringify(body),
	};
};

const readServerResponse = async (
	response: Response,
	mode: LayerActionResponseMode = 'auto'
): Promise<unknown> => {
	if (!response.ok) {
		const body = await response
			.clone()
			.text()
			.catch(() => '');
		throw new LayerServerClientError(response, body);
	}

	if (mode === 'response') {
		return response;
	}

	if (response.status === 204) {
		return undefined;
	}

	if (mode === 'text') {
		return response.text();
	}

	if (
		mode === 'json' ||
		response.headers.get('Content-Type')?.includes('application/json')
	) {
		return response.json();
	}

	return response.text();
};

const findManifestAction = (
	manifest: LayerServerManifest,
	layer: string,
	action: string
): LayerServerManifestAction | undefined =>
	manifest.actions.find(
		(candidate) => candidate.layer === layer && candidate.name === action
	);

const findManifestRoute = (
	manifest: LayerServerManifest,
	path: string
): LayerServerManifestRoute | undefined =>
	manifest.routes.find((candidate) => candidate.path === path);

const IDENTIFIER_PATTERN = /^[A-Za-z_$][\w$]*$/;

const assertIdentifier = (name: string, label: string): string => {
	if (!IDENTIFIER_PATTERN.test(name)) {
		throw new TypeError(`Invalid ${label} identifier "${name}".`);
	}
	return name;
};

const serializeManifest = (manifest: LayerServerManifest): string =>
	JSON.stringify(manifest, null, '\t');

export const callLayerManifestAction = async <
	M extends LayerServerManifest,
	Layer extends ManifestLayerName<M>,
>(
	manifest: M,
	layer: Layer,
	action: ManifestActionName<M, Layer>,
	input?: unknown,
	options?: LayerActionCallOptions
): Promise<unknown> => {
	if (!findManifestAction(manifest, layer, action)) {
		throw new TypeError(`Unknown Effuse action "${layer}.${action}".`);
	}

	return callLayerAction({ name: layer }, action, input, options);
};

export const callLayerManifestRoute = async <
	M extends LayerServerManifest,
	Path extends ManifestRoutePath<M>,
>(
	manifest: M,
	path: Path,
	options: LayerRouteCallOptions<M, Path> = {}
): Promise<unknown> => {
	const route = findManifestRoute(manifest, path);
	if (!route) {
		throw new TypeError(`Unknown Effuse route "${path}".`);
	}

	const firstMethod = route.methods.at(0);
	if (firstMethod === undefined) {
		throw new TypeError(`Effuse route "${path}" does not declare methods.`);
	}
	const method = options.method ?? firstMethod;

	if (!route.methods.includes(method)) {
		throw new TypeError(
			`Effuse route "${path}" does not support ${method}.`
		);
	}

	const fetcher = options.fetch ?? fetch;
	const url = createLayerRouteUrl(path, {
		baseUrl: options.baseUrl,
		params: options.params,
		query: options.query,
	});
	const response = await fetcher(
		url,
		createRequestInit({ ...options, method })
	);

	return readServerResponse(response, options.response);
};

export const createLayerServerManifestClient = <M extends LayerServerManifest>(
	manifest: M,
	options?: LayerActionCallOptions
): LayerServerManifestClient<M> => ({
	action: (layer, action, input, callOptions) =>
		callLayerManifestAction(manifest, layer, action, input, {
			...options,
			...callOptions,
		}),
	route: (path, callOptions) =>
		callLayerManifestRoute(manifest, path, {
			...options,
			...callOptions,
		}),
});

export const generateLayerServerClientModule = (
	manifest: LayerServerManifest,
	options: GenerateLayerServerClientModuleOptions = {}
): string => {
	const clientTypeName = assertIdentifier(
		options.clientTypeName ?? 'LayerServerClient',
		'client type'
	);
	const factoryName = assertIdentifier(
		options.factoryName ?? 'createLayerServerClient',
		'factory'
	);
	const manifestName = assertIdentifier(
		options.manifestName ?? 'layerServerManifest',
		'manifest'
	);
	const importSource = options.importSource ?? '@effuse/core';
	const serializedManifest = serializeManifest(manifest);

	return [
		`import { createLayerServerManifestClient, type LayerActionCallOptions, type LayerServerManifest } from ${JSON.stringify(importSource)};`,
		'',
		`export const ${manifestName} = ${serializedManifest} as const satisfies LayerServerManifest;`,
		'',
		`export const ${factoryName} = (options?: LayerActionCallOptions) =>`,
		`\tcreateLayerServerManifestClient(${manifestName}, options);`,
		'',
		`export type ${clientTypeName} = ReturnType<typeof ${factoryName}>;`,
		'',
	].join('\n');
};
