import { describe, it, expect, afterEach } from 'vitest';
import { defineLayer } from '../../layers/api/defineLayer.js';
import { clearGlobalLayerContext } from '../../layers/context.js';
import { clearGlobalTracing } from '../../layers/tracing/index.js';
import { compileServerPolicy } from '../../ssr/policy-compiler.js';

afterEach(() => {
	clearGlobalLayerContext();
	clearGlobalTracing();
});

describe('compileServerPolicy', () => {
	it('compiles a route policy from a single layer', () => {
		const Api = defineLayer({
			name: 'api',
			server: {
				metadata: { runtime: 'edge', region: 'iad1' },
				api: {
					'/api/users': {
						GET: () => ({ ok: true }),
						metadata: { cache: { revalidate: 60, tags: ['users'] } },
					},
				},
			},
		});

		const manifest = compileServerPolicy([Api]);

		expect(manifest.routes).toHaveLength(1);
		expect(manifest.routes[0]).toMatchObject({
			layer: 'api',
			path: '/api/users',
			methods: ['GET'],
			policy: {
				runtime: 'edge',
				region: 'iad1',
				cache: { revalidate: 60, tags: ['users'] },
			},
		});
		expect(manifest.diagnostics).toEqual([]);
	});

	it('inherits policy through a dependency layer, route overriding', () => {
		const Base = defineLayer({
			name: 'base',
			server: {
				metadata: { runtime: 'node', region: 'iad1' },
			},
		});
		const Api = defineLayer({
			name: 'api',
			dependencies: ['base'],
			server: {
				api: {
					'/api/edge': {
						GET: () => ({ ok: true }),
						metadata: { runtime: 'edge' },
					},
				},
			},
		});

		const manifest = compileServerPolicy([Base, Api]);
		const route = manifest.routes.find((r) => r.path === '/api/edge');

		expect(route?.policy).toEqual({ runtime: 'edge', region: 'iad1' });
		expect(route?.diagnostics).toEqual([
			expect.objectContaining({
				key: 'runtime',
				from: 'dependency',
				to: 'route',
			}),
		]);
		expect(route?.provenance).toEqual(
			expect.arrayContaining([
				{ key: 'runtime', source: 'route', name: '/api/edge' },
				{ key: 'region', source: 'dependency', name: 'base' },
			])
		);
	});

	it('compiles action policies with resolved paths', () => {
		const Api = defineLayer({
			name: 'api',
			server: {
				metadata: { runtime: 'node' },
				actions: {
					refresh: () => ({ ok: true }),
				},
			},
		});

		const manifest = compileServerPolicy([Api]);

		expect(manifest.actions).toHaveLength(1);
		expect(manifest.actions[0]).toMatchObject({
			layer: 'api',
			name: 'refresh',
			method: 'POST',
			policy: { runtime: 'node' },
		});
	});

	it('produces a stable golden manifest for a multi-layer graph', () => {
		const Base = defineLayer({
			name: 'base',
			server: {
				metadata: {
					runtime: 'node',
					headers: { 'x-powered-by': 'effuse' },
					cache: { tags: ['base'] },
				},
			},
		});
		const Api = defineLayer({
			name: 'api',
			dependencies: ['base'],
			server: {
				metadata: { region: 'iad1', cache: { tags: ['api'] } },
				api: {
					'/api/report': {
						GET: () => ({ ok: true }),
						metadata: {
							runtime: 'edge',
							renderMode: 'isr',
							prerender: { revalidate: 120 },
							cache: { tags: ['report'] },
						},
					},
				},
			},
		});

		const manifest = compileServerPolicy([Base, Api]);
		const route = manifest.routes.find((r) => r.path === '/api/report');

		expect(route?.policy).toEqual({
			runtime: 'edge',
			region: 'iad1',
			renderMode: 'isr',
			prerender: { revalidate: 120 },
			headers: { 'x-powered-by': 'effuse' },
			cache: { tags: ['base', 'api', 'report'] },
		});
		// Only runtime was truly overridden (node -> edge); tags union additively.
		expect(route?.diagnostics).toEqual([
			expect.objectContaining({ key: 'runtime', from: 'dependency', to: 'route' }),
		]);
	});
});
