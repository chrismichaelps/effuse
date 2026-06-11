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
import type { HeadProps } from '../ssr/types.js';
import type { LayerServerErrorOptions } from '../ssr/server-errors.js';
import type { ServerValidationHelpers } from '../ssr/validation.js';
import type { Signal } from '../reactivity/signal.js';

export type MaybePromise<T> = T | Promise<T>;

export type CleanupFn = () => void;

export type SetupResult = CleanupFn | undefined;

export type PluginCleanup = () => void;

export type PluginFn = () => MaybePromise<PluginCleanup | undefined>;

export type Guard = (
	to: RouteConfig,
	from: RouteConfig | null
) => boolean | Promise<boolean>;

export interface RouteConfig {
	readonly path: string;
	readonly component: Component;
	readonly name?: string;
	readonly meta?: Record<string, unknown>;
	readonly head?: HeadProps;
	readonly children?: readonly RouteConfig[];
	readonly redirect?: string;
	readonly beforeEnter?: Guard;
}

export interface StoreConfig {
	readonly name: string;
	readonly state: Record<string, unknown>;
	readonly actions?: Record<string, (...args: unknown[]) => void>;
}

export type LayerRestriction =
	| 'components'
	| 'routes'
	| 'stores'
	| 'providers'
	| 'plugins';

export type LayerProps = Record<string, Signal<unknown>>;

export type LayerProvides = Record<string, () => unknown>;

export type HttpMethod =
	| 'GET'
	| 'POST'
	| 'PUT'
	| 'PATCH'
	| 'DELETE'
	| 'OPTIONS'
	| 'HEAD';

export type ServerResult =
	| Response
	| BodyInit
	| Record<string, unknown>
	| readonly unknown[]
	| number
	| boolean
	| null
	| undefined;

export type ServerRuntimeHint = 'node' | 'edge' | 'bun' | 'workerd';

export interface ServerCacheMetadata {
	readonly cacheControl?: string;
	readonly revalidate?: number | false;
	readonly tags?: readonly string[];
}

export interface ServerCorsMetadata {
	readonly credentials?: boolean;
	readonly headers?: readonly string[];
	readonly maxAge?: number;
	readonly methods?: readonly HttpMethod[];
	readonly origin?: boolean | string | readonly string[];
}

export interface ServerRouteMetadata {
	readonly cache?: ServerCacheMetadata;
	readonly cors?: ServerCorsMetadata;
	readonly maxDuration?: number;
	readonly region?: string | readonly string[];
	readonly runtime?: ServerRuntimeHint;
}

export type ServerLayerDiagnosticCode =
	| 'metadata_conflict'
	| 'server_file_ambiguous_route'
	| 'server_file_duplicate_action'
	| 'server_file_duplicate_route'
	| 'server_file_invalid_action'
	| 'server_file_invalid_method'
	| 'server_file_invalid_route';

export interface ServerLayerDiagnostic {
	readonly code: ServerLayerDiagnosticCode;
	readonly filePath?: string;
	readonly key: string;
	readonly layer?: string;
	readonly message: string;
	readonly target: string;
}

export interface ServerResponseHelpers {
	// eslint-disable-next-line @typescript-eslint/no-unnecessary-type-parameters -- callers provide the serialized payload shape.
	json: <T>(data: T, init?: ResponseInit) => Response;
	text: (body: string, init?: ResponseInit) => Response;
	redirect: (url: string | URL, status?: number) => Response;
	error: <Details = unknown>(
		code: string,
		message: string,
		options?: LayerServerErrorOptions<Details>
	) => Response;
}

export interface ServerLayerContext<
	S extends Record<string, unknown> = Record<string, unknown>,
> {
	readonly request: Request;
	readonly url: URL;
	readonly params: Record<string, string>;
	readonly query: Record<string, string>;
	readonly services: S;
	readonly layerServices: Record<string, Record<string, unknown>>;
	// eslint-disable-next-line @typescript-eslint/no-unnecessary-type-parameters -- handlers can narrow the service by call site.
	getService: <T = unknown>(key: string) => T | undefined;
	json: <T = unknown>() => Promise<T>;
	text: () => Promise<string>;
	formData: () => Promise<FormData>;
	readonly validate: ServerValidationHelpers;
	readonly response: ServerResponseHelpers;
}

export type ServerHandler<
	S extends Record<string, unknown> = Record<string, unknown>,
> = (ctx: ServerLayerContext<S>) => MaybePromise<ServerResult>;

export type ServerMiddlewareNext = () => Promise<Response>;

export type ServerMiddleware<
	S extends Record<string, unknown> = Record<string, unknown>,
> = (
	ctx: ServerLayerContext<S>,
	next: ServerMiddlewareNext
) => MaybePromise<ServerResult>;

export type ServerMethodHandlers<
	S extends Record<string, unknown> = Record<string, unknown>,
> = Partial<Record<HttpMethod, ServerHandler<S>>>;

export type ServerRouteDefinition<
	S extends Record<string, unknown> = Record<string, unknown>,
> = ServerMethodHandlers<S> & {
	readonly handler?: ServerHandler<S>;
	readonly metadata?: ServerRouteMetadata;
	readonly methods?: ServerMethodHandlers<S>;
	readonly middleware?: readonly ServerMiddleware<S>[];
};

export interface ServerRoute<
	S extends Record<string, unknown> = Record<string, unknown>,
