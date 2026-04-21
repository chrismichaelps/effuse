import { describe, it, expect, vi, afterEach, expectTypeOf } from 'vitest';
import { defineHook } from '../../hooks/defineHook.js';
import { createHookContext } from '../../hooks/context.js';
import { defineLayer } from '../../layers/api/defineLayer.js';
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

describe('defineHook — typed layers accessor', () => {
	afterEach(() => {
		clearGlobalLayerContext();
	});

	describe('layers accessor in HookContext', () => {
		it('should expose an empty layers accessor when no layers passed', () => {
			const useHook = defineHook({
				setup(ctx) {
					return ctx.layers;
				},
			});

			const result = useHook();
			expect(result).toBeDefined();
			expect(typeof result).toBe('object');
		});

		it('should expose props for a layer via ctx.layers', () => {
			const modeSignal = signal('dark');
			const themeLayer = defineLayer({ name: 'theme', provides: {} });
			const resolvedLayer = createResolvedLayer({ name: 'theme' });
			const propsRegistry = createMockPropsRegistry({
				theme: { mode: modeSignal },
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
			expect(props).toBeDefined();
			expect(props.mode).toBe(modeSignal);
		});

		it('should expose services for a layer via ctx.layers', () => {
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
			initGlobalLayerContext(propsRegistry, layerRegistry, [resolvedLayer]);

			const useHook = defineHook({
				layers: [authLayer] as const,
				setup(ctx) {
					return ctx.layers.auth.services;
				},
			});

			const services = useHook();
			expect(services.authService).toBe(authService);
		});

		it('should return cached service, not re-invoke factory', () => {
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
			initGlobalLayerContext(propsRegistry, layerRegistry, [resolvedLayer]);

			const useHook = defineHook({
				layers: [myLayer] as const,
				setup(ctx) {
					return ctx.layers.myLayer.services.myService;
				},
			});

			const svc = useHook();
			expect(svc).toBe(cachedInstance);
			expect(factorySpy).not.toHaveBeenCalled();
		});

		it('should support multiple layers in accessor', () => {
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
			initGlobalLayerContext(propsRegistry, layerRegistry, [resolvedAuth, resolvedLog]);

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
	});

	describe('createHookContext — layers accessor', () => {
		it('should expose layers property on context', () => {
			const { ctx } = createHookContext(undefined, []);
			expect(ctx.layers).toBeDefined();
		});

		it('should resolve props via lazy getter on ctx.layers', () => {
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
	});

	describe('defineHook — config', () => {
		it('should pass config to setup as ctx.config', () => {
			const useHook = defineHook({
				setup(ctx) {
					return ctx.config;
				},
			});

			const result = useHook();
			expect(result).toBeUndefined();
		});

		it('should pass typed config when C is defined', () => {
			interface MyConfig {
				threshold: number;
			}

			const useHook = defineHook<MyConfig, MyConfig>({
				setup(ctx) {
					return ctx.config;
				},
			});

			const result = useHook({ threshold: 42 });
			expect(result.threshold).toBe(42);
		});
	});

	describe('defineHook — signal and computed in setup', () => {
		it('should expose signal factory in ctx', () => {
			const useHook = defineHook({
				setup(ctx) {
					const count = ctx.signal(0);
					return count;
				},
			});

			const count = useHook();
			expect(count.value).toBe(0);
			count.value = 5;
			expect(count.value).toBe(5);
		});

		it('should expose computed in ctx', () => {
			const useHook = defineHook({
				setup(ctx) {
					const count = ctx.signal(3);
					const doubled = ctx.computed(() => count.value * 2);
					return doubled;
				},
			});

			const doubled = useHook();
			expect(doubled.value).toBe(6);
		});
	});
});
