import { describe, it, expect, afterEach } from 'vitest';
import { createSSRRuntime } from '../../ssr/runtime.js';
import {
	defineLayer,
	resolveLayerDefinitions,
} from '../../layers/api/defineLayer.js';
import { LayerNameCollisionError } from '../../layers/errors.js';
import { createLayerRuntime } from '../../layers/internal/runtime.js';
import { signal } from '../../reactivity/signal.js';
import {
	clearGlobalLayerContext,
	getLayerService,
	isLayerRuntimeReady,
} from '../../layers/context.js';
import { clearGlobalTracing } from '../../layers/tracing/index.js';

afterEach(() => {
	clearGlobalLayerContext();
	clearGlobalTracing();
});

describe('SSRRuntime', () => {
	describe('createSSRRuntime', () => {
		it('should create a runtime and initialize the global layer context', async () => {
			const TestLayer = defineLayer({
				name: 'test',
				props: {
					count: signal(0),
				},
			});

			const runtime = await createSSRRuntime([TestLayer]);

			expect(runtime.layers).toHaveLength(1);
			expect(runtime.headStack).toBeInstanceOf(Array);
			expect(runtime.state).toBeInstanceOf(Map);
			expect(runtime.run(() => isLayerRuntimeReady())).toBe(true);

			await runtime.dispose();
		});

		it('should dispose and clear the global layer context', async () => {
			const TestLayer = defineLayer({
				name: 'test-dispose',
			});

			const runtime = await createSSRRuntime([TestLayer]);
			expect(runtime.run(() => isLayerRuntimeReady())).toBe(true);

			await runtime.dispose();
			expect(isLayerRuntimeReady()).toBe(false);
		});

		it('should reject disposal after every layer cleanup has run', async () => {
			const calls: string[] = [];
			const FirstLayer = defineLayer({
				name: 'first-cleanup',
				setup: () => () => {
					calls.push('first');
					throw new Error('first cleanup failed');
				},
			});
			const SecondLayer = defineLayer({
				name: 'second-cleanup',
				onUnmount: async () => {
					await Promise.resolve();
					calls.push('second');
					throw new Error('second cleanup failed');
				},
			});
			const runtime = await createSSRRuntime([FirstLayer, SecondLayer]);

			await expect(runtime.dispose()).rejects.toMatchObject({
				name: 'AggregateError',
				errors: [expect.any(Error), expect.any(Error)],
			});
			expect(calls).toEqual(['second', 'first']);
			await expect(runtime.dispose()).rejects.toBeInstanceOf(AggregateError);
			expect(calls).toEqual(['second', 'first']);
		});

		it('should restore an existing app layer context after SSR dispose', async () => {
			const appService = { source: 'app' };
			const serverService = { source: 'server' };
			const AppLayer = defineLayer({
				name: 'app-context',
				services: {
					app: () => appService,
				},
			});
			const ServerLayer = defineLayer({
				name: 'server-context',
				services: {
					server: () => serverService,
				},
			});

			const appRuntime = await createLayerRuntime(
				resolveLayerDefinitions([AppLayer])
			);
			let ssrRuntime: Awaited<ReturnType<typeof createSSRRuntime>> | null = null;

			try {
				expect(isLayerRuntimeReady()).toBe(true);
				expect(getLayerService('app')).toBe(appService);

				ssrRuntime = await createSSRRuntime([ServerLayer]);
				expect(getLayerService('app')).toBe(appService);
				expect(getLayerService('server')).toBeUndefined();
				expect(ssrRuntime.run(() => getLayerService('server'))).toBe(
					serverService
				);

				await ssrRuntime.dispose();
				ssrRuntime = null;

				expect(isLayerRuntimeReady()).toBe(true);
				expect(getLayerService('app')).toBe(appService);
			} finally {
				if (ssrRuntime) {
					await ssrRuntime.dispose();
				}
				await appRuntime.dispose();
			}
		});

		it('should collect head props from layer definitions', async () => {
			const TestLayer = defineLayer({
				name: 'headed',
				head: {
					title: 'Test Page',
					description: 'A test page',
				},
			});

			const runtime = await createSSRRuntime([TestLayer]);

			expect(runtime.headStack).toHaveLength(1);
			expect(runtime.headStack[0]).toEqual({
				title: 'Test Page',
				description: 'A test page',
			});

			await runtime.dispose();
		});

		it('should run layer setup() during SSR', async () => {
			let setupCalled = false;

			const TestLayer = defineLayer({
				name: 'setup-test',
				setup: () => {
					setupCalled = true;
					return () => {};
				},
			});

			const runtime = await createSSRRuntime([TestLayer]);
			expect(setupCalled).toBe(true);

			await runtime.dispose();
		});

		it('should skip setup when runSetup is false', async () => {
			let setupCalled = false;

			const TestLayer = defineLayer({
				name: 'no-setup',
				setup: () => {
					setupCalled = true;
					return () => {};
				},
			});

			const runtime = await createSSRRuntime([TestLayer], {
				runSetup: false,
			});

			expect(setupCalled).toBe(false);

			await runtime.dispose();
		});

		it('should register layer provides as services', async () => {
			const TestLayer = defineLayer({
				name: 'provider',
				provides: {
					myService: () => ({ getValue: () => 42 }),
				},
			});

			const runtime = await createSSRRuntime([TestLayer]);

			// The provides should have been registered via buildAllLayersEffect
			expect(runtime.layers[0]?.provides).toBeDefined();

			await runtime.dispose();
		});

		it('should handle multiple layers with dependencies', async () => {
			const BaseLayer = defineLayer({
				name: 'base',
				provides: {
					config: () => ({ env: 'test' }),
				},
			});

			const AppLayer = defineLayer({
				name: 'app',
				dependencies: ['base'],
			});

			const runtime = await createSSRRuntime([BaseLayer, AppLayer]);

			expect(runtime.layers).toHaveLength(2);

			await runtime.dispose();
		});

		it('should handle raw EffuseLayer definitions (not pre-compiled)', async () => {
			// Pass a raw layer (not through defineLayer)
			const rawLayer = {
				name: 'raw-layer',
				head: { title: 'Raw' },
			};

			const runtime = await createSSRRuntime([rawLayer]);
			expect(runtime.layers).toHaveLength(1);
			expect(runtime.headStack[0]).toEqual({ title: 'Raw' });

			await runtime.dispose();
		});

		it('should resolve extended raw layers before request setup', async () => {
			const BaseLayer = {
				name: 'base-raw',
				services: {
					config: () => ({ env: 'test' }),
				},
			};

			const FeatureLayer = defineLayer({
				name: 'feature-compiled',
				extends: [BaseLayer],
				dependencies: ['base-raw'] as const,
			});

			const runtime = await createSSRRuntime([FeatureLayer]);

			expect(runtime.layers.map((layer) => layer.name)).toEqual([
				'base-raw',
				'feature-compiled',
			]);

			await runtime.dispose();
		});

		it('should reject duplicate layer names before SSR setup runs', async () => {
			let setupCalled = false;
			const FirstLayer = defineLayer({
				name: 'session',
				setup: () => {
					setupCalled = true;
				},
			});
			const SecondLayer = defineLayer({
				name: 'session',
			});

			await expect(createSSRRuntime([FirstLayer, SecondLayer])).rejects.toThrow(
				LayerNameCollisionError
			);
			await expect(createSSRRuntime([FirstLayer, SecondLayer])).rejects.toThrow(
				'Layer "session" is registered more than once'
			);
			expect(setupCalled).toBe(false);
		});
	});
});
