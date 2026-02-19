import { describe, it, expect, vi, afterEach } from 'vitest';
import { Effect } from 'effect';
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

	describe('effect (auto-scoped)', () => {
		it('should create an auto-tracked effect that runs immediately', async () => {
			const { context } = createScriptContext({});
			const count = signal(0);
			const calls: number[] = [];

			context.effect(() => {
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

			const handle = context.effect(() => {
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

			context.effect(() => {
				calls.push(count.value);
			});

			await new Promise((r) => setTimeout(r, 10));
			expect(calls).toContain(0);

			Effect.runSync(state.lifecycle.runCleanup());
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

			Effect.runSync(state.lifecycle.runCleanup());
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

			initGlobalLayerContext(propsRegistry, layerRegistry, [layer]);

			const { context } = createScriptContext({});
			const result = context.useComponent('Header');

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

			initGlobalLayerContext(propsRegistry, layerRegistry, [layer]);

			const { context } = createScriptContext({});
			const result = context.useComponent('NonExistent');

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

			initGlobalLayerContext(propsRegistry, layerRegistry, [layer]);

			const { context } = createScriptContext({});

			expect(context.useComponent('MyHeader')).toBe(HeaderComponent);
			expect(context.useComponent('MyFooter')).toBe(FooterComponent);

			expect(context.useComponent('HeaderComponent')).toBeUndefined();
			expect(context.useComponent('FooterComponent')).toBeUndefined();
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

			Effect.runSync(state.lifecycle.runCleanup());
			const callsAfterUnmount = calls.length;

			count.value = 42;
			await new Promise((r) => setTimeout(r, 10));

			expect(calls.length).toBe(callsAfterUnmount);
		});
	});
});
