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
	type WatchSource,
} from '../effects/index.js';
import { watchEffect as standaloneEffect } from '../effects/effect.js';
import {
	createComponentLifecycleSync,
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
import type { EffuseLayer } from '../layers/types.js';
import {
	createLayerEntryResolver,
	resolveLayerService,
	resolveLayersAccessor,
	type LayerEntryFrom,
	type LayersAccessor,
	type LayerSource,
} from '../layers/api/layersAccessor.js';
import {
	LayerRuntimeNotInitializedError,
	RouterNotConfiguredError,
	ServiceNotFoundError,
} from '../layers/errors.js';
import {
	StoreGetterNotConfiguredError,
	StoreNotFoundError,
} from '../errors.js';
import { createRuntimeContext } from '../context/runtime-context.js';

export type ExposedValues = object;

// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export interface EffuseRegistry {}

type RouterType = EffuseRegistry extends { router: infer R } ? R : unknown;

export interface ScriptContext<P, L extends LayerSource = readonly never[]> {
	readonly props: Readonly<P>;

	readonly layers: LayersAccessor<L>;

	useLayer: <Layer extends CompiledLayer<EffuseLayer, string>>(
		layer: Layer
	) => LayerEntryFrom<Layer>;

	expose: (values: ExposedValues) => void;

	signal: typeof signal;

	computed: <T>(getter: () => T) => ReadonlySignal<T>;

	store: (name: string) => unknown;

	router: RouterType;

	onMount: (callback: () => void | (() => void)) => void;

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
	) => EffectHandle;

	watchMultiple: <T extends readonly (Signal<unknown> | (() => unknown))[]>(
		sources: T,
		callback: (
			newValues: {
				[K in keyof T]: T[K] extends WatchSource<infer V> ? V : never;
			},
			oldValues: {
				[K in keyof T]: T[K] extends WatchSource<infer V>
					? V | undefined
					: never;
			},
			onCleanup: OnCleanup
		) => void,
		options?: WatchOptions
	) => EffectHandle;

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
			Layer extends CompiledLayer<EffuseLayer, string>,
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
const storeGetterInstallations: Array<{
	readonly getter: (name: string) => unknown;
}> = [];

interface CoreRouterRuntimeState {
	current: unknown;
	readonly installations: Array<{ readonly router: unknown }>;
}

const CORE_ROUTER_RUNTIME_KEY = Symbol.for('effuse.core.router-runtime.v1');
const coreRouterRuntime = (() => {
	const shared = globalThis as Record<PropertyKey, unknown>;
	const existing = shared[CORE_ROUTER_RUNTIME_KEY] as
		| CoreRouterRuntimeState
		| undefined;
	if (existing) return existing;
	const created: CoreRouterRuntimeState = {
		current: null,
		installations: [],
	};
	Object.defineProperty(shared, CORE_ROUTER_RUNTIME_KEY, { value: created });
	return created;
})();
const coreRouterContext = createRuntimeContext<unknown>();

export const runWithRouterContext = <T>(router: unknown, fn: () => T): T =>
	coreRouterContext.run(router, fn);

export const getConfiguredRouter = (): unknown =>
	coreRouterContext.current() ?? coreRouterRuntime.current;

export const setGlobalStoreGetter = (
	getter: ((name: string) => unknown) | null
): (() => void) => {
	if (getter === null) {
		clearGlobalStoreGetter();
		return () => {};
	}
	const installation = { getter };
	storeGetterInstallations.push(installation);
	globalStoreGetter = getter;
	let removed = false;
	return () => {
		if (removed) return;
		removed = true;
		const index = storeGetterInstallations.indexOf(installation);
		if (index >= 0) storeGetterInstallations.splice(index, 1);
		globalStoreGetter = storeGetterInstallations.at(-1)?.getter ?? null;
	};
};

export const clearGlobalStoreGetter = (): void => {
	storeGetterInstallations.length = 0;
	globalStoreGetter = null;
};

export const setGlobalRouter = (router: unknown): (() => void) => {
	const installation = { router };
	coreRouterRuntime.installations.push(installation);
	coreRouterRuntime.current = router;
	let removed = false;
	return () => {
		if (removed) return;
		removed = true;
		const index = coreRouterRuntime.installations.indexOf(installation);
		if (index >= 0) coreRouterRuntime.installations.splice(index, 1);
		coreRouterRuntime.current =
			coreRouterRuntime.installations.at(-1)?.router ?? null;
	};
};

export const clearGlobalRouter = (): void => {
	coreRouterRuntime.installations.length = 0;
	coreRouterRuntime.current = null;
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

	const resolvedLayers = resolveLayersAccessor(
		(layers ?? []) as L
	) as LayersAccessor<L>;
	const resolveLayer = createLayerEntryResolver();

	const { proxy: reactiveProps, update: updateProps } = createReactiveProps(
		props as Record<string, unknown>
	);
	const resolveStore = (name: string): unknown => {
		if (isLayerRuntimeReady()) {
			const layerService = getLayerService(name);
			if (layerService !== undefined) return layerService;
		}
		const activeStoreGetter = storeGetter ?? globalStoreGetter;
		if (activeStoreGetter) {
			const store = activeStoreGetter(name);
			if (store !== undefined) return store;
			throw new StoreNotFoundError({ storeName: name });
		}
		if (isLayerRuntimeReady()) {
			throw new StoreNotFoundError({ storeName: name });
		}
		throw new StoreGetterNotConfiguredError({});
	};

	const context: ScriptContext<P, L> = {
		props: reactiveProps as Readonly<P>,

		layers: resolvedLayers,

		useLayer: (layer) => resolveLayer(layer),

		expose: (values: ExposedValues): void => {
			Object.assign(state.exposed, values);
		},

		signal,

		computed,

		store: resolveStore,

		get router(): RouterType {
			const router = getConfiguredRouter();
			if (!router) {
				throw new RouterNotConfiguredError();
			}
			return router as RouterType;
		},

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
		): EffectHandle => {
			const handle = standaloneWatch(source, callback, options);
			lifecycle.onUnmount(() => handle.stop());
			return handle;
		},

		watchMultiple: (sources, callback, options): EffectHandle => {
			const handle = standaloneWatchMultiple(sources, callback, options);
			lifecycle.onUnmount(() => handle.stop());
			return handle;
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

		useStore: resolveStore,

		useService: ((
			keyOrLayer: string | CompiledLayer<EffuseLayer, string>,
			maybeKey?: string
		): unknown => {
			if (typeof keyOrLayer !== 'string') {
				return resolveLayerService(keyOrLayer, maybeKey, resolveLayer);
			}
			if (!isLayerRuntimeReady()) {
				throw new LayerRuntimeNotInitializedError({
					resource: `service "${keyOrLayer}"`,
				});
			}
			const service = getLayerService(keyOrLayer);
			if (service === undefined) {
				throw new ServiceNotFoundError({ serviceKey: keyOrLayer });
			}
			return service;
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
