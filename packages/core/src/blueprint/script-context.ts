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
	Signal,
	ReadonlySignal,
	WatchOptions,
	EffectOptions,
	EffectHandle,
	OnCleanup,
} from '../types/index.js';
import type { Component } from '../render/node.js';
import { signal } from '../reactivity/index.js';
import { computed } from '../reactivity/computed.js';
import {
	watch as standaloneWatch,
	watchMultiple as standaloneWatchMultiple,
} from '../effects/index.js';
import { watchEffect as standaloneEffect } from '../effects/effect.js';
import {
	createComponentLifecycleSync,
	withActiveLifecycle,
	type ComponentLifecycle,
} from './lifecycle.js';
import { useCallback, useMemo } from './hooks.js';
import { createReactiveProps } from './reactive-props.js';
import { provide, inject } from './provide-inject.js';
import {
	getLayerComponent,
	getLayerService,
	isLayerRuntimeReady,
	type LayerContext,
} from '../layers/context.js';
import type { CompiledLayer } from '../layers/api/defineLayer.js';
import type { LayerServicesFrom } from '../layers/api/defineLayer.js';
import {
	createLayerEntryResolver,
	resolveLayersAccessor,
	type LayerEntryFrom,
	type LayersAccessor,
	type LayerSource,
} from '../layers/api/layersAccessor.js';
import { RouterNotConfiguredError } from '../layers/errors.js';
import { StoreGetterNotConfiguredError } from '../errors.js';

export type ExposedValues = object;

// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export interface EffuseRegistry {}

type RouterType = EffuseRegistry extends { router: infer R } ? R : unknown;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export interface ScriptContext<
	P,
	L extends LayerSource = readonly never[],
> {
	readonly props: Readonly<P>;

	readonly layers: LayersAccessor<L>;

	useLayer: <Layer extends CompiledLayer<any, any>>(
		layer: Layer
	) => LayerEntryFrom<Layer>;

	expose: (values: ExposedValues) => void;

	signal: typeof signal;

	computed: <T>(getter: () => T) => ReadonlySignal<T>;

	store: (name: string) => unknown;

	router: RouterType;

	onMount: (callback: () => (() => void) | undefined) => void;

	onUnmount: (callback: () => void) => void;

	onBeforeMount: (callback: () => void) => void;

	onBeforeUnmount: (callback: () => void) => void;

	watch: <T>(
		source: Signal<T> | (() => T),
		callback: (
			newValue: T,
			oldValue: T | undefined,
			onCleanup: OnCleanup
		) => void,
		options?: WatchOptions
	) => void;

	watchMultiple: <T extends readonly (Signal<unknown> | (() => unknown))[]>(
		sources: T,
		callback: (
			newValues: {
				[K in keyof T]: T[K] extends Signal<infer V>
					? V
					: T[K] extends () => infer V
						? V
						: never;
			},
			oldValues: {
				[K in keyof T]: T[K] extends Signal<infer V>
					? V | undefined
					: T[K] extends () => infer V
						? V | undefined
						: never;
			},
			onCleanup: OnCleanup
		) => void,
		options?: WatchOptions
	) => void;

	watchEffect: (
		fn: (onCleanup: OnCleanup) => void | Promise<void>,
		options?: EffectOptions
	) => EffectHandle;

	useCallback: typeof useCallback;

	useMemo: typeof useMemo;

	useStore: (key: string) => unknown;

	useService: {
		(key: string): unknown;
		<
			Layer extends CompiledLayer<any, any>,
			Key extends Extract<keyof LayerServicesFrom<Layer>, string>,
		>(
			layer: Layer,
			key: Key
		): LayerServicesFrom<Layer>[Key];
	};

	useComponent: (name: string) => Component | undefined;

	provide: typeof provide;

	inject: typeof inject;
}

export interface ScriptState<E extends ExposedValues> {
	exposed: E;
	lifecycle: ComponentLifecycle;
	/** Update reactive prop signals in-place (for reconciliation). */
	updateProps(props: Record<string, unknown>): void;
}

let globalStoreGetter: ((name: string) => unknown) | null = null;
let globalRouter: unknown = null;

export const setGlobalStoreGetter = (
	getter: (name: string) => unknown
): void => {
	globalStoreGetter = getter;
};

export const setGlobalRouter = (router: unknown): void => {
	globalRouter = router;
};

