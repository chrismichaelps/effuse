import { describe, it, expect, vi, afterEach } from 'vitest';
import { createScriptContext } from '../../blueprint/script-context.js';
import {
	initGlobalLayerContext,
	clearGlobalLayerContext,
} from '../../layers/context.js';
import type { PropsRegistry } from '../../layers/services/PropsService.js';
import type { LayerRegistry } from '../../layers/services/RegistryService.js';
import type { AnyResolvedLayer } from '../../layers/types.js';
import type { Component } from '../../render/node.js';
import { signal } from '../../reactivity/signal.js';

const createMockPropsRegistry = (
	propsMap: Record<string, Record<string, unknown>> = {}
): PropsRegistry => ({
	get: (name: string) => propsMap[name],
	set: vi.fn(),
	has: (name: string) => name in propsMap,
	getAll: () => new Map(Object.entries(propsMap)),
	clear: vi.fn(),
});

const createMockLayerRegistry = (
	layers: Record<string, AnyResolvedLayer> = {},
	services: Record<string, unknown> = {},
	components: Record<string, Component> = {}
): LayerRegistry => ({
	layers: new Map(Object.entries(layers)),
	components: new Map(Object.entries(components)),
	services: new Map(Object.entries(services)),
	getLayer: (name: string) => layers[name],
	getComponent: (name: string) => components[name],
	getService: (key: string) => services[key],
	registerLayer: vi.fn(),
	registerComponent: vi.fn(),
	registerService: vi.fn(),
	hasLayer: (name: string) => name in layers,
	hasComponent: (name: string) => name in components,
	hasService: (key: string) => key in services,
});

const createResolvedLayer = (
	overrides: Partial<AnyResolvedLayer> & { name: string }
): AnyResolvedLayer =>
	({
		_resolved: true as const,
		_order: 0,
		...overrides,
	}) as AnyResolvedLayer;

