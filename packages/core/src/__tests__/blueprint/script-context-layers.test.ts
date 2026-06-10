import { describe, it, expect, expectTypeOf, vi, afterEach } from 'vitest';
import { createScriptContext } from '../../blueprint/script-context.js';
import { runWithLayerContext } from '../../layers/context.js';
import { defineLayer } from '../../layers/api/defineLayer.js';
import type { LayerServicesFrom } from '../../layers/api/defineLayer.js';
import type { PropsRegistry } from '../../layers/services/PropsService.js';
import type { LayerRegistry } from '../../layers/services/RegistryService.js';
import type { AnyResolvedLayer, LayerProps } from '../../layers/types.js';
import type { Component } from '../../render/node.js';
import { signal } from '../../reactivity/signal.js';

const createMockPropsRegistry = (
	propsMap: Record<string, Record<string, unknown>> = {}
): PropsRegistry => {
	const props = new Map<string, LayerProps>(
		Object.entries(propsMap).map(([k, v]) => [
			k,
			Object.fromEntries(
				Object.entries(v).map(([key, value]) => [key, value])
			) as LayerProps,
		])
	);
	return {
		props,
		get: (name: string) => props.get(name),
		set: vi.fn(),
		has: (name: string) => props.has(name),
	};
};

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

describe('ScriptContext - layers accessor', () => {
	describe('layers property', () => {
		it('should expose an empty accessor when no layers are passed', () => {
			const { context } = createScriptContext({}, undefined, []);
			expect(context.layers).toBeDefined();
			expect(typeof context.layers).toBe('object');
		});

		it('should expose props for a registered layer via accessor', () => {
			const modeSignal = signal('dark');
			const themeLayer = defineLayer({
				name: 'theme',
				provides: {},
			});
			const resolvedLayer = createResolvedLayer({ name: 'theme' });
			const propsRegistry = createMockPropsRegistry({
				theme: { mode: modeSignal },
			});
			const layerRegistry = createMockLayerRegistry({ theme: resolvedLayer });
			const store = { propsRegistry, layerRegistry, layers: [resolvedLayer] };

			const { context } = createScriptContext({}, undefined, [themeLayer]);
			const themeProps = runWithLayerContext(
				store,
				() => context.layers.theme.props
			);

			expect(themeProps).toBeDefined();
			expect(themeProps.mode).toBe(modeSignal);
		});

		it('should expose services for a layer via accessor', () => {
			const authService = { token: 'abc' };
			const authLayer = defineLayer({
				name: 'auth',
				provides: {
					authService: () => authService,
				},
			});
			const resolvedLayer = createResolvedLayer({
				name: 'auth',
				provides: { authService: () => authService },
			});
			const propsRegistry = createMockPropsRegistry({ auth: {} });
			const layerRegistry = createMockLayerRegistry(
				{ auth: resolvedLayer },
				{ authService: authService }
			);
			const store = { propsRegistry, layerRegistry, layers: [resolvedLayer] };

			const { context } = createScriptContext({}, undefined, [authLayer]);
			const services = runWithLayerContext(
				store,
				() => context.layers.auth.services
			);

			expect(services.authService).toBe(authService);
		});

		it('should expose typed layer entries directly from the layer object', () => {
			const authService = { token: 'abc', currentUser: 'chris' };
			const modeSignal = signal('strict');
			const authLayer = defineLayer({
				name: 'auth-direct',
				services: {
					authService: () => authService,
				},
			});
			const resolvedLayer = createResolvedLayer({
				name: 'auth-direct',
				provides: { authService: () => authService },
			});
			const propsRegistry = createMockPropsRegistry({
				'auth-direct': { mode: modeSignal },
			});
			const layerRegistry = createMockLayerRegistry(
				{ 'auth-direct': resolvedLayer },
				{ authService }
			);
			const store = { propsRegistry, layerRegistry, layers: [resolvedLayer] };

			const { context } = createScriptContext({});

			expectTypeOf<
				LayerServicesFrom<typeof authLayer>['authService']
			>().toEqualTypeOf<{
				token: string;
				currentUser: string;
			}>();
			const snapshot = runWithLayerContext(store, () => {
				const entry = context.useLayer(authLayer);
				return {
					service: entry.services.authService,
					mode: entry.props.mode,
				};
			});

			expect(snapshot.service).toBe(authService);
			expect(snapshot.mode).toBe(modeSignal);
		});

		it('should read a typed service directly from a layer object', () => {
			const authService = { token: 'abc' };
			const authLayer = defineLayer({
				name: 'auth-service-direct',
				services: {
					authService: () => authService,
				},
			});
			const resolvedLayer = createResolvedLayer({
				name: 'auth-service-direct',
				provides: { authService: () => authService },
			});
			const propsRegistry = createMockPropsRegistry({
				'auth-service-direct': {},
			});
			const layerRegistry = createMockLayerRegistry(
				{ 'auth-service-direct': resolvedLayer },
				{ authService }
			);
			const store = { propsRegistry, layerRegistry, layers: [resolvedLayer] };

			const { context } = createScriptContext({});
			const service = runWithLayerContext(store, () =>
				context.useService(authLayer, 'authService')
			);

			expectTypeOf(service).toEqualTypeOf<{ token: string }>();
			expect(service).toBe(authService);
		});

		it('should return cached service instances (not re-invoke factory)', () => {
			const factorySpy = vi.fn(() => ({ value: 'fresh' }));
			const cachedInstance = { value: 'cached' };

			const myLayer = defineLayer({
				name: 'myLayer',
				provides: { myService: factorySpy },
			});
			const resolvedLayer = createResolvedLayer({
				name: 'myLayer',
				provides: { myService: factorySpy },
			});
			const propsRegistry = createMockPropsRegistry({ myLayer: {} });
			const layerRegistry = createMockLayerRegistry(
				{ myLayer: resolvedLayer },
				{ myService: cachedInstance }
			);
			const store = { propsRegistry, layerRegistry, layers: [resolvedLayer] };

			const { context } = createScriptContext({}, undefined, [myLayer]);

			expect(
				runWithLayerContext(
					store,
					() => context.layers.myLayer.services.myService
				)
			).toBe(cachedInstance);
			expect(
				runWithLayerContext(
					store,
					() => context.layers.myLayer.services.myService
				)
			).toBe(cachedInstance);
			expect(factorySpy).not.toHaveBeenCalled();
		});

		it('should support multiple layers in the accessor', () => {
			const authService = { token: 'abc' };
			const logService = { log: vi.fn() };

			const authLayer = defineLayer({
				name: 'auth',
				provides: { authService: () => authService },
			});
			const logLayer = defineLayer({
				name: 'log',
				provides: { logService: () => logService },
			});

			const resolvedAuth = createResolvedLayer({
				name: 'auth',
				provides: { authService: () => authService },
			});
			const resolvedLog = createResolvedLayer({
				name: 'log',
				provides: { logService: () => logService },
			});

			const propsRegistry = createMockPropsRegistry({ auth: {}, log: {} });
			const layerRegistry = createMockLayerRegistry(
				{ auth: resolvedAuth, log: resolvedLog },
				{ authService: authService, logService: logService }
			);
			const store = {
				propsRegistry,
				layerRegistry,
				layers: [resolvedAuth, resolvedLog],
			};

			const { context } = createScriptContext({}, undefined, [
				authLayer,
				logLayer,
			]);

			expect(
				runWithLayerContext(
					store,
					() => context.layers.auth.services.authService
				)
			).toBe(authService);
			expect(
				runWithLayerContext(store, () => context.layers.log.services.logService)
			).toBe(logService);
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

			const store = { propsRegistry, layerRegistry, layers: [layer] };

			const { context } = createScriptContext({});
			const result = runWithLayerContext(store, () =>
				context.useService('myCmd')
			);

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

			const store = { propsRegistry, layerRegistry, layers: [layer] };

			const { context } = createScriptContext({});
			const result = runWithLayerContext(store, () =>
				context.useStore('counter')
			);

			expect(result).toBe(cachedStore);
		});
	});

	describe('watch (enhanced)', () => {
		it('should provide oldValue in callback', async () => {
			const { context } = createScriptContext({});
			const count = signal(0);
			const captured: { newVal: number; oldVal: number | undefined }[] = [];

			context.watch(
				count,
				(newValue, oldValue) => {
					captured.push({ newVal: newValue, oldVal: oldValue });
				},
				{ immediate: true }
			);

			await new Promise((r) => setTimeout(r, 10));

			count.value = 1;
			await new Promise((r) => setTimeout(r, 10));

			count.value = 2;
			await new Promise((r) => setTimeout(r, 10));

			expect(captured.length).toBeGreaterThanOrEqual(2);

			expect(captured[0].oldVal).toBeUndefined();
			expect(captured[0].newVal).toBe(0);

			expect(captured[1].oldVal).toBe(0);
			expect(captured[1].newVal).toBe(1);
		});

		it('should support once option', async () => {
			const { context } = createScriptContext({});
			const count = signal(0);
			const calls: number[] = [];

			context.watch(
				count,
				(newValue) => {
					calls.push(newValue);
				},
				{ immediate: true, once: true }
			);

			await new Promise((r) => setTimeout(r, 10));

			count.value = 1;
			await new Promise((r) => setTimeout(r, 10));

			count.value = 2;
			await new Promise((r) => setTimeout(r, 10));

			expect(calls.length).toBe(2);
		});

		it('should provide onCleanup to callback', async () => {
			const { context } = createScriptContext({});
			const count = signal(0);
			const cleanupSpy = vi.fn();

			context.watch(
				count,
				(_newValue, _oldValue, onCleanup) => {
					onCleanup(cleanupSpy);
				},
				{ immediate: true }
			);

			await new Promise((r) => setTimeout(r, 10));

			count.value = 1;
			await new Promise((r) => setTimeout(r, 10));

			expect(cleanupSpy).toHaveBeenCalled();
		});
	});

	describe('computed', () => {
		it('should create a reactive computed value', () => {
			const { context } = createScriptContext({});
			const first = signal('John');
			const last = signal('Doe');

			const fullName = context.computed(() => `${first.value} ${last.value}`);

			expect(fullName.value).toBe('John Doe');
		});

		it('should update when dependencies change', () => {
			const { context } = createScriptContext({});
			const count = signal(2);
			const doubled = context.computed(() => count.value * 2);

			expect(doubled.value).toBe(4);

			count.value = 5;
			expect(doubled.value).toBe(10);
		});

		it('should return a readonly signal (no setter)', () => {
			const { context } = createScriptContext({});
			const val = context.computed(() => 42);

			expect(val.value).toBe(42);
			expect(() => {
				(val as { value: number }).value = 99;
			}).toThrow();
			expect(val.value).toBe(42);
		});
	});

	describe('watchEffect (auto-scoped)', () => {
		it('should create an auto-tracked effect that runs immediately', async () => {
			const { context } = createScriptContext({});
			const count = signal(0);
			const calls: number[] = [];

			context.watchEffect(() => {
				calls.push(count.value);
			});

			await new Promise((r) => setTimeout(r, 10));
			expect(calls).toContain(0);

			count.value = 5;
			await new Promise((r) => setTimeout(r, 10));
			expect(calls).toContain(5);
		});

		it('should return an EffectHandle with stop/pause/resume', async () => {
			const { context } = createScriptContext({});
			const count = signal(0);
			const calls: number[] = [];

			const handle = context.watchEffect(() => {
				calls.push(count.value);
			});

			expect(handle).toBeDefined();
			expect(typeof handle.stop).toBe('function');
			expect(typeof handle.pause).toBe('function');
			expect(typeof handle.resume).toBe('function');

			await new Promise((r) => setTimeout(r, 10));
			handle.pause();

			count.value = 10;
			await new Promise((r) => setTimeout(r, 10));
			expect(calls).not.toContain(10);

			handle.resume();
			await new Promise((r) => setTimeout(r, 10));
			expect(calls).toContain(10);
		});

		it('should auto-stop when component unmounts', async () => {
			const { context, state } = createScriptContext({});
			const count = signal(0);
			const calls: number[] = [];

			context.watchEffect(() => {
				calls.push(count.value);
			});

			await new Promise((r) => setTimeout(r, 10));
			expect(calls).toContain(0);

			state.lifecycle.runCleanup();
			const callsAfterUnmount = calls.length;

			count.value = 99;
			await new Promise((r) => setTimeout(r, 10));

			expect(calls.length).toBe(callsAfterUnmount);
		});
	});

	describe('watchMultiple (auto-scoped)', () => {
		it('should watch multiple signals and fire callback with all values', async () => {
			const { context } = createScriptContext({});
			const first = signal('John');
			const last = signal('Doe');
			const captured: { newVals: unknown[]; oldVals: unknown[] }[] = [];

			context.watchMultiple(
				[first, last] as const,
				(newValues, oldValues) => {
					captured.push({
						newVals: [...newValues],
						oldVals: [...oldValues],
					});
				},
				{ immediate: true }
			);

			await new Promise((r) => setTimeout(r, 10));

			expect(captured.length).toBeGreaterThanOrEqual(1);
			expect(captured[0].newVals).toEqual(['John', 'Doe']);
		});

		it('should provide oldValues when sources change', async () => {
			const { context } = createScriptContext({});
			const a = signal(1);
			const b = signal(2);
			const captured: { newVals: unknown[]; oldVals: unknown[] }[] = [];

			context.watchMultiple(
				[a, b] as const,
				(newValues, oldValues) => {
					captured.push({
						newVals: [...newValues],
						oldVals: [...oldValues],
					});
				},
				{ immediate: true }
			);

			await new Promise((r) => setTimeout(r, 10));

			a.value = 10;
			await new Promise((r) => setTimeout(r, 10));

			expect(captured.length).toBeGreaterThanOrEqual(2);
			const lastCapture = captured[captured.length - 1];
			expect(lastCapture.newVals[0]).toBe(10);
			expect(lastCapture.oldVals[0]).toBe(1);
		});

		it('should auto-stop when component unmounts', async () => {
			const { context, state } = createScriptContext({});
			const a = signal(1);
			const calls: unknown[][] = [];

			context.watchMultiple(
				[a] as const,
				(newValues) => {
					calls.push([...newValues]);
				},
				{ immediate: true }
			);

			await new Promise((r) => setTimeout(r, 10));
			expect(calls.length).toBeGreaterThanOrEqual(1);

			state.lifecycle.runCleanup();
			const callsAfterUnmount = calls.length;

			a.value = 99;
			await new Promise((r) => setTimeout(r, 10));

			expect(calls.length).toBe(callsAfterUnmount);
		});
	});

	describe('useComponent', () => {
		it('should return undefined when runtime is not ready', () => {
			const { context } = createScriptContext({});
			const result = context.useComponent('Header');
			expect(result).toBeUndefined();
		});

		it('should return a registered component when runtime is ready', () => {
			const mockComponent = (() => null) as unknown as Component;

			const layer = createResolvedLayer({
				name: 'uiLayer',
			});

			const propsRegistry = createMockPropsRegistry({
				uiLayer: {},
			});
			const layerRegistry = createMockLayerRegistry(
				{ uiLayer: layer },
				{},
				{ Header: mockComponent }
			);

			const store = { propsRegistry, layerRegistry, layers: [layer] };

			const { context } = createScriptContext({});
			const result = runWithLayerContext(store, () =>
				context.useComponent('Header')
			);

			expect(result).toBe(mockComponent);
		});

		it('should return undefined for unregistered component name', () => {
			const layer = createResolvedLayer({
				name: 'uiLayer',
			});

			const propsRegistry = createMockPropsRegistry({
				uiLayer: {},
			});
			const layerRegistry = createMockLayerRegistry(
				{ uiLayer: layer },
				{},
				{ Header: (() => null) as unknown as Component }
			);

			const store = { propsRegistry, layerRegistry, layers: [layer] };

			const { context } = createScriptContext({});
			const result = runWithLayerContext(store, () =>
				context.useComponent('NonExistent')
			);

			expect(result).toBeUndefined();
		});

		it('should resolve aliased component names (MyHeader: HeaderComponent)', () => {
			const HeaderComponent = (() => 'header') as unknown as Component;
			const FooterComponent = (() => 'footer') as unknown as Component;

			const layer = createResolvedLayer({
				name: 'uiLayer',
			});

			const propsRegistry = createMockPropsRegistry({
				uiLayer: {},
			});
			const layerRegistry = createMockLayerRegistry(
				{ uiLayer: layer },
				{},
				{ MyHeader: HeaderComponent, MyFooter: FooterComponent }
			);

			const store = { propsRegistry, layerRegistry, layers: [layer] };

			const { context } = createScriptContext({});

			expect(
				runWithLayerContext(store, () => context.useComponent('MyHeader'))
			).toBe(HeaderComponent);
			expect(
				runWithLayerContext(store, () => context.useComponent('MyFooter'))
			).toBe(FooterComponent);

			expect(
				runWithLayerContext(store, () =>
					context.useComponent('HeaderComponent')
				)
			).toBeUndefined();
			expect(
				runWithLayerContext(store, () =>
					context.useComponent('FooterComponent')
				)
			).toBeUndefined();
		});
	});

	describe('watch auto-stop on unmount', () => {
		it('should stop watching after component unmounts', async () => {
			const { context, state } = createScriptContext({});
			const count = signal(0);
			const calls: number[] = [];

			context.watch(
				count,
				(newValue) => {
					calls.push(newValue);
				},
				{ immediate: true }
			);

			await new Promise((r) => setTimeout(r, 10));
			expect(calls).toContain(0);

			state.lifecycle.runCleanup();
			const callsAfterUnmount = calls.length;

			count.value = 42;
			await new Promise((r) => setTimeout(r, 10));

			expect(calls.length).toBe(callsAfterUnmount);
		});
	});

	describe('define() with layers option', () => {
		it('should pass layers to script context and expose layers accessor', () => {
			const authService = { token: 'abc' };
			const authLayer = defineLayer({
				name: 'auth',
				provides: { authService: () => authService },
			});
			const resolvedLayer = createResolvedLayer({
				name: 'auth',
				provides: { authService: () => authService },
			});
			const propsRegistry = createMockPropsRegistry({ auth: {} });
			const layerRegistry = createMockLayerRegistry(
				{ auth: resolvedLayer },
				{ authService: authService }
			);
			const store = { propsRegistry, layerRegistry, layers: [resolvedLayer] };

			let capturedLayers: unknown;

			const { context } = createScriptContext({}, undefined, [authLayer]);
			capturedLayers = runWithLayerContext(store, () => context.layers);

			expect(capturedLayers).toBeDefined();
			const typedLayers = capturedLayers as {
				auth: { services: Record<string, unknown> };
			};
			expect(
				runWithLayerContext(store, () => typedLayers.auth.services.authService)
			).toBe(authService);
		});
	});
});