export const createScriptContext = <
	P,
	E extends ExposedValues,
	L extends LayerSource = readonly never[],
>(
	props: P,
	storeGetter?: (name: string) => unknown,
	layers?: L
): { context: ScriptContext<P, L>; state: ScriptState<E> } => {
	const lifecycle = createComponentLifecycleSync();

	const state: ScriptState<E> = {
		exposed: {} as E,
		lifecycle,
		updateProps: (newProps: Record<string, unknown>) => {
			updateProps(newProps);
		},
	};

	const getStore = storeGetter ?? globalStoreGetter;

	const resolvedLayers = resolveLayersAccessor(
		(layers ?? []) as L
	) as LayersAccessor<L>;
	const resolveLayer = createLayerEntryResolver();

	const { proxy: reactiveProps, update: updateProps } = createReactiveProps(
		props as Record<string, unknown>
	);

	const context: ScriptContext<P, L> = {
		props: reactiveProps as Readonly<P>,

		layers: resolvedLayers,

		useLayer: (layer) => resolveLayer(layer),

		expose: (values: ExposedValues): void => {
			Object.assign(state.exposed, values);
		},

		signal,

		computed,

		store: (name: string): unknown => {
			if (isLayerRuntimeReady()) {
				const layerService = getLayerService(name);
				if (layerService !== undefined) {
					return layerService;
				}
			}
			if (!getStore) {
				throw new StoreGetterNotConfiguredError({});
			}
			return getStore(name);
		},

		router: (() => {
			if (!globalRouter) {
				return new Proxy({} as object, {
					get: () => {
						throw new RouterNotConfiguredError();
					},
				}) as RouterType;
			}
			return globalRouter as RouterType;
		})(),

		onMount: (callback): void => {
			lifecycle.onMount(callback);
		},

		onUnmount: (callback): void => {
			lifecycle.onUnmount(callback);
		},

		onBeforeMount: (callback): void => {
			lifecycle.onBeforeMount(callback);
		},

		onBeforeUnmount: (callback): void => {
			lifecycle.onBeforeUnmount(callback);
		},

		watch: <T>(
			source: Signal<T> | (() => T),
			callback: (
				newValue: T,
				oldValue: T | undefined,
				onCleanup: OnCleanup
			) => void,
			options?: WatchOptions
		): void => {
			const handle = standaloneWatch(source, callback, options);
			lifecycle.onUnmount(() => handle.stop());
		},

		watchMultiple: (sources, callback, options): void => {
			// eslint-disable-next-line @typescript-eslint/no-explicit-any -- bridge ScriptContext types with WatchSource
			const handle = standaloneWatchMultiple(
				sources as any,
				callback as any,
				options
			);
			lifecycle.onUnmount(() => handle.stop());
		},

		watchEffect: (
			fn: (onCleanup: OnCleanup) => void | Promise<void>,
			options?: EffectOptions
		): EffectHandle => {
			const handle = standaloneEffect(fn, options);
			lifecycle.onUnmount(() => handle.stop());
			return handle;
		},

		useCallback,

		useMemo,

		useStore: (key: string): unknown => {
			if (!isLayerRuntimeReady()) {
				if (getStore) {
					return getStore(key);
				}
				return undefined;
			}
			return getLayerService(key);
		},

		useService: ((
			keyOrLayer: string | CompiledLayer<any, any>,
			maybeKey?: string
		): unknown => {
			if (!isLayerRuntimeReady()) {
				return undefined;
			}

			const key = typeof keyOrLayer === 'string' ? keyOrLayer : maybeKey;

			return key ? getLayerService(key) : undefined;
		}) as ScriptContext<P, L>['useService'],

		useComponent: (name: string): Component | undefined => {
			if (!isLayerRuntimeReady()) {
				return undefined;
			}
			return getLayerComponent(name) as Component | undefined;
		},

		provide,

		inject,
	};

	return { context, state };
};

export const runMountCallbacks = <E extends ExposedValues>(
	state: ScriptState<E>
): void => {
	state.lifecycle.runMount();
};

export const runUnmountCallbacks = <E extends ExposedValues>(
	state: ScriptState<E>
): void => {
	state.lifecycle.runCleanup();
};

export type { LayerContext, CompiledLayer, LayersAccessor, LayerSource };
