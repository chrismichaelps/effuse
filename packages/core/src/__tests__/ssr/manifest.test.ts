import { describe, it, expect, afterEach } from 'vitest';
import { defineLayer } from '../../layers/api/defineLayer.js';
import { clearGlobalLayerContext } from '../../layers/context.js';
import { clearGlobalTracing } from '../../layers/tracing/index.js';
import { createLayerServerManifest } from '../../ssr/manifest.js';

afterEach(() => {
	clearGlobalLayerContext();
	clearGlobalTracing();
});

describe('layer server manifest', () => {
	it('should describe layer API routes, server routes, and actions', () => {
		const UsersLayer = defineLayer({
			name: 'users',
			server: {
				api: {
					'/api/users': {
						GET: () => ({ users: [] }),
						POST: () => ({ ok: true }),
					},
					'/api/users/:id': () => ({ ok: true }),
				},
				routes: [
					{
						path: '/dashboard/users/[id]',
						methods: {
							PATCH: () => ({ ok: true }),
						},
					},
				],
				actions: {
					refresh: () => ({ ok: true }),
					'settings/save': () => ({ ok: true }),
				},
			},
		});

		const manifest = createLayerServerManifest([UsersLayer]);

		expect(manifest.layers).toHaveLength(1);
		expect(manifest.layers[0]).toMatchObject({
			name: 'users',
		});
		expect(manifest.routes).toEqual([
			{
				layer: 'users',
				source: 'api',
				path: '/api/users',
				methods: ['GET', 'POST'],
			},
			{
				layer: 'users',
				source: 'api',
				path: '/api/users/:id',
				methods: ['GET'],
			},
			{
				layer: 'users',
				source: 'routes',
				path: '/dashboard/users/[id]',
				methods: ['PATCH'],
			},
		]);
		expect(manifest.actions).toEqual([
			{
				layer: 'users',
				name: 'refresh',
				method: 'POST',
				path: '/_effuse/actions/users/refresh',
				legacyPath: '/_effuse/actions/refresh',
			},
			{
				layer: 'users',
				name: 'settings/save',
				method: 'POST',
				path: '/_effuse/actions/users/settings%2Fsave',
				legacyPath: '/_effuse/actions/settings%2Fsave',
			},
		]);
	});

	it('should resolve alias records through real layer names', () => {
		const BillingLayer = defineLayer({
			name: 'billing-domain',
			server: {
				actions: {
					checkout: () => ({ ok: true }),
				},
			},
		});

		const manifest = createLayerServerManifest({ billing: BillingLayer });

		expect(manifest.layers[0]?.name).toBe('billing-domain');
		expect(manifest.actions[0]).toMatchObject({
			layer: 'billing-domain',
			name: 'checkout',
			path: '/_effuse/actions/billing-domain/checkout',
		});
	});

	it('should keep duplicate action names scoped by layer', () => {
		const AccountsLayer = defineLayer({
			name: 'accounts',
			server: {
				actions: {
					load: () => ({ source: 'accounts' }),
				},
			},
		});
		const ProjectsLayer = defineLayer({
			name: 'projects',
			server: {
				actions: {
					load: () => ({ source: 'projects' }),
				},
			},
		});

		const manifest = createLayerServerManifest([AccountsLayer, ProjectsLayer]);

		expect(manifest.actions.map((action) => action.path)).toEqual([
			'/_effuse/actions/accounts/load',
			'/_effuse/actions/projects/load',
		]);
		expect(manifest.actions.map((action) => action.legacyPath)).toEqual([
			'/_effuse/actions/load',
			'/_effuse/actions/load',
		]);
	});

	it('should include route and action metadata', () => {
		const ApiLayer = defineLayer({
			name: 'metadata-manifest',
			server: {
				metadata: {
					runtime: 'edge',
				},
				api: {
					'/api/users': {
						GET: () => ({ ok: true }),
						metadata: {
							cache: {
								revalidate: 120,
								tags: ['users'],
							},
						},
					},
				},
				actions: {
					refresh: {
						handler: () => ({ ok: true }),
						metadata: {
							maxDuration: 10,
							region: 'iad1',
						},
					},
				},
			},
		});

		const manifest = createLayerServerManifest([ApiLayer]);

		expect(manifest.routes[0]).toMatchObject({
			layer: 'metadata-manifest',
			metadata: {
				cache: {
					revalidate: 120,
					tags: ['users'],
				},
				runtime: 'edge',
			},
			path: '/api/users',
		});
		expect(manifest.actions[0]).toMatchObject({
			layer: 'metadata-manifest',
			metadata: {
				maxDuration: 10,
				region: 'iad1',
				runtime: 'edge',
			},
			name: 'refresh',
		});
		expect(manifest.diagnostics).toHaveLength(0);
	});

	it('should report metadata conflicts in the manifest', () => {
		const ApiLayer = defineLayer({
			name: 'conflicted-metadata',
			server: {
				metadata: {
					runtime: 'edge',
				},
				api: {
					'/api/node-only': {
						GET: () => ({ ok: true }),
						metadata: {
							runtime: 'node',
						},
					},
				},
			},
		});

		const manifest = createLayerServerManifest([ApiLayer]);

		expect(manifest.routes[0]).toMatchObject({
			diagnostics: [
				{
					code: 'metadata_conflict',
					key: 'runtime',
					layer: 'conflicted-metadata',
					target: '/api/node-only',
				},
			],
			metadata: {
				runtime: 'node',
			},
		});
		expect(manifest.diagnostics).toEqual(
			manifest.routes[0]?.diagnostics
		);
	});
});
