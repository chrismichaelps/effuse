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

export type LifecycleHook = () => void | Promise<void>;
export type ErrorHook = (error: Error) => void;

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

	readonly setup?: LayerSetupFn<P, D, S>;
	readonly onMount?: LifecycleHook;
	readonly onUnmount?: LifecycleHook;
	readonly onError?: ErrorHook;

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

/**
 * Layer registry interface - extend via module augmentation in your app:
 *
 * @example
 * ```typescript
 * // In your app (e.g., app/src/layers/effuse.d.ts)
 * declare module '@effuse/core' {
 *   interface EffuseLayerRegistry {
 *     myLayer: { props: { value: Signal<string> } };
 *   }
 * }
 * ```
 */
// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export interface EffuseLayerRegistry {}

export type LayerPropsOf<K extends keyof EffuseLayerRegistry> =
	EffuseLayerRegistry[K] extends { props: infer P extends LayerProps }
		? P
		: LayerProps;

export type LayerProvidesOf<K extends keyof EffuseLayerRegistry> =
	EffuseLayerRegistry[K] extends { provides: infer S } ? S : unknown;
