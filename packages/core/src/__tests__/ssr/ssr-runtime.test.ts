import { describe, it, expect, afterEach } from 'vitest';
import { createSSRRuntime } from '../../ssr/runtime.js';
import { defineLayer } from '../../layers/api/defineLayer.js';
import { LayerNameCollisionError } from '../../layers/errors.js';
import { signal } from '../../reactivity/signal.js';
import { isLayerRuntimeReady } from '../../layers/context.js';
import { clearGlobalTracing } from '../../layers/tracing/index.js';

afterEach(() => {
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
