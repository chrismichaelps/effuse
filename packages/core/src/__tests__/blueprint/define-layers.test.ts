import { describe, it, expect, expectTypeOf, vi, afterEach } from 'vitest';
import { define } from '../../blueprint/define.js';
import { defineLayer } from '../../layers/api/defineLayer.js';
import { runWithLayerContext } from '../../layers/context.js';
import {
	LayerNameCollisionError,
	ServiceNotFoundError,
} from '../../layers/errors.js';
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

interface BlueprintMock {
	_tag: string;
	state: (props: unknown) => unknown;
	view: (ctx: { props: unknown; state: unknown; portals: unknown }) => unknown;
}

const extractBlueprint = (component: unknown): BlueprintMock => {
	return component as BlueprintMock;
};

describe('define() + layers — full integration', () => {
	describe('single layer via layers option', () => {
		it('should expose layer services via ctx.layers in script', () => {
			const authSvc = { token: 'abc', user: 'chris' };
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

			const Component = define({
				props: { userId: '' },
				layers: [authLayer] as const,
				script(ctx) {
					const auth = ctx.layers.auth.services.authSvc;
					return { isAuthenticated: !!auth.token, user: auth.user };
				},
				template: () => null,
			});

			const blueprint = extractBlueprint(Component);
			const state = runWithLayerContext(store, () =>
				blueprint.state({ userId: 'u1' })
			) as { exposed: Record<string, unknown> };
			expect(state.exposed.isAuthenticated).toBe(true);
			expect(state.exposed.user).toBe('chris');
		});

		it('should support aliased layers with destructured script access', () => {
			const authSvc = { token: 'abc', user: 'chris' };
			const identityLayer = defineLayer({
				name: 'platformIdentity',
				services: { authSvc: () => authSvc },
			});
			const resolvedLayer = createResolvedLayer({
				name: 'platformIdentity',
				provides: { authSvc: () => authSvc },
			});

			const propsRegistry = createMockPropsRegistry({
				platformIdentity: { requiredRole: 'admin' },
			});
			const layerRegistry = createMockLayerRegistry(
				{ platformIdentity: resolvedLayer },
				{ authSvc }
			);
			const store = { propsRegistry, layerRegistry, layers: [resolvedLayer] };

			const Component = define({
				props: {},
				layers: { auth: identityLayer } as const,
				script({ layers: { auth } }) {
					const svc = auth.services.authSvc;
					expectTypeOf(svc).toEqualTypeOf<{
						token: string;
						user: string;
					}>();
					return {
						user: svc.user,
						requiredRole: auth.props.requiredRole,
					};
				},
				template: () => null,
			});

			const blueprint = extractBlueprint(Component);
			const state = runWithLayerContext(store, () => blueprint.state({})) as {
				exposed: Record<string, unknown>;
			};
			expect(state.exposed.user).toBe('chris');
			expect(state.exposed.requiredRole).toBe('admin');
		});

		it('should access a layer directly without duplicating it in define options', () => {
			const authSvc = { token: 'abc', user: 'chris' };
			const authLayer = defineLayer({
				name: 'auth-direct',
				services: { authSvc: () => authSvc },
			});
			const resolvedLayer = createResolvedLayer({
				name: 'auth-direct',
				provides: { authSvc: () => authSvc },
			});

			const propsRegistry = createMockPropsRegistry({ 'auth-direct': {} });
			const layerRegistry = createMockLayerRegistry(
				{ 'auth-direct': resolvedLayer },
				{ authSvc }
			);
			const store = { propsRegistry, layerRegistry, layers: [resolvedLayer] };

			const Component = define({
				props: {},
				script(ctx) {
					const auth = ctx.useService(authLayer, 'authSvc');
					return { isAuthenticated: !!auth.token, user: auth.user };
				},
				template: () => null,
			});

			const blueprint = extractBlueprint(Component);
			const state = runWithLayerContext(store, () => blueprint.state({})) as {
				exposed: Record<string, unknown>;
			};
			expect(state.exposed.isAuthenticated).toBe(true);
			expect(state.exposed.user).toBe('chris');
		});

		it('should support destructured direct helpers in script', () => {
			const authSvc = { token: 'abc', user: 'chris' };
			const modeSignal = signal('strict');
			const authLayer = defineLayer({
				name: 'auth-helpers',
				services: { authSvc: () => authSvc },
			});
			const resolvedLayer = createResolvedLayer({
				name: 'auth-helpers',
				provides: { authSvc: () => authSvc },
			});

			const propsRegistry = createMockPropsRegistry({
				'auth-helpers': { mode: modeSignal },
			});
			const layerRegistry = createMockLayerRegistry(
				{ 'auth-helpers': resolvedLayer },
				{ authSvc }
			);
			const store = { propsRegistry, layerRegistry, layers: [resolvedLayer] };

			const Component = define({
				props: {},
				script({ useLayer, useService }) {
					const auth = useLayer(authLayer);
					const sameAuth = useLayer(authLayer);
					const svc = useService(authLayer, 'authSvc');
					return {
						user: svc.user,
						mode: auth.props.mode,
						sameEntry: auth === sameAuth,
						sameServices: auth.services === sameAuth.services,
						sameInstance: auth.services.authSvc === svc,
					};
				},
				template: () => null,
			});

			const blueprint = extractBlueprint(Component);
			const state = runWithLayerContext(store, () => blueprint.state({})) as {
				exposed: {
					user: string;
					mode: { value: string };
					sameEntry: boolean;
					sameServices: boolean;
					sameInstance: boolean;
				};
			};
			expect(state.exposed.user).toBe('chris');
			expect(state.exposed.mode).toBe(modeSignal);
			expect(state.exposed.sameEntry).toBe(true);
			expect(state.exposed.sameServices).toBe(true);
			expect(state.exposed.sameInstance).toBe(true);
		});

		it('should reject direct helper service keys outside the layer contract', () => {
			const authSvc = { token: 'abc' };
			const billingSvc = { total: 10 };
			const authLayer = defineLayer({
				name: 'auth-boundary',
				services: { authSvc: () => authSvc },
			});
			const resolvedLayer = createResolvedLayer({
				name: 'auth-boundary',
				provides: { authSvc: () => authSvc },
			});

			const propsRegistry = createMockPropsRegistry({ 'auth-boundary': {} });
			const layerRegistry = createMockLayerRegistry(
				{ 'auth-boundary': resolvedLayer },
				{ authSvc, billingSvc }
			);
			const store = { propsRegistry, layerRegistry, layers: [resolvedLayer] };

			const Component = define({
				props: {},
				script({ useService }) {
					const unsafeUseService = useService as unknown as (
						layer: typeof authLayer,
						key: string
					) => unknown;
					unsafeUseService(authLayer, 'billingSvc');
					return {};
				},
				template: () => null,
			});

			const blueprint = extractBlueprint(Component);

			expect(() =>
				runWithLayerContext(store, () => blueprint.state({}))
			).toThrow(ServiceNotFoundError);
		});

		it('should expose layer props via ctx.layers in script', () => {
			const themeMode = signal('dark');
			const themeLayer = defineLayer({ name: 'theme', provides: {} });
			const resolvedLayer = createResolvedLayer({ name: 'theme' });

			const propsRegistry = createMockPropsRegistry({
				theme: { mode: themeMode },
			});
			const layerRegistry = createMockLayerRegistry({ theme: resolvedLayer });
			const store = { propsRegistry, layerRegistry, layers: [resolvedLayer] };

			const Component = define({
				props: {},
				layers: [themeLayer] as const,
				script(ctx) {
					return { mode: ctx.layers.theme.props.mode };
				},
				template: () => null,
			});

			const blueprint = extractBlueprint(Component);
			const state = runWithLayerContext(store, () => blueprint.state({})) as {
				exposed: { mode: { value: string } };
			};
			expect(state.exposed.mode.value).toBe('dark');
		});
	});

	describe('multiple layers via layers option', () => {
		it('should reject duplicate layer names before script runs', () => {
			const firstLayer = defineLayer({
				name: 'auth',
				services: { first: () => ({ token: 'first' }) },
			});
			const secondLayer = defineLayer({
				name: 'auth',
				services: { second: () => ({ token: 'second' }) },
			});

			const Component = define({
				props: {},
				layers: [firstLayer, secondLayer] as const,
				script() {
					return {};
				},
				template: () => null,
			});

			const blueprint = extractBlueprint(Component);

			expect(() => blueprint.state({})).toThrow(LayerNameCollisionError);
		});

		it('should not conflate service keys across auth and log layers', () => {
			const authSvc = { token: 'abc' };
			const logSvc = { log: vi.fn(), level: 'info' };

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
			const store = {
				propsRegistry,
				layerRegistry,
				layers: [resolvedAuth, resolvedLog],
			};

			const Component = define({
				props: {},
				layers: [authLayer, logLayer] as const,
				script(ctx) {
					const auth = ctx.layers.auth.services.authSvc;
					const log = ctx.layers.log.services.logSvc;
					return {
						authToken: auth.token,
						logLevel: log.level,
					};
				},
				template: () => null,
			});

			const blueprint = extractBlueprint(Component);
			const state = runWithLayerContext(store, () => blueprint.state({})) as {
				exposed: Record<string, unknown>;
			};
			expect(state.exposed.authToken).toBe('abc');
			expect(state.exposed.logLevel).toBe('info');
		});

		it('should support three distinct layers without collision', () => {
			const aSvc = { a: 1 };
			const bSvc = { b: 'two' };
			const cSvc = { c: true };

			const layerA = defineLayer({ name: 'a', provides: { aSvc: () => aSvc } });
			const layerB = defineLayer({ name: 'b', provides: { bSvc: () => bSvc } });
			const layerC = defineLayer({ name: 'c', provides: { cSvc: () => cSvc } });

			const resolvedA = createResolvedLayer({
				name: 'a',
				provides: { aSvc: () => aSvc },
			});
			const resolvedB = createResolvedLayer({
				name: 'b',
				provides: { bSvc: () => bSvc },
			});
			const resolvedC = createResolvedLayer({
				name: 'c',
				provides: { cSvc: () => cSvc },
			});

			const propsRegistry = createMockPropsRegistry({ a: {}, b: {}, c: {} });
			const layerRegistry = createMockLayerRegistry(
				{ a: resolvedA, b: resolvedB, c: resolvedC },
				{ aSvc, bSvc, cSvc }
			);
			const store = {
				propsRegistry,
				layerRegistry,
				layers: [resolvedA, resolvedB, resolvedC],
			};

			const Component = define({
				props: {},
				layers: [layerA, layerB, layerC] as const,
				script(ctx) {
					return {
						a: ctx.layers.a.services.aSvc.a,
						b: ctx.layers.b.services.bSvc.b,
						c: ctx.layers.c.services.cSvc.c,
					};
				},
				template: () => null,
			});

			const blueprint = extractBlueprint(Component);
			const state = runWithLayerContext(store, () => blueprint.state({})) as {
				exposed: Record<string, unknown>;
			};
			expect(state.exposed.a).toBe(1);
			expect(state.exposed.b).toBe('two');
			expect(state.exposed.c).toBe(true);
		});
	});

	describe('layers accessor with context.watch', () => {
		it('should react to signal changes in script using layer services', () => {
			const countSignal = signal(0);
			const counterSvc = { getCount: () => countSignal.value };

			const counterLayer = defineLayer({
				name: 'counter',
				provides: { counterSvc: () => counterSvc },
			});
			const resolvedLayer = createResolvedLayer({
				name: 'counter',
				provides: { counterSvc: () => counterSvc },
			});

			const propsRegistry = createMockPropsRegistry({ counter: {} });
			const layerRegistry = createMockLayerRegistry(
				{ counter: resolvedLayer },
				{ counterSvc }
			);
			const store = { propsRegistry, layerRegistry, layers: [resolvedLayer] };

			let capturedCount = -1;

			const Component = define({
				props: {},
				layers: [counterLayer] as const,
				script(ctx) {
					ctx.watch(
						() => countSignal.value,
						(newVal) => {
							capturedCount = newVal;
						}
					);
					const svc = ctx.layers.counter.services.counterSvc;
					return { initial: svc.getCount() };
				},
				template: () => null,
			});

			const blueprint = extractBlueprint(Component);
			const state = runWithLayerContext(store, () => blueprint.state({})) as {
				exposed: Record<string, unknown>;
			};
			expect(state.exposed.initial).toBe(0);

			countSignal.value = 42;
			expect(capturedCount).toBe(42);
		});
	});

	describe('layers accessor with onMount', () => {
		it('should fire onMount after script and access layer services', () => {
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

			const mountOrder: string[] = [];

			const Component = define({
				props: {},
				layers: [authLayer] as const,
				script(ctx) {
					ctx.onMount(() => {
						const svc = ctx.layers.auth.services.authSvc;
						mountOrder.push(`mount:${svc.token}`);
						return undefined;
					});
					mountOrder.push('script');
					return {};
				},
				template: () => null,
			});

			const blueprint = extractBlueprint(Component);
			const state = runWithLayerContext(store, () => blueprint.state({})) as {
				lifecycle: { runMount: () => void };
			};
			expect(mountOrder).toEqual(['script']);

			runWithLayerContext(store, () => state.lifecycle.runMount());
			expect(mountOrder).toEqual(['script', 'mount:abc']);
		});
	});

	describe('layers accessor with onUnmount', () => {
		it('should fire onUnmount and clean up', () => {
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

			const cleanupOrder: string[] = [];

			const Component = define({
				props: {},
				layers: [authLayer] as const,
				script(ctx) {
					ctx.onUnmount(() => {
						const svc = ctx.layers.auth.services.authSvc;
						cleanupOrder.push(`unmount:${svc.token}`);
					});
					return {};
				},
				template: () => null,
			});

			const blueprint = extractBlueprint(Component);
			const state = runWithLayerContext(store, () => blueprint.state({})) as {
				lifecycle: { runCleanup: () => void };
			};
			runWithLayerContext(store, () => state.lifecycle.runCleanup());
			expect(cleanupOrder).toEqual(['unmount:abc']);
		});
	});

	describe('layers with signal and computed in script', () => {
		it('should use layer services in computed', () => {
			const multiplier = { factor: 3 };
			const mathLayer = defineLayer({
				name: 'math',
				provides: { multiplier: () => multiplier },
			});
			const resolvedLayer = createResolvedLayer({
				name: 'math',
				provides: { multiplier: () => multiplier },
			});

			const propsRegistry = createMockPropsRegistry({ math: {} });
			const layerRegistry = createMockLayerRegistry(
				{ math: resolvedLayer },
				{ multiplier }
			);
			const store = { propsRegistry, layerRegistry, layers: [resolvedLayer] };

			const Component = define({
				props: { value: 0 },
				layers: [mathLayer] as const,
				script(ctx) {
					const count = ctx.signal(0);
					const svc = ctx.layers.math.services.multiplier;
					const result = ctx.computed(() => count.value * svc.factor);
					return { count, result };
				},
				template: () => null,
			});

			const blueprint = extractBlueprint(Component);
			const state = runWithLayerContext(store, () =>
				blueprint.state({ value: 10 })
			) as {
				exposed: { count: { value: number }; result: { value: number } };
			};
			expect(state.exposed.count.value).toBe(0);
			expect(state.exposed.result.value).toBe(0);

			state.exposed.count.value = 5;
			expect(state.exposed.result.value).toBe(15);
		});
	});

	describe('define() with layers — props registry integration', () => {
		it('should resolve distinct props for each layer independently', () => {
			const themeMode = signal('dark');
			const authUser = signal('User');

			const themeLayer = defineLayer({ name: 'theme', provides: {} });
			const authLayer = defineLayer({
				name: 'auth',
				provides: { authSvc: () => ({ user: authUser }) },
			});

			const resolvedTheme = createResolvedLayer({ name: 'theme' });
			const resolvedAuth = createResolvedLayer({
				name: 'auth',
				provides: { authSvc: () => ({ user: authUser }) },
			});

			const propsRegistry = createMockPropsRegistry({
				theme: { mode: themeMode },
				auth: { userId: 'u1' },
			});
			const layerRegistry = createMockLayerRegistry(
				{ theme: resolvedTheme, auth: resolvedAuth },
				{ authSvc: { user: authUser } }
			);
			const store = {
				propsRegistry,
				layerRegistry,
				layers: [resolvedTheme, resolvedAuth],
			};

			const Component = define({
				props: {},
				layers: [themeLayer, authLayer] as const,
				script(ctx) {
					return {
						theme: ctx.layers.theme.props.mode,
						user: ctx.layers.auth.props.userId,
					};
				},
				template: () => null,
			});

			const blueprint = extractBlueprint(Component);
			const state = runWithLayerContext(store, () => blueprint.state({})) as {
				exposed: { theme: { value: string }; user: string };
			};
			expect(state.exposed.theme.value).toBe('dark');
			expect(state.exposed.user).toBe('u1');
		});
	});

	describe('define() with layers — service caching', () => {
		it('should return same service instance on repeated access', () => {
			const factorySpy = vi.fn(() => ({ id: Math.random() }));
			const cachedInstance = { id: 999 };
			const cacheLayer = defineLayer({
				name: 'cache',
				provides: { cachedSvc: factorySpy },
			});
			const resolvedLayer = createResolvedLayer({
				name: 'cache',
				provides: { cachedSvc: factorySpy },
			});

			const propsRegistry = createMockPropsRegistry({ cache: {} });
			const layerRegistry = createMockLayerRegistry(
				{ cache: resolvedLayer },
				{ cachedSvc: cachedInstance }
			);
			const store = { propsRegistry, layerRegistry, layers: [resolvedLayer] };

			let instanceA: unknown;
			let instanceB: unknown;

			const Component = define({
				props: {},
				layers: [cacheLayer] as const,
				script(ctx) {
					instanceA = ctx.layers.cache.services.cachedSvc;
					instanceB = ctx.layers.cache.services.cachedSvc;
					return {};
				},
				template: () => null,
			});

			const blueprint = extractBlueprint(Component);
			runWithLayerContext(store, () => blueprint.state({}));
			expect(instanceA).toBe(cachedInstance);
			expect(instanceB).toBe(cachedInstance);
			expect(factorySpy).not.toHaveBeenCalled();
		});

		it('should return the same services bag across repeated script reads', () => {
			const cachedInstance = { id: 999 };
			const cacheLayer = defineLayer({
				name: 'cache',
				provides: { cachedSvc: () => cachedInstance },
			});
			const resolvedLayer = createResolvedLayer({
				name: 'cache',
				provides: { cachedSvc: () => cachedInstance },
			});

			const propsRegistry = createMockPropsRegistry({ cache: {} });
			const layerRegistry = createMockLayerRegistry(
				{ cache: resolvedLayer },
				{ cachedSvc: cachedInstance }
			);
			const store = { propsRegistry, layerRegistry, layers: [resolvedLayer] };

			const Component = define({
				props: {},
				layers: [cacheLayer] as const,
				script(ctx) {
					const firstServices = ctx.layers.cache.services;
					const secondServices = ctx.layers.cache.services;
					return {
						sameBag: firstServices === secondServices,
						sameService: firstServices.cachedSvc === secondServices.cachedSvc,
					};
				},
				template: () => null,
			});

			const blueprint = extractBlueprint(Component);
			const state = runWithLayerContext(store, () => blueprint.state({})) as {
				exposed: { sameBag: boolean; sameService: boolean };
			};

			expect(state.exposed.sameBag).toBe(true);
			expect(state.exposed.sameService).toBe(true);
		});
	});

	describe('define() with layers — empty accessor when no layers', () => {
		it('should expose empty layers object when no layers provided', () => {
			const Component = define({
				props: {},
				script(ctx) {
					return { layerKeys: Object.keys(ctx.layers) };
				},
				template: () => null,
			});

			const blueprint = extractBlueprint(Component);
			const emptyStore = {
				propsRegistry: createMockPropsRegistry(),
				layerRegistry: createMockLayerRegistry(),
				layers: [],
			};
			const state = runWithLayerContext(emptyStore, () =>
				blueprint.state({})
			) as { exposed: Record<string, unknown> };
			expect(state.exposed.layerKeys).toEqual([]);
		});
	});

	describe('define() with layers — name inference', () => {
		it('should preserve distinct layer names as typed keys', () => {
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
			const store = {
				propsRegistry,
				layerRegistry,
				layers: [resolvedAuth, resolvedLog],
			};

			const accessorKeys: string[] = [];

			const Component = define({
				props: {},
				layers: [authLayer, logLayer] as const,
				script(ctx) {
					accessorKeys.push(...Object.keys(ctx.layers));
					return {
						auth: ctx.layers.auth.services.authSvc,
						log: ctx.layers.log.services.logSvc,
					};
				},
				template: () => null,
			});

			const blueprint = extractBlueprint(Component);
			runWithLayerContext(store, () => blueprint.state({}));
			expect(accessorKeys.sort()).toEqual(['auth', 'log']);
		});
	});

	describe('define() with layers — template receives exposed values', () => {
		it('should pass script-exposed values to template', () => {
			const authSvcVal = { name: 'Admin' };
			const authLayer = defineLayer({
				name: 'auth',
				provides: { authSvc: () => authSvcVal },
			});
			const resolvedLayer = createResolvedLayer({
				name: 'auth',
				provides: { authSvc: () => authSvcVal },
			});

			const propsRegistry = createMockPropsRegistry({ auth: {} });
			const layerRegistry = createMockLayerRegistry(
				{ auth: resolvedLayer },
				{ authSvc: authSvcVal }
			);
			const store = { propsRegistry, layerRegistry, layers: [resolvedLayer] };

			let capturedExposed: Record<string, unknown> | null = null;

			const Component = define({
				props: {},
				layers: [authLayer] as const,
				script(ctx) {
					return { user: ctx.layers.auth.services.authSvc.name };
				},
				template: (exposed) => {
					capturedExposed = exposed;
					return null;
				},
			});

			const blueprint = extractBlueprint(Component);
			const state = runWithLayerContext(store, () =>
				blueprint.state({})
			) as unknown as { exposed: { user: string } };
			runWithLayerContext(store, () =>
				blueprint.view({ props: {}, state, portals: {} })
			);
			const capturedUser = capturedExposed && capturedExposed['user'];
			expect(capturedUser).toBe('Admin');
		});
	});
});
