import { describe, it, expect, expectTypeOf, afterEach } from 'vitest';
import { defineLayer } from '../../layers/api/defineLayer.js';
import { clearGlobalLayerContext } from '../../layers/context.js';
import { clearGlobalTracing } from '../../layers/tracing/index.js';
import { EFFUSE_NODE } from '../../constants.js';
import { CreateTextNode } from '../../render/node.js';
import { createHandler } from '../../ssr/handler.js';
import {
	createLayerServerManifest,
	type LayerServerManifest,
} from '../../ssr/manifest.js';
import {
	createLayerRoutePath,
	createLayerRouteUrl,
	createLayerServerManifestClient,
	generateLayerServerClientModule,
	getLayerClientErrorBody,
	getLayerClientErrorStatus,
	isLayerClientError,
	LayerServerClientError,
	type ManifestActionName,
	type ManifestLayerName,
	type ManifestRouteMethod,
	type ManifestRouteParams,
	type ManifestRoutePath,
} from '../../ssr/client.js';

afterEach(() => {
	clearGlobalLayerContext();
	clearGlobalTracing();
});

const createRoot = () =>
	CreateTextNode({ [EFFUSE_NODE]: true, text: 'Hello Manifest Client' });

const createHandlerFetch =
	(handler: (request: Request) => Promise<Response>): typeof fetch =>
	(input, init) => {
		const request = input instanceof Request ? input : new Request(input, init);
		return handler(request);
	};