describe('ScriptContext - Layer Hooks', () => {
	afterEach(() => {
		clearGlobalLayerContext();
	});

	describe('useLayerProvider', () => {
		it('should return undefined when runtime is not ready', () => {
			const { context } = createScriptContext({});
			const result = (context.useLayerProvider as (name: string) => unknown)(
				'testLayer'
			);
			expect(result).toBeUndefined();
		});

		it('should return undefined when layer has no provides', () => {
			const layer = createResolvedLayer({ name: 'testLayer' });
			const propsRegistry = createMockPropsRegistry({
				testLayer: {},
			});
			const layerRegistry = createMockLayerRegistry({ testLayer: layer }, {});

			initGlobalLayerContext(propsRegistry, layerRegistry, [layer]);

			const { context } = createScriptContext({});
			const result = (context.useLayerProvider as (name: string) => unknown)(
				'testLayer'
			);
			expect(result).toBeUndefined();
		});

		it('should return cached singletons from registry, not re-invoke factories', () => {
			const factorySpy = vi.fn(() => ({ value: 'fresh' }));
			const cachedInstance = { value: 'cached' };

			const layer = createResolvedLayer({
				name: 'testLayer',
				provides: {
					myService: factorySpy,
				},
			});

			const propsRegistry = createMockPropsRegistry({
				testLayer: {},
			});
			const layerRegistry = createMockLayerRegistry(
				{ testLayer: layer },
				{ myService: cachedInstance }
			);

			initGlobalLayerContext(propsRegistry, layerRegistry, [layer]);

			const { context } = createScriptContext({});
			const result = (context.useLayerProvider as (name: string) => unknown)(
				'testLayer'
			) as Record<string, unknown>;

			expect(factorySpy).not.toHaveBeenCalled();
			expect(result).toBeDefined();
			expect(result.myService).toBe(cachedInstance);
		});

		it('should return the same references on multiple calls', () => {
			const cachedService = { id: 1 };

			const layer = createResolvedLayer({
				name: 'testLayer',
				provides: {
					svc: () => ({ id: 999 }),
				},
			});

			const propsRegistry = createMockPropsRegistry({
				testLayer: {},
			});
			const layerRegistry = createMockLayerRegistry(
				{ testLayer: layer },
				{ svc: cachedService }
			);

			initGlobalLayerContext(propsRegistry, layerRegistry, [layer]);

			const { context } = createScriptContext({});
			const getter = context.useLayerProvider as (
				name: string
			) => Record<string, unknown> | undefined;

			const first = getter('testLayer');
			const second = getter('testLayer');

			expect(first?.svc).toBe(cachedService);
			expect(second?.svc).toBe(cachedService);
			expect(first?.svc).toBe(second?.svc);
		});

		it('should return all provided services for a layer', () => {
			const authService = { token: 'abc' };
			const loggerService = { log: vi.fn() };

			const layer = createResolvedLayer({
				name: 'multiLayer',
				provides: {
					auth: () => authService,
					logger: () => loggerService,
				},
			});

			const propsRegistry = createMockPropsRegistry({
				multiLayer: {},
			});
			const layerRegistry = createMockLayerRegistry(
				{ multiLayer: layer },
				{ auth: authService, logger: loggerService }
			);

			initGlobalLayerContext(propsRegistry, layerRegistry, [layer]);

			const { context } = createScriptContext({});
			const result = (context.useLayerProvider as (name: string) => unknown)(
				'multiLayer'
			) as Record<string, unknown>;

			expect(result.auth).toBe(authService);
			expect(result.logger).toBe(loggerService);
		});
	});

	describe('useLayer', () => {
		it('should throw when runtime is not ready', () => {
			const { context } = createScriptContext({});
			expect(() =>
				(context.useLayer as (name: string) => unknown)('missing')
			).toThrow();
		});

		it('should return layer context when runtime is ready', () => {
			const layer = createResolvedLayer({
				name: 'uiLayer',
				provides: {
					theme: () => 'dark',
				},
			});

			const propsRegistry = createMockPropsRegistry({
				uiLayer: { mode: signal('dark') },
			});
			const layerRegistry = createMockLayerRegistry(
				{ uiLayer: layer },
				{ theme: 'dark' }
			);

			initGlobalLayerContext(propsRegistry, layerRegistry, [layer]);

			const { context } = createScriptContext({});
			const layerCtx = (context.useLayer as (name: string) => unknown)(
				'uiLayer'
			) as { name: string; provides: Record<string, unknown> };

			expect(layerCtx.name).toBe('uiLayer');
			expect(layerCtx.provides).toBeDefined();
		});
	});

	describe('useLayerProps', () => {
		it('should return undefined when runtime is not ready', () => {
			const { context } = createScriptContext({});
			const result = (context.useLayerProps as (name: string) => unknown)(
				'testLayer'
			);
			expect(result).toBeUndefined();
		});

		it('should return layer props when runtime is ready', () => {
			const modeSignal = signal('dark');
			const layer = createResolvedLayer({ name: 'themeLayer' });

			const propsRegistry = createMockPropsRegistry({
				themeLayer: { mode: modeSignal },
			});
			const layerRegistry = createMockLayerRegistry({ themeLayer: layer });

			initGlobalLayerContext(propsRegistry, layerRegistry, [layer]);

			const { context } = createScriptContext({});
			const props = (context.useLayerProps as (name: string) => unknown)(
				'themeLayer'
			) as Record<string, unknown>;

			expect(props).toBeDefined();
			expect(props.mode).toBe(modeSignal);
		});
	});

	describe('useService', () => {
		it('should return undefined when runtime is not ready and no storeGetter', () => {
			const { context } = createScriptContext({});
			const result = context.useService('anything');
			expect(result).toBeUndefined();
		});

		it('should return cached service from registry', () => {
			const cachedService = { execute: vi.fn() };
			const layer = createResolvedLayer({ name: 'svcLayer' });

			const propsRegistry = createMockPropsRegistry({});
			const layerRegistry = createMockLayerRegistry(
				{ svcLayer: layer },
				{ myCmd: cachedService }
			);

			initGlobalLayerContext(propsRegistry, layerRegistry, [layer]);

			const { context } = createScriptContext({});
			const result = context.useService('myCmd');

			expect(result).toBe(cachedService);
		});
	});

	describe('useStore', () => {
		it('should fall back to storeGetter when runtime not ready', () => {
			const mockStore = { state: 'active' };
			const storeGetter = vi.fn().mockReturnValue(mockStore);

			const { context } = createScriptContext({}, storeGetter);
			const result = context.useStore('appStore');

			expect(storeGetter).toHaveBeenCalledWith('appStore');
			expect(result).toBe(mockStore);
		});

		it('should return from layer service when runtime is ready', () => {
			const cachedStore = { count: 0 };
			const layer = createResolvedLayer({ name: 'storeLayer' });

			const propsRegistry = createMockPropsRegistry({});
			const layerRegistry = createMockLayerRegistry(
				{ storeLayer: layer },
				{ counter: cachedStore }
			);

			initGlobalLayerContext(propsRegistry, layerRegistry, [layer]);

			const { context } = createScriptContext({});
			const result = context.useStore('counter');

			expect(result).toBe(cachedStore);
		});
	});
});
