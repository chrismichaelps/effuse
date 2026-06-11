import { describe, it, expect, expectTypeOf, vi, afterEach } from 'vitest';
import { defineHook } from '../../hooks/defineHook.js';
import { createHookContext } from '../../hooks/context.js';
import {
	defineLayer,
	resolveLayerDefinitions,
} from '../../layers/api/defineLayer.js';
import { resolveLayersAccessor } from '../../layers/api/layersAccessor.js';
import type { LayersAccessor } from '../../layers/api/layersAccessor.js';
import {
	clearGlobalLayerContext,
	getGlobalLayerContextStore,
	getLayerService,
	isLayerRuntimeReady,
	runWithLayerContext,
} from '../../layers/context.js';
import {
	LayerNameCollisionError,
	ServiceNotFoundError,
} from '../../layers/errors.js';
import { createLayerRuntime } from '../../layers/internal/runtime.js';
import type { PropsRegistry } from '../../layers/services/PropsService.js';
import type { LayerRegistry } from '../../layers/services/RegistryService.js';
import {
	clearGlobalTracing,
	getGlobalTracing,
} from '../../layers/tracing/index.js';
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
		clearGlobalTracing();
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

		it('should reject duplicate layer names in list form', () => {
			const firstLayer = defineLayer({
				name: 'auth',
				services: { first: () => ({ token: 'first' }) },
			});
			const secondLayer = defineLayer({
				name: 'auth',
				services: { second: () => ({ token: 'second' }) },
			});

			expect(() =>
				resolveLayersAccessor([firstLayer, secondLayer] as const)
			).toThrow(LayerNameCollisionError);
			expect(() =>
				resolveLayersAccessor([firstLayer, secondLayer] as const)
			).toThrow(
				'[Effuse] Layer "auth" is registered more than once. Use unique layer names or an alias record when you need explicit local names.'
			);
		});

		it('should key alias records by local alias instead of layer name', () => {
			const authSvc = { token: 'abc' };
			const modeSignal = signal('strict');
			const identityLayer = defineLayer({
				name: 'platformIdentity',
				services: { authSvc: () => authSvc },
			});
			const resolvedLayer = createResolvedLayer({
				name: 'platformIdentity',
				provides: { authSvc: () => authSvc },
			});

			const propsRegistry = createMockPropsRegistry({
				platformIdentity: { mode: modeSignal },
			});
			const layerRegistry = createMockLayerRegistry(
				{ platformIdentity: resolvedLayer },
				{ authSvc }
			);
			const store = { propsRegistry, layerRegistry, layers: [resolvedLayer] };

			const accessor = resolveLayersAccessor({ auth: identityLayer } as const);

			expect(Object.keys(accessor)).toEqual(['auth']);
			expect('platformIdentity' in accessor).toBe(false);
			expect(
				runWithLayerContext(store, () => accessor.auth.services.authSvc)
			).toBe(authSvc);
			expect(
				runWithLayerContext(store, () => accessor.auth.props.mode)
			).toBe(modeSignal);
		});

		it('should expose props getter that lazily resolves from global context', () => {
			const modeSignal = signal('dark');
			const themeLayer = defineLayer({ name: 'theme', provides: {} });
			const resolvedLayer = createResolvedLayer({ name: 'theme' });

			const propsRegistry = createMockPropsRegistry({
				theme: { mode: modeSignal },
			});
			const layerRegistry = createMockLayerRegistry({ theme: resolvedLayer });
			const store = { propsRegistry, layerRegistry, layers: [resolvedLayer] };

			const accessor = resolveLayersAccessor([themeLayer]);

			expect(runWithLayerContext(store, () => accessor.theme.props.mode)).toBe(modeSignal);
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
			const store = { propsRegistry, layerRegistry, layers: [resolvedLayer] };

			const accessor = resolveLayersAccessor([authLayer]);

			expect(runWithLayerContext(store, () => accessor.auth.services.authService)).toBe(authService);
		});

		it('should throw an actionable error when a declared service is missing from runtime registration', () => {
			const authLayer = defineLayer({
				name: 'auth',
				provides: { authService: () => ({ token: 'abc' }) },
			});
			const resolvedLayer = createResolvedLayer({
				name: 'auth',
				provides: { authService: () => ({ token: 'abc' }) },
			});

			const propsRegistry = createMockPropsRegistry({ auth: {} });
			const layerRegistry = createMockLayerRegistry({ auth: resolvedLayer });
			const store = { propsRegistry, layerRegistry, layers: [resolvedLayer] };
			const accessor = resolveLayersAccessor([authLayer]);

			expect(() =>
				runWithLayerContext(store, () => accessor.auth.services.authService)
			).toThrow(ServiceNotFoundError);
			expect(() =>
				runWithLayerContext(store, () => accessor.auth.services.authService)
			).toThrow('registered with app.useLayers()');
		});

		it('should keep services bag identity stable while refreshing values from context', () => {
			const authServiceA = { token: 'a' };
			const authServiceB = { token: 'b' };
			const authLayer = defineLayer({
				name: 'auth',
				provides: { authService: () => authServiceA },
			});
			const resolvedLayer = createResolvedLayer({
				name: 'auth',
				provides: { authService: () => authServiceA },
			});

			const propsRegistry = createMockPropsRegistry({ auth: {} });
			const storeA = {
				propsRegistry,
				layerRegistry: createMockLayerRegistry(
					{ auth: resolvedLayer },
					{ authService: authServiceA }
				),
				layers: [resolvedLayer],
			};
			const storeB = {
				propsRegistry,
				layerRegistry: createMockLayerRegistry(
					{ auth: resolvedLayer },
					{ authService: authServiceB }
				),
				layers: [resolvedLayer],
			};
			const accessor = resolveLayersAccessor([authLayer]);

			const firstServices = runWithLayerContext(
				storeA,
				() => accessor.auth.services
			);
			const secondServices = runWithLayerContext(
				storeA,
				() => accessor.auth.services
			);

			expect(firstServices).toBe(secondServices);
			expect(Object.keys(firstServices)).toEqual(['authService']);
			expect(firstServices.authService).toBe(authServiceA);
			expect(runWithLayerContext(storeB, () => firstServices.authService)).toBe(
				authServiceB
			);
			expect(firstServices.authService).toBe(authServiceB);
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
			const store = { propsRegistry, layerRegistry, layers: [resolvedLayer] };

			const accessor = resolveLayersAccessor([myLayer]);

			const first = runWithLayerContext(store, () => accessor.myLayer.services.myService);
			const second = runWithLayerContext(store, () => accessor.myLayer.services.myService);

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
			const store = { propsRegistry, layerRegistry, layers: [resolvedAuth, resolvedLog, resolvedStore] };

			const accessor = resolveLayersAccessor([authLayer, logLayer, storeLayer]);

			expect(runWithLayerContext(store, () => accessor.auth.services.authSvc)).toBe(authSvc);
			expect(runWithLayerContext(store, () => accessor.log.services.logSvc)).toBe(logSvc);
			expect(runWithLayerContext(store, () => accessor.store.services.storeSvc)).toBe(storeSvc);
		});

		it('should handle layer with no provides (empty services object)', () => {
			const emptyLayer = defineLayer({ name: 'empty', provides: {} });
			const resolvedLayer = createResolvedLayer({ name: 'empty' });

			const propsRegistry = createMockPropsRegistry({ empty: {} });
			const layerRegistry = createMockLayerRegistry({ empty: resolvedLayer });
			const store = { propsRegistry, layerRegistry, layers: [resolvedLayer] };

			const accessor = resolveLayersAccessor([emptyLayer]);

			expect(runWithLayerContext(store, () => accessor.empty.services)).toEqual({});
		});

		it('should expose services after createLayerRuntime initializes the app context', async () => {
			const svc = { health: 'ok' };
			const runtimeLayer = defineLayer({
				name: 'runtime',
				services: { runtimeSvc: () => svc },
			});
			const runtime = await createLayerRuntime(
				resolveLayerDefinitions([runtimeLayer])
			);

			try {
				const accessor = resolveLayersAccessor([runtimeLayer]);

				expect(accessor.runtime.services.runtimeSvc).toBe(svc);
			} finally {
				await runtime.dispose();
			}
		});

		it('should isolate registry instances across app runtimes', async () => {
			const firstSvc = { source: 'first-runtime' };
			const secondSvc = { source: 'second-runtime' };
			const firstLayer = defineLayer({
				name: 'firstRuntime',
				services: { firstSvc: () => firstSvc },
			});
			const secondLayer = defineLayer({
				name: 'secondRuntime',
				services: { secondSvc: () => secondSvc },
			});

			const firstRuntime = await createLayerRuntime(
				resolveLayerDefinitions([firstLayer])
			);
			const firstStore = getGlobalLayerContextStore();
			expect(firstStore).toBeDefined();

			const secondRuntime = await createLayerRuntime(
				resolveLayerDefinitions([secondLayer])
			);
			const secondStore = getGlobalLayerContextStore();
			expect(secondStore).toBeDefined();

			try {
				expect(
					runWithLayerContext(firstStore!, () => getLayerService('firstSvc'))
				).toBe(firstSvc);
				expect(
					runWithLayerContext(firstStore!, () => getLayerService('secondSvc'))
				).toBeUndefined();
				expect(
					runWithLayerContext(secondStore!, () => getLayerService('secondSvc'))
				).toBe(secondSvc);
				expect(
					runWithLayerContext(secondStore!, () => getLayerService('firstSvc'))
				).toBeUndefined();
			} finally {
				await secondRuntime.dispose();
				await firstRuntime.dispose();
			}
		});

		it('should restore the previous app runtime after a nested runtime disposes', async () => {
			const firstSvc = { source: 'outer-runtime' };
			const secondSvc = { source: 'nested-runtime' };
			const firstLayer = defineLayer({
				name: 'outerRuntime',
				services: { firstSvc: () => firstSvc },
			});
			const secondLayer = defineLayer({
				name: 'nestedRuntime',
				services: { secondSvc: () => secondSvc },
			});

			const firstRuntime = await createLayerRuntime(
				resolveLayerDefinitions([firstLayer])
			);
			let secondRuntime:
				| Awaited<ReturnType<typeof createLayerRuntime>>
				| undefined;
			let secondDisposed = false;

			try {
				const firstTracing = getGlobalTracing();
				expect(firstTracing).toBeTruthy();
				expect(getLayerService('firstSvc')).toBe(firstSvc);

				secondRuntime = await createLayerRuntime(
					resolveLayerDefinitions([secondLayer])
				);
				const secondTracing = getGlobalTracing();

				expect(secondTracing).toBeTruthy();
				expect(secondTracing).not.toBe(firstTracing);
				expect(getLayerService('secondSvc')).toBe(secondSvc);
				expect(getLayerService('firstSvc')).toBeUndefined();

				await secondRuntime.dispose();
				secondDisposed = true;

				expect(isLayerRuntimeReady()).toBe(true);
				expect(getLayerService('firstSvc')).toBe(firstSvc);
				expect(getLayerService('secondSvc')).toBeUndefined();
				expect(getGlobalTracing()).toBe(firstTracing);
			} finally {
				if (secondRuntime && !secondDisposed) {
					await secondRuntime.dispose();
				}
				await firstRuntime.dispose();
			}

			expect(isLayerRuntimeReady()).toBe(false);
			expect(getGlobalTracing()).toBeNull();
		});

		it('should not clobber a newer app runtime when an older runtime disposes first', async () => {
			const firstSvc = { source: 'older-runtime' };
			const secondSvc = { source: 'newer-runtime' };
			const firstLayer = defineLayer({
				name: 'olderRuntime',
				services: { firstSvc: () => firstSvc },
			});
			const secondLayer = defineLayer({
				name: 'newerRuntime',
				services: { secondSvc: () => secondSvc },
			});

			const firstRuntime = await createLayerRuntime(
				resolveLayerDefinitions([firstLayer])
			);
			const secondRuntime = await createLayerRuntime(
				resolveLayerDefinitions([secondLayer])
			);

			expect(getLayerService('secondSvc')).toBe(secondSvc);

			await firstRuntime.dispose();

			expect(isLayerRuntimeReady()).toBe(true);
			expect(getLayerService('secondSvc')).toBe(secondSvc);
			expect(getLayerService('firstSvc')).toBeUndefined();

			await secondRuntime.dispose();

			expect(isLayerRuntimeReady()).toBe(false);
			expect(getGlobalTracing()).toBeNull();
		});

		it('should register derived props even when the layer has no store', async () => {
			const modeSignal = signal('dark');
			const runtimeLayer = defineLayer({
				name: 'derivedPropsRuntime',
				deriveProps: () => ({
					mode: modeSignal,
				}),
				services: {
					runtimeSvc: () => ({ health: 'ok' }),
				},
			});
			const runtime = await createLayerRuntime(
				resolveLayerDefinitions([runtimeLayer])
			);

			try {
				const accessor = resolveLayersAccessor([runtimeLayer] as const);

				expect(accessor.derivedPropsRuntime.props.mode).toBe(modeSignal);
			} finally {
				await runtime.dispose();
			}
		});

		it('should evaluate deriveProps once during runtime initialization', async () => {
			const modeSignal = signal('dark');
			const deriveProps = vi.fn(() => ({
				mode: modeSignal,
			}));
			const runtimeLayer = defineLayer({
				name: 'singleDeriveRuntime',
				deriveProps,
				services: {
					runtimeSvc: () => ({ health: 'ok' }),
				},
				setup({ props }) {
					expect(props.mode).toBe(modeSignal);
				},
			});
			const runtime = await createLayerRuntime(
				resolveLayerDefinitions([runtimeLayer])
			);

			try {
				const accessor = resolveLayersAccessor([runtimeLayer] as const);

				expect(accessor.singleDeriveRuntime.props.mode).toBe(modeSignal);
				expect(deriveProps).toHaveBeenCalledTimes(1);
			} finally {
				await runtime.dispose();
			}
		});

		it('should clear createLayerRuntime app context on dispose', async () => {
			const svc = { health: 'ok' };
			const runtimeLayer = defineLayer({
				name: 'runtime',
				services: { runtimeSvc: () => svc },
			});
			const runtime = await createLayerRuntime(
				resolveLayerDefinitions([runtimeLayer])
			);
			const accessor = resolveLayersAccessor([runtimeLayer]);

			expect(accessor.runtime.services.runtimeSvc).toBe(svc);

			await runtime.dispose();

			expect(() => accessor.runtime.services.runtimeSvc).toThrow(
				'Layer runtime not initialized'
			);
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
			const store = { propsRegistry, layerRegistry, layers: [resolvedTheme, resolvedAuth] };

			const accessor = resolveLayersAccessor([themeLayer, authLayer]);

			expect(runWithLayerContext(store, () => accessor.theme.props.mode)).toBe(themeSignal);
			expect(runWithLayerContext(store, () => accessor.auth.services.authSvc)).toBe(authSvc);
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
			const store = { propsRegistry, layerRegistry, layers: [resolvedStr, resolvedNum] };

			const accessor = resolveLayersAccessor([strLayer, numLayer]);

			const strResult = runWithLayerContext(store, () => accessor.strLayer.services.strService);
			const numResult = runWithLayerContext(store, () => accessor.numLayer.services.numService);

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
			const store = { propsRegistry, layerRegistry, layers: [resolvedAuth, resolvedLog] };

			const accessor = resolveLayersAccessor([authLayer, logLayer]);

			const a = runWithLayerContext(store, () => accessor.auth.services.authSvc);
			const l = runWithLayerContext(store, () => accessor.log.services.logSvc);

			expect(a).toBe(authSvc);
			expect(l).toBe(logSvc);
		});

		it('should infer service types from alias record keys', () => {
			const authLayer = defineLayer({
				name: 'platformAuth',
				services: { authSvc: () => ({ token: 'abc' }) },
			});
			const logLayer = defineLayer({
				name: 'platformLog',
				services: { logSvc: () => ({ log: () => undefined }) },
			});

			const accessor = resolveLayersAccessor({
				auth: authLayer,
				logger: logLayer,
			} as const);

			expectTypeOf<
				typeof accessor.auth.services.authSvc
			>().toEqualTypeOf<{ token: string }>();
			expectTypeOf<
				typeof accessor.logger.services.logSvc
			>().toEqualTypeOf<{ log: () => undefined }>();
		});

		it('should infer layer props from list and alias accessors', () => {
			const modeSignal = signal('dark');
			const densitySignal = signal(2);
			const themeLayer = defineLayer({
				name: 'typedTheme',
				props: {
					mode: modeSignal,
					density: densitySignal,
				},
				services: {
					theme: () => ({ current: () => modeSignal.value }),
				},
			});

			const listAccessor = resolveLayersAccessor([themeLayer] as const);
			const aliasAccessor = resolveLayersAccessor({
				theme: themeLayer,
			} as const);

			expectTypeOf<
				typeof listAccessor.typedTheme.props.mode
			>().toEqualTypeOf<typeof modeSignal>();
			expectTypeOf<
				typeof listAccessor.typedTheme.props.density
			>().toEqualTypeOf<typeof densitySignal>();
			expectTypeOf<
				typeof aliasAccessor.theme.props.mode
			>().toEqualTypeOf<typeof modeSignal>();
			expectTypeOf<
				typeof aliasAccessor.theme.services.theme
			>().toEqualTypeOf<{ current: () => string }>();
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
			const store = { propsRegistry, layerRegistry, layers: [resolvedLayer] };

			const useHook = defineHook({
				layers: [authLayer] as const,
				setup(ctx) {
					return ctx.layers.auth.services.authSvc;
				},
			});

			const result = runWithLayerContext(store, () => useHook());
			expect(result).toBe(authSvc);
		});

		it('should support aliased layer records in defineHook setup', () => {
			const authSvc = { token: 'abc' };
			const identityLayer = defineLayer({
				name: 'platformIdentity',
				services: { authSvc: () => authSvc },
			});
			const resolvedLayer = createResolvedLayer({
				name: 'platformIdentity',
				provides: { authSvc: () => authSvc },
			});

			const propsRegistry = createMockPropsRegistry({ platformIdentity: {} });
			const layerRegistry = createMockLayerRegistry(
				{ platformIdentity: resolvedLayer },
				{ authSvc }
			);
			const store = { propsRegistry, layerRegistry, layers: [resolvedLayer] };

			const useHook = defineHook({
				layers: { auth: identityLayer } as const,
				setup({ layers: { auth } }) {
					return auth.services.authSvc;
				},
			});

			const result = runWithLayerContext(store, () => useHook());
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
			const store = { propsRegistry, layerRegistry, layers: [resolvedAuth, resolvedLog] };

			const useHook = defineHook({
				layers: [authLayer, logLayer] as const,
				setup(ctx) {
					return {
						auth: ctx.layers.auth.services.authSvc,
						log: ctx.layers.log.services.logSvc,
					};
				},
			});

			const result = runWithLayerContext(store, () => useHook());
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
			const store = { propsRegistry, layerRegistry, layers: [resolvedLayer] };

			const useHook = defineHook({
				layers: [themeLayer] as const,
				setup(ctx) {
					return ctx.layers.theme.props;
				},
			});

			const props = runWithLayerContext(store, () => useHook());
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
			const store = { propsRegistry, layerRegistry, layers: [resolvedA, resolvedB, resolvedC] };

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

			const result = runWithLayerContext(store, () => useHook());
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
			const store = { propsRegistry, layerRegistry, layers: [resolvedLayer] };

			const { ctx } = createHookContext(undefined, [themeLayer] as const);
			expect(runWithLayerContext(store, () => ctx.layers.theme.props.mode)).toBe(modeSignal);
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
			const store = { propsRegistry, layerRegistry, layers: [resolvedLayer] };

			const { ctx } = createHookContext(undefined, [authLayer] as const);
			expect(runWithLayerContext(store, () => ctx.layers.auth.services.authSvc)).toBe(authSvc);
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
			const store = { propsRegistry, layerRegistry, layers: [resolvedAuth, resolvedLog] };

			const accessor = resolveLayersAccessor([authLayer, logLayer]);

			expect(runWithLayerContext(store, () => accessor.auth)).toBeDefined();
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
			const store = { propsRegistry, layerRegistry, layers: [resolvedAuth, resolvedLog] };

			const accessor = resolveLayersAccessor([authLayer, logLayer]);

			expect(runWithLayerContext(store, () => accessor.auth.services.authSvc)).toBe(authSvc);
			expect(runWithLayerContext(store, () => accessor.log.services.logSvc)).toBe(logSvc);
		});
	});

	describe('edge cases', () => {
		it('should handle layer with single character name', () => {
			const svc = { x: 1 };
			const layer = defineLayer({ name: 'a', provides: { xSvc: () => svc } });
			const resolved = createResolvedLayer({ name: 'a', provides: { xSvc: () => svc } });

			const propsRegistry = createMockPropsRegistry({ a: {} });
			const layerRegistry = createMockLayerRegistry({ a: resolved }, { xSvc: svc });
			const store = { propsRegistry, layerRegistry, layers: [resolved] };

			const accessor = resolveLayersAccessor([layer]);
			expect(runWithLayerContext(store, () => accessor.a.services.xSvc)).toBe(svc);
		});

		it('should handle layer with numeric string name', () => {
			const svc = { val: 99 };
			const layer = defineLayer({ name: '123', provides: { numSvc: () => svc } });
			const resolved = createResolvedLayer({ name: '123', provides: { numSvc: () => svc } });

			const propsRegistry = createMockPropsRegistry({ '123': {} });
			const layerRegistry = createMockLayerRegistry({ '123': resolved }, { numSvc: svc });
			const store = { propsRegistry, layerRegistry, layers: [resolved] };

			const accessor = resolveLayersAccessor([layer]);
			expect(runWithLayerContext(store, () => accessor['123'].services.numSvc)).toBe(svc);
		});

		it('should handle layer with camelCase name', () => {
			const svc = { db: 'pg' };
			const layer = defineLayer({ name: 'myDbLayer', provides: { dbService: () => svc } });
			const resolved = createResolvedLayer({ name: 'myDbLayer', provides: { dbService: () => svc } });

			const propsRegistry = createMockPropsRegistry({ myDbLayer: {} });
			const layerRegistry = createMockLayerRegistry({ myDbLayer: resolved }, { dbService: svc });
			const store = { propsRegistry, layerRegistry, layers: [resolved] };

			const accessor = resolveLayersAccessor([layer]);
			expect(runWithLayerContext(store, () => accessor.myDbLayer.services.dbService)).toBe(svc);
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
			const store = { propsRegistry, layerRegistry, layers: [resolvedLayer] };

			const accessor = resolveLayersAccessor([combinedLayer]);

			expect(runWithLayerContext(store, () => accessor.combined.services.authSvc)).toBe(authSvc);
			expect(runWithLayerContext(store, () => accessor.combined.services.userSvc)).toBe(userSvc);
		});
	});
});