describe('layer server manifest client', () => {
	it('should infer typed manifest names, methods, paths, and params', () => {
		const manifest = {
			layers: [
				{
					name: 'users',
					routes: [
						{
							layer: 'users',
							source: 'api',
							path: '/api/users/[id]',
							methods: ['GET', 'POST'],
						},
					],
					actions: [
						{
							layer: 'users',
							name: 'refresh',
							method: 'POST',
							path: '/_effuse/actions/users/refresh',
							legacyPath: '/_effuse/actions/refresh',
						},
					],
				},
			],
			routes: [
				{
					layer: 'users',
					source: 'api',
					path: '/api/users/[id]',
					methods: ['GET', 'POST'],
				},
			],
			actions: [
				{
					layer: 'users',
					name: 'refresh',
					method: 'POST',
					path: '/_effuse/actions/users/refresh',
					legacyPath: '/_effuse/actions/refresh',
				},
			],
		} as const satisfies LayerServerManifest;

		expectTypeOf<ManifestLayerName<typeof manifest>>().toEqualTypeOf<'users'>();
		expectTypeOf<
			ManifestActionName<typeof manifest, 'users'>
		>().toEqualTypeOf<'refresh'>();
		expectTypeOf<ManifestRoutePath<typeof manifest>>().toEqualTypeOf<
			'/api/users/[id]'
		>();
		expectTypeOf<
			ManifestRouteMethod<typeof manifest, '/api/users/[id]'>
		>().toEqualTypeOf<'GET' | 'POST'>();
		expectTypeOf<
			ManifestRouteParams<'/api/users/[id]/:tab/[...rest]'>
		>().toEqualTypeOf<{
			readonly id:
				| string
				| number
				| boolean
				| readonly (string | number | boolean)[];
			readonly tab:
				| string
				| number
				| boolean
				| readonly (string | number | boolean)[];
			readonly rest:
				| string
				| number
				| boolean
				| readonly (string | number | boolean)[];
		}>();
		expectTypeOf<
			ManifestRouteParams<'/api/docs/[[...slug]]'>
		>().toEqualTypeOf<{
			readonly slug?:
				| string
				| number
				| boolean
				| readonly (string | number | boolean)[];
		}>();
	});

	it('should build route paths and URLs with params and query', () => {
		expect(
			createLayerRoutePath('/api/users/[id]/:tab/[...rest]', {
				params: {
					id: 'u1',
					tab: 'settings',
					rest: ['a', 'b'],
				},
				query: {
					include: 'roles',
					page: 2,
				},
			})
		).toBe('/api/users/u1/settings/a/b?include=roles&page=2');
		expect(createLayerRoutePath('/api/docs/[[...slug]]')).toBe('/api/docs');
		expect(
			createLayerRoutePath('/api/docs/[[...slug]]', {
				params: { slug: ['guides', 'setup'] },
			})
		).toBe('/api/docs/guides/setup');
		expect(
			createLayerRoutePath('/api/docs/[[...slug]]', {
				params: { slug: [] },
			})
		).toBe('/api/docs');
		expect(
			createLayerRouteUrl('/api/users/[id]', {
				baseUrl: 'http://localhost:3000',
				params: { id: 'u1' },
			})
		).toBe('http://localhost:3000/api/users/u1');
	});

	it('should call manifest routes and actions through the Effuse handler', async () => {
		const UsersLayer = defineLayer({
			name: 'manifest-users',
			server: {
				api: {
					'/api/users/[id]': {
						GET: ({ params, query }) => ({
							id: params.id,
							tab: query.tab,
						}),
						POST: async ({ params, json }) => {
							const input = await json<{ name: string }>();
							return {
								id: params.id,
								name: input.name,
							};
						},
					},
				},
				actions: {
					refresh: () => ({ refreshed: true }),
				},
			},
		});
		const handler = createHandler({
			root: createRoot() as any,
			layers: [UsersLayer],
		});
		const client = createLayerServerManifestClient(
			createLayerServerManifest([UsersLayer]),
			{
				baseUrl: 'http://localhost:3000',
				fetch: createHandlerFetch(handler),
			}
		);

		await expect(
			client.route('/api/users/[id]', {
				params: { id: 'u1' },
				query: { tab: 'settings' },
			})
		).resolves.toEqual({
			id: 'u1',
			tab: 'settings',
		});
		await expect(
			client.route('/api/users/[id]', {
				method: 'POST',
				params: { id: 'u2' },
				body: { name: 'Ada' },
			})
		).resolves.toEqual({
			id: 'u2',
			name: 'Ada',
		});
		await expect(
			client.action('manifest-users', 'refresh')
		).resolves.toEqual({ refreshed: true });
	});

	it('should reject unknown routes, unsupported methods, and bad responses', async () => {
		const FailingLayer = defineLayer({
			name: 'manifest-failing',
			server: {
				api: {
					'/api/fail': () => new Response('nope', { status: 400 }),
				},
				actions: {
					save: ({ response }) =>
						response.error('SAVE_DENIED', 'Save denied.', { status: 409 }),
				},
			},
		});
		const handler = createHandler({
			root: createRoot() as any,
			layers: [FailingLayer],
		});
		const client = createLayerServerManifestClient(
			createLayerServerManifest([FailingLayer]),
			{
				baseUrl: 'http://localhost:3000',
				fetch: createHandlerFetch(handler),
			}
		);

		await expect(
			client.route('/api/missing' as '/api/fail')
		).rejects.toThrow('Unknown Effuse route "/api/missing".');
		await expect(
			client.route('/api/fail', { method: 'POST' })
		).rejects.toThrow('Effuse route "/api/fail" does not support POST.');
		await expect(client.route('/api/fail')).rejects.toMatchObject({
			name: 'LayerServerClientError',
			status: 400,
			body: 'nope',
		});
		await expect(client.route('/api/fail')).rejects.toBeInstanceOf(
			LayerServerClientError
		);
		await client.route('/api/fail').catch((error: unknown) => {
			expect(isLayerClientError(error)).toBe(true);
			expect(getLayerClientErrorStatus(error)).toBe(400);
			expect(getLayerClientErrorBody(error)).toBe('nope');
		});
		await client.action('manifest-failing', 'save').catch((error: unknown) => {
			expect(isLayerClientError(error)).toBe(true);
			expect(getLayerClientErrorStatus(error)).toBe(409);
			expect(getLayerClientErrorBody(error)).toContain('SAVE_DENIED');
		});
		await expect(
			client.action('manifest-failing', 'missing' as 'save')
		).rejects.toThrow('Unknown Effuse action "manifest-failing.missing".');
	});

	it('should generate a typed client module from the manifest', () => {
		const manifest = {
			layers: [
				{
					name: 'users',
					routes: [],
					actions: [
						{
							layer: 'users',
							name: 'refresh',
							method: 'POST',
							path: '/_effuse/actions/users/refresh',
							legacyPath: '/_effuse/actions/refresh',
						},
					],
				},
			],
			routes: [],
			actions: [
				{
					layer: 'users',
					name: 'refresh',
					method: 'POST',
					path: '/_effuse/actions/users/refresh',
					legacyPath: '/_effuse/actions/refresh',
				},
			],
		} as const satisfies LayerServerManifest;

		expect(
			generateLayerServerClientModule(manifest, {
				clientTypeName: 'UsersClient',
				factoryName: 'createUsersClient',
				importSource: '@effuse/core/ssr',
				manifestName: 'usersManifest',
			})
		).toContain(
			'import { createLayerServerManifestClient, type LayerActionCallOptions, type LayerServerManifest } from "@effuse/core/ssr";'
		);
		expect(generateLayerServerClientModule(manifest)).toContain(
			'export const layerServerManifest = {'
		);
		expect(generateLayerServerClientModule(manifest)).toContain(
			'export type LayerServerClient = ReturnType<typeof createLayerServerClient>;'
		);
	});

	it('should reject unsafe generated client identifiers', () => {
		const manifest = createLayerServerManifest([]);

		expect(() =>
			generateLayerServerClientModule(manifest, {
				factoryName: 'create-client',
			})
		).toThrow('Invalid factory identifier "create-client".');
	});
});
