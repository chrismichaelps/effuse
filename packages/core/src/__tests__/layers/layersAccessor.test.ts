import { describe, it, expect, vi, afterEach } from 'vitest';
import { defineHook } from '../../hooks/defineHook.js';
import { createHookContext } from '../../hooks/context.js';
import { defineLayer } from '../../layers/api/defineLayer.js';
import { resolveLayersAccessor } from '../../layers/api/layersAccessor.js';
import type { LayersAccessor } from '../../layers/api/layersAccessor.js';
import {
	initGlobalLayerContext,
	clearGlobalLayerContext,
} from '../../layers/context.js';
import type { PropsRegistry } from '../../layers/services/PropsService.js';
import type { LayerRegistry } from '../../layers/services/RegistryService.js';
import type { AnyResolvedLayer, LayerProps } from '../../layers/types.js';
import { signal } from '../../reactivity/signal.js';

const createMockPropsRegistry = (
	propsMap: Record<string, Record<string, unknown>> = {}
): PropsRegistry => {
	const props = new Map<string, LayerProps>(
		Object.entries(propsMap).map(([k, v]) => [k, v as LayerProps])
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
	services: Record<string, unknown> = {}
): LayerRegistry => ({
	layers: new Map(Object.entries(layers)),
	components: new Map(),
	services: new Map(Object.entries(services)),
	getLayer: (name: string) => layers[name],
	getComponent: () => undefined,
	getService: (key: string) => services[key],
	registerLayer: vi.fn(),
	registerComponent: vi.fn(),
	registerService: vi.fn(),
	hasLayer: (name: string) => name in layers,
	hasComponent: () => false,
	hasService: (key: string) => key in services,
});

const createResolvedLayer = (
	overrides: Partial<AnyResolvedLayer> & { name: string }
): AnyResolvedLayer =>
	({ _resolved: true as const, _order: 0, ...overrides }) as AnyResolvedLayer;

describe('LayersAccessor — comprehensive regression tests', () => {
	afterEach(() => {
		clearGlobalLayerContext();
	});

	describe('resolveLayersAccessor — runtime behavior', () => {
		it('should return an object keyed by layer name', () => {
			const layerA = defineLayer({ name: 'a' as const, provides: {} });
			const layerB = defineLayer({ name: 'b' as const, provides: {} });

			const resolved = resolveLayersAccessor([layerA, layerB]);

			expect(resolved).toHaveProperty('a');
			expect(resolved).toHaveProperty('b');
			expect(Object.keys(resolved).sort()).toEqual(['a', 'b']);
		});

		it('should expose props getter that lazily resolves from global context', () => {
			const modeSignal = signal('dark');
			const themeLayer = defineLayer({ name: 'theme', provides: {} });
			const resolvedLayer = createResolvedLayer({ name: 'theme' });

			const propsRegistry = createMockPropsRegistry({
				theme: { mode: modeSignal },
			});
			const layerRegistry = createMockLayerRegistry({ theme: resolvedLayer });
			initGlobalLayerContext(propsRegistry, layerRegistry, [resolvedLayer]);

			const accessor = resolveLayersAccessor([themeLayer]);

			expect(accessor.theme.props.mode).toBe(modeSignal);
		});

		it('should expose services getter that lazily resolves from global context', () => {
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
				{ authService }
			);
			initGlobalLayerContext(propsRegistry, layerRegistry, [resolvedLayer]);

			const accessor = resolveLayersAccessor([authLayer]);

			expect(accessor.auth.services.authService).toBe(authService);
		});

		it('should return cached service — factory NOT called on repeated access', () => {
			const factorySpy = vi.fn(() => ({ value: 'fresh' }));
			const cached = { value: 'cached' };

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
				{ myService: cached }
			);
			initGlobalLayerContext(propsRegistry, layerRegistry, [resolvedLayer]);

			const accessor = resolveLayersAccessor([myLayer]);

			const first = accessor.myLayer.services.myService;
			const second = accessor.myLayer.services.myService;

			expect(first).toBe(cached);
			expect(second).toBe(cached);
			expect(factorySpy).not.toHaveBeenCalled();
		});

		it('should handle multiple layers with distinct service keys', () => {
			const authSvc = { token: 'abc' };
			const logSvc = { log: vi.fn() };
			const storeSvc = { count: 0 };

			const authLayer = defineLayer({
				name: 'auth',
				provides: { authSvc: () => authSvc },
			});
			const logLayer = defineLayer({
				name: 'log',
				provides: { logSvc: () => logSvc },
			});
			const storeLayer = defineLayer({
				name: 'store',
				provides: { storeSvc: () => storeSvc },
			});

			const resolvedAuth = createResolvedLayer({
				name: 'auth',
				provides: { authSvc: () => authSvc },
			});
			const resolvedLog = createResolvedLayer({
				name: 'log',
				provides: { logSvc: () => logSvc },
			});
			const resolvedStore = createResolvedLayer({
				name: 'store',
				provides: { storeSvc: () => storeSvc },
			});

			const propsRegistry = createMockPropsRegistry({
				auth: {},
				log: {},
				store: {},
			});
			const layerRegistry = createMockLayerRegistry(
				{ auth: resolvedAuth, log: resolvedLog, store: resolvedStore },
				{ authSvc, logSvc, storeSvc }
			);
			initGlobalLayerContext(
				propsRegistry,
				layerRegistry,
				[resolvedAuth, resolvedLog, resolvedStore]
			);

			const accessor = resolveLayersAccessor([authLayer, logLayer, storeLayer]);

			expect(accessor.auth.services.authSvc).toBe(authSvc);
			expect(accessor.log.services.logSvc).toBe(logSvc);
			expect(accessor.store.services.storeSvc).toBe(storeSvc);
		});

		it('should handle layer with no provides (empty services object)', () => {
			const emptyLayer = defineLayer({ name: 'empty', provides: {} });
			const resolvedLayer = createResolvedLayer({ name: 'empty' });

			const propsRegistry = createMockPropsRegistry({ empty: {} });
			const layerRegistry = createMockLayerRegistry({ empty: resolvedLayer });
			initGlobalLayerContext(propsRegistry, layerRegistry, [resolvedLayer]);

			const accessor = resolveLayersAccessor([emptyLayer]);

			expect(accessor.empty.services).toEqual({});
		});

		it('should resolve props independently from services', () => {
			const themeSignal = signal('dark');
			const authSvc = { token: 'xyz' };

			const themeLayer = defineLayer({ name: 'theme', provides: {} });
			const authLayer = defineLayer({
				name: 'auth',
				provides: { authSvc: () => authSvc },
			});

			const resolvedTheme = createResolvedLayer({ name: 'theme' });
			const resolvedAuth = createResolvedLayer({
				name: 'auth',
				provides: { authSvc: () => authSvc },
			});

			const propsRegistry = createMockPropsRegistry({
				theme: { mode: themeSignal },
				auth: {},
			});
			const layerRegistry = createMockLayerRegistry(
				{ theme: resolvedTheme, auth: resolvedAuth },
				{ authSvc }
			);
			initGlobalLayerContext(propsRegistry, layerRegistry, [
				resolvedTheme,
				resolvedAuth,
			]);

			const accessor = resolveLayersAccessor([themeLayer, authLayer]);

			expect(accessor.theme.props.mode).toBe(themeSignal);
			expect(accessor.auth.services.authSvc).toBe(authSvc);
		});
	});

	describe('LayersAccessor — type inference per layer', () => {
		it('should infer distinct service types per layer key', () => {
			const strSvc = { value: 'string' };
			const numSvc = { value: 42 };

			const strLayer = defineLayer({
				name: 'strLayer',
				provides: { strService: () => strSvc },
			});
			const numLayer = defineLayer({
				name: 'numLayer',
				provides: { numService: () => numSvc },
			});

			const resolvedStr = createResolvedLayer({
				name: 'strLayer',
				provides: { strService: () => strSvc },
			});
			const resolvedNum = createResolvedLayer({
				name: 'numLayer',
				provides: { numService: () => numSvc },
			});

			const propsRegistry = createMockPropsRegistry({
				strLayer: {},
				numLayer: {},
			});
			const layerRegistry = createMockLayerRegistry(
				{ strLayer: resolvedStr, numLayer: resolvedNum },
				{ strService: strSvc, numService: numSvc }
			);
			initGlobalLayerContext(propsRegistry, layerRegistry, [
				resolvedStr,
				resolvedNum,
			]);

			const accessor = resolveLayersAccessor([strLayer, numLayer]);

			const strResult = accessor.strLayer.services.strService;
			const numResult = accessor.numLayer.services.numService;

			expect(strResult).toBe(strSvc);
			expect(numResult).toBe(numSvc);
		});

		it('should not conflate service types across layers — auth vs log', () => {
			const authSvc = { token: 'abc' };
			const logSvc = { log: vi.fn() };

			const authLayer = defineLayer({
				name: 'auth',
				provides: { authSvc: () => authSvc },
			});
			const logLayer = defineLayer({
				name: 'log',
				provides: { logSvc: () => logSvc },
			});

			const resolvedAuth = createResolvedLayer({
				name: 'auth',
				provides: { authSvc: () => authSvc },
			});
			const resolvedLog = createResolvedLayer({
				name: 'log',
				provides: { logSvc: () => logSvc },
			});

			const propsRegistry = createMockPropsRegistry({ auth: {}, log: {} });
			const layerRegistry = createMockLayerRegistry(
				{ auth: resolvedAuth, log: resolvedLog },
				{ authSvc, logSvc }
			);
			initGlobalLayerContext(propsRegistry, layerRegistry, [
				resolvedAuth,
				resolvedLog,
			]);

			const accessor = resolveLayersAccessor([authLayer, logLayer]);

			const a = accessor.auth.services.authSvc;
			const l = accessor.log.services.logSvc;

			expect(a).toBe(authSvc);
			expect(l).toBe(logSvc);
		});
	});

	describe('defineHook — layers accessor integration', () => {
		it('should pass layers accessor to hook setup ctx', () => {
			const authSvc = { token: 'abc' };
			const authLayer = defineLayer({
				name: 'auth',
				provides: { authSvc: () => authSvc },
			});
			const resolvedLayer = createResolvedLayer({
				name: 'auth',
				provides: { authSvc: () => authSvc },
			});

			const propsRegistry = createMockPropsRegistry({ auth: {} });
			const layerRegistry = createMockLayerRegistry(
				{ auth: resolvedLayer },
				{ authSvc }
			);
			initGlobalLayerContext(propsRegistry, layerRegistry, [resolvedLayer]);

			const useHook = defineHook({
				layers: [authLayer] as const,
				setup(ctx) {
					return ctx.layers.auth.services.authSvc;
				},
			});

			const result = useHook();
			expect(result).toBe(authSvc);
		});

		it('should not conflate services across layers in typed hook', () => {
			const authSvc = { token: 'abc' };
			const logSvc = { log: vi.fn() };

			const authLayer = defineLayer({
				name: 'auth',
				provides: { authSvc: () => authSvc },
			});
			const logLayer = defineLayer({
				name: 'log',
				provides: { logSvc: () => logSvc },
			});

			const resolvedAuth = createResolvedLayer({
				name: 'auth',
				provides: { authSvc: () => authSvc },
			});
			const resolvedLog = createResolvedLayer({
				name: 'log',
				provides: { logSvc: () => logSvc },
			});

			const propsRegistry = createMockPropsRegistry({ auth: {}, log: {} });
			const layerRegistry = createMockLayerRegistry(
				{ auth: resolvedAuth, log: resolvedLog },
				{ authSvc, logSvc }
			);
			initGlobalLayerContext(propsRegistry, layerRegistry, [
				resolvedAuth,
				resolvedLog,
			]);

			const useHook = defineHook({
				layers: [authLayer, logLayer] as const,
				setup(ctx) {
					return {
						auth: ctx.layers.auth.services.authSvc,
						log: ctx.layers.log.services.logSvc,
					};
				},
			});

			const result = useHook();
			expect(result.auth).toBe(authSvc);
			expect(result.log).toBe(logSvc);
		});

		it('should expose props via ctx.layers in defineHook', () => {
			const themeSignal = signal('dark');
			const themeLayer = defineLayer({ name: 'theme', provides: {} });
			const resolvedLayer = createResolvedLayer({ name: 'theme' });

			const propsRegistry = createMockPropsRegistry({
				theme: { mode: themeSignal },
			});
			const layerRegistry = createMockLayerRegistry({ theme: resolvedLayer });
			initGlobalLayerContext(propsRegistry, layerRegistry, [resolvedLayer]);

			const useHook = defineHook({
				layers: [themeLayer] as const,
				setup(ctx) {
					return ctx.layers.theme.props;
				},
			});

			const props = useHook();
			expect(props.mode).toBe(themeSignal);
		});

		it('should support three layers without service key collision', () => {
			const aSvc = { a: 1 };
			const bSvc = { b: 2 };
			const cSvc = { c: 3 };

			const layerA = defineLayer({ name: 'a', provides: { aSvc: () => aSvc } });
			const layerB = defineLayer({ name: 'b', provides: { bSvc: () => bSvc } });
			const layerC = defineLayer({ name: 'c', provides: { cSvc: () => cSvc } });

			const resolvedA = createResolvedLayer({ name: 'a', provides: { aSvc: () => aSvc } });
			const resolvedB = createResolvedLayer({ name: 'b', provides: { bSvc: () => bSvc } });
			const resolvedC = createResolvedLayer({ name: 'c', provides: { cSvc: () => cSvc } });

			const propsRegistry = createMockPropsRegistry({ a: {}, b: {}, c: {} });
			const layerRegistry = createMockLayerRegistry(
				{ a: resolvedA, b: resolvedB, c: resolvedC },
				{ aSvc, bSvc, cSvc }
			);
			initGlobalLayerContext(propsRegistry, layerRegistry, [
				resolvedA,
				resolvedB,
				resolvedC,
			]);

			const useHook = defineHook({
				layers: [layerA, layerB, layerC] as const,
				setup(ctx) {
					return {
						a: ctx.layers.a.services.aSvc,
						b: ctx.layers.b.services.bSvc,
						c: ctx.layers.c.services.cSvc,
					};
				},
			});

			const result = useHook();
			expect(result.a).toBe(aSvc);
			expect(result.b).toBe(bSvc);
			expect(result.c).toBe(cSvc);
		});
	});

	describe('createHookContext — layers accessor integration', () => {
		it('should expose layers property', () => {
			const { ctx } = createHookContext(undefined, []);
			expect(ctx.layers).toBeDefined();
		});

		it('should resolve props via lazy getter', () => {
			const modeSignal = signal('light');
			const themeLayer = defineLayer({ name: 'theme', provides: {} });
			const resolvedLayer = createResolvedLayer({ name: 'theme' });

			const propsRegistry = createMockPropsRegistry({
				theme: { mode: modeSignal },
			});
			const layerRegistry = createMockLayerRegistry({ theme: resolvedLayer });
			initGlobalLayerContext(propsRegistry, layerRegistry, [resolvedLayer]);

			const { ctx } = createHookContext(undefined, [themeLayer] as const);
			expect(ctx.layers.theme.props.mode).toBe(modeSignal);
		});

		it('should resolve services via lazy getter', () => {
			const authSvc = { token: 'abc' };
			const authLayer = defineLayer({
				name: 'auth',
				provides: { authSvc: () => authSvc },
			});
			const resolvedLayer = createResolvedLayer({
				name: 'auth',
				provides: { authSvc: () => authSvc },
			});

			const propsRegistry = createMockPropsRegistry({ auth: {} });
			const layerRegistry = createMockLayerRegistry(
				{ auth: resolvedLayer },
				{ authSvc }
			);
			initGlobalLayerContext(propsRegistry, layerRegistry, [resolvedLayer]);

			const { ctx } = createHookContext(undefined, [authLayer] as const);
			expect(ctx.layers.auth.services.authSvc).toBe(authSvc);
		});
	});

	describe('layer name — literal inference', () => {
		it('should preserve distinct layer names as literal types', () => {
			const authLayer = defineLayer({
				name: 'auth',
				provides: { authSvc: () => ({ token: 'x' }) },
			});
			const logLayer = defineLayer({
				name: 'log',
				provides: { logSvc: () => ({ log: vi.fn() }) },
			});

			const resolvedAuth = createResolvedLayer({
				name: 'auth',
				provides: { authSvc: () => ({ token: 'x' }) },
			});
			const resolvedLog = createResolvedLayer({
				name: 'log',
				provides: { logSvc: () => ({ log: vi.fn() }) },
			});

			const propsRegistry = createMockPropsRegistry({ auth: {}, log: {} });
			const layerRegistry = createMockLayerRegistry(
				{ auth: resolvedAuth, log: resolvedLog },
				{
					authSvc: { token: 'x' },
					logSvc: { log: vi.fn() },
				}
			);
			initGlobalLayerContext(propsRegistry, layerRegistry, [
				resolvedAuth,
				resolvedLog,
			]);

			const accessor = resolveLayersAccessor([authLayer, logLayer]);

			expect(accessor.auth).toBeDefined();
			expect(accessor.log).toBeDefined();
		});

		it('should not allow accessing wrong service key on wrong layer', () => {
			const authSvc = { token: 'abc' };
			const logSvc = { log: vi.fn() };

			const authLayer = defineLayer({
				name: 'auth',
				provides: { authSvc: () => authSvc },
			});
			const logLayer = defineLayer({
				name: 'log',
				provides: { logSvc: () => logSvc },
			});

			const resolvedAuth = createResolvedLayer({
				name: 'auth',
				provides: { authSvc: () => authSvc },
			});
			const resolvedLog = createResolvedLayer({
				name: 'log',
				provides: { logSvc: () => logSvc },
			});

			const propsRegistry = createMockPropsRegistry({ auth: {}, log: {} });
			const layerRegistry = createMockLayerRegistry(
				{ auth: resolvedAuth, log: resolvedLog },
				{ authSvc, logSvc }
			);
			initGlobalLayerContext(propsRegistry, layerRegistry, [
				resolvedAuth,
				resolvedLog,
			]);

			const accessor = resolveLayersAccessor([authLayer, logLayer]);

			expect(accessor.auth.services.authSvc).toBe(authSvc);
			expect(accessor.log.services.logSvc).toBe(logSvc);
		});
	});

	describe('edge cases', () => {
		it('should handle layer with single character name', () => {
			const svc = { x: 1 };
			const layer = defineLayer({ name: 'a', provides: { xSvc: () => svc } });
			const resolved = createResolvedLayer({ name: 'a', provides: { xSvc: () => svc } });

			const propsRegistry = createMockPropsRegistry({ a: {} });
			const layerRegistry = createMockLayerRegistry({ a: resolved }, { xSvc: svc });
			initGlobalLayerContext(propsRegistry, layerRegistry, [resolved]);

			const accessor = resolveLayersAccessor([layer]);
			expect(accessor.a.services.xSvc).toBe(svc);
		});

		it('should handle layer with numeric string name', () => {
			const svc = { val: 99 };
			const layer = defineLayer({ name: '123', provides: { numSvc: () => svc } });
			const resolved = createResolvedLayer({ name: '123', provides: { numSvc: () => svc } });

			const propsRegistry = createMockPropsRegistry({ '123': {} });
			const layerRegistry = createMockLayerRegistry({ '123': resolved }, { numSvc: svc });
			initGlobalLayerContext(propsRegistry, layerRegistry, [resolved]);

			const accessor = resolveLayersAccessor([layer]);
			expect(accessor['123'].services.numSvc).toBe(svc);
		});

		it('should handle layer with camelCase name', () => {
			const svc = { db: 'pg' };
			const layer = defineLayer({ name: 'myDbLayer', provides: { dbService: () => svc } });
			const resolved = createResolvedLayer({ name: 'myDbLayer', provides: { dbService: () => svc } });

			const propsRegistry = createMockPropsRegistry({ myDbLayer: {} });
			const layerRegistry = createMockLayerRegistry({ myDbLayer: resolved }, { dbService: svc });
			initGlobalLayerContext(propsRegistry, layerRegistry, [resolved]);

			const accessor = resolveLayersAccessor([layer]);
			expect(accessor.myDbLayer.services.dbService).toBe(svc);
		});

		it('should handle multiple services in a single layer', () => {
			const authSvc = { token: 'abc' };
			const userSvc = { name: 'Chris' };

			const combinedLayer = defineLayer({
				name: 'combined',
				provides: {
					authSvc: () => authSvc,
					userSvc: () => userSvc,
				},
			});
			const resolvedLayer = createResolvedLayer({
				name: 'combined',
				provides: {
					authSvc: () => authSvc,
					userSvc: () => userSvc,
				},
			});

			const propsRegistry = createMockPropsRegistry({ combined: {} });
			const layerRegistry = createMockLayerRegistry(
				{ combined: resolvedLayer },
				{ authSvc, userSvc }
			);
			initGlobalLayerContext(propsRegistry, layerRegistry, [resolvedLayer]);

			const accessor = resolveLayersAccessor([combinedLayer]);

			expect(accessor.combined.services.authSvc).toBe(authSvc);
			expect(accessor.combined.services.userSvc).toBe(userSvc);
		});
	});
});