> {
	readonly diagnostics?: readonly ServerLayerDiagnostic[];
	readonly metadata?: ServerRouteMetadata;
	readonly path: string;
	readonly methods: ServerMethodHandlers<S>;
	readonly middleware?: readonly ServerMiddleware<S>[];
}

export type ServerRouteInput<
	S extends Record<string, unknown> = Record<string, unknown>,
> = ServerHandler<S> | ServerRouteDefinition<S> | ServerRoute<S>;

export interface ServerActionDefinition<
	S extends Record<string, unknown> = Record<string, unknown>,
> {
	readonly diagnostics?: readonly ServerLayerDiagnostic[];
	readonly handler: ServerHandler<S>;
	readonly metadata?: ServerRouteMetadata;
	readonly middleware?: readonly ServerMiddleware<S>[];
}

export type ServerActionInput<
	S extends Record<string, unknown> = Record<string, unknown>,
> = ServerHandler<S> | ServerActionDefinition<S>;

export interface ServerLayerConfig<
	S extends Record<string, unknown> = Record<string, unknown>,
> {
	readonly api?:
		| Record<string, ServerRouteInput<S>>
		| readonly ServerRoute<S>[];
	readonly diagnostics?: readonly ServerLayerDiagnostic[];
	readonly metadata?: ServerRouteMetadata;
	readonly middleware?: readonly ServerMiddleware<S>[];
	readonly routes?: readonly ServerRoute<S>[];
	readonly actions?: Record<string, ServerActionInput<S>>;
}

export interface LayerDependency<P extends LayerProps = LayerProps> {
	readonly name: string;
	readonly props: P;
	get: (key: string) => unknown;
	component: (name: string) => Component | undefined;
}

export type DepsRecord<D extends readonly string[]> = {
	[K in D[number]]: LayerDependency;
};

export interface SetupContext<
	P extends LayerProps = LayerProps,
	D extends readonly string[] = readonly string[],
	S = unknown,
> {
	readonly props: P;
	readonly store: S;
	readonly deps: DepsRecord<D>;
	get: (name: string) => LayerDependency;
	getService: (key: string) => unknown;
	component: (name: string) => Component | undefined;
	readonly layers: readonly ResolvedLayer[];
}

export type LayerSetupFn<
	P extends LayerProps = LayerProps,
	D extends readonly string[] = readonly string[],
	S = unknown,
	// eslint-disable-next-line @typescript-eslint/no-invalid-void-type -- void is valid for functions with no return
> = (ctx: SetupContext<P, D, S>) => SetupResult | Promise<SetupResult> | void;

export type LifecycleHook<
	P extends LayerProps = LayerProps,
	D extends readonly string[] = readonly string[],
	S = unknown,
> = (ctx: SetupContext<P, D, S>) => void | Promise<void>;

export type ErrorHook<
	P extends LayerProps = LayerProps,
	D extends readonly string[] = readonly string[],
	S = unknown,
> = (error: Error, ctx: SetupContext<P, D, S>) => void;

export type OnReadyHook<
	P extends LayerProps = LayerProps,
	D extends readonly string[] = readonly string[],
	S = unknown,
> = (
	ctx: SetupContext<P, D, S>,
	allLayers: readonly ResolvedLayer[]
) => void | Promise<void>;

export interface EffuseLayer<
	P extends LayerProps = LayerProps,
	D extends readonly string[] = readonly string[],
	S = unknown,
> {
	readonly name: string;
	readonly domain?: string;
	readonly props?: P;
	readonly store?: S;
	readonly deriveProps?: (store: S) => P;
	readonly extends?: readonly EffuseLayer[];
	readonly dependencies?: D;
	readonly restrict?: readonly LayerRestriction[];
	readonly head?: HeadProps;
	// eslint-disable-next-line @typescript-eslint/no-explicit-any -- components may have various prop types
	readonly components?: Record<string, Component<any>>;
	readonly provides?: LayerProvides;
	readonly services?: LayerProvides;
	readonly server?: ServerLayerConfig;

	readonly setup?: LayerSetupFn<P, D, S>;
	readonly onMount?: LifecycleHook<P, D, S>;
	readonly onUnmount?: LifecycleHook<P, D, S>;
	readonly onError?: ErrorHook<P, D, S>;
	readonly onReady?: OnReadyHook<P, D, S>;

	readonly routes?: readonly RouteConfig[];
	readonly routeOptions?: {
		readonly lazy?: boolean;
		readonly guards?: readonly Guard[];
	};
	readonly stores?: readonly StoreConfig[];
	readonly providers?: readonly Component[];
	readonly plugins?: readonly PluginFn[];
}

export interface ResolvedLayer<
	P extends LayerProps = LayerProps,
	D extends readonly string[] = readonly string[],
	S = unknown,
> extends EffuseLayer<P, D, S> {
	readonly _resolved: true;
	readonly _order: number;
}

export interface MergedConfig {
	readonly routes: readonly RouteConfig[];
	readonly guards: readonly Guard[];
	readonly stores: readonly StoreConfig[];
	readonly providers: readonly Component[];
	readonly plugins: readonly PluginFn[];
	readonly setups: readonly LayerSetupFn[];
	readonly lazy: boolean;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type AnyLayer = EffuseLayer<any, any, any>;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type AnyResolvedLayer = ResolvedLayer<any, any, any>;
