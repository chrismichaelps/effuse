import { describe, it, expect, afterEach } from 'vitest';
import { callLayerAction } from '../../ssr/actions.js';
import { createHandler } from '../../ssr/handler.js';
import { createLayerServerManifest } from '../../ssr/manifest.js';
import {
	fromServerFiles,
	serverFileToActionName,
	serverFileToRoutePath,
} from '../../ssr/server-files.js';
import { defineLayer } from '../../layers/api/defineLayer.js';
import { clearGlobalLayerContext } from '../../layers/context.js';
import { clearGlobalTracing } from '../../layers/tracing/index.js';
import { CreateTextNode } from '../../render/node.js';
import { EFFUSE_NODE } from '../../constants.js';

afterEach(() => {
	clearGlobalLayerContext();
	clearGlobalTracing();
});

const createRoot = () =>
	CreateTextNode({ [EFFUSE_NODE]: true, text: 'Hello Server Files' });

const createHandlerFetch =
	(handler: (request: Request) => Promise<Response>): typeof fetch =>
	(input, init) => {
		const request = input instanceof Request ? input : new Request(input, init);
		return handler(request);
	};

describe('server file routes', () => {
	it('should convert server file paths into Effuse route and action names', () => {
		expect(
			serverFileToRoutePath('./src/server/api/users/[id]/route.ts')
		).toBe('/api/users/[id]');
		expect(serverFileToRoutePath('./src/server/api/index.ts')).toBe('/api');
		expect(serverFileToRoutePath('./users/[id].ts')).toBe('/api/users/[id]');
		expect(
			serverFileToActionName('./src/server/actions/users/refresh.ts')
		).toBe('users/refresh');
		expect(serverFileToActionName('./src/server/actions/users/index.ts')).toBe(
			'users'
		);
	});

	it('should dispatch API files and action files through a layer', async () => {
		const UsersLayer = defineLayer({
			name: 'file-users',
			server: fromServerFiles({
				api: {
					'./src/server/api/users/[id]/route.ts': {
						GET: ({ params, query }) => ({
							id: params.id,
							tab: query.tab,
						}),
						POST: async ({ json, params }) => {
							const input = await json<{ name: string }>();
							return {
								id: params.id,
								name: input.name,
							};
						},
					},
					'./src/server/api/health.ts': {
						default: () => ({ ok: true }),
					},
				},
				actions: {
					'./src/server/actions/users/refresh.ts': {
						default: () => ({ refreshed: true }),
					},
				},
			}),
		});
		const handler = createHandler({
			root: createRoot() as any,
			layers: [UsersLayer],
		});

		const getResponse = await handler(
			new Request('http://localhost:3000/api/users/u1?tab=settings')
		);
		expect(getResponse.status).toBe(200);
		expect(await getResponse.json()).toEqual({
			id: 'u1',
			tab: 'settings',
		});

		const postResponse = await handler(
			new Request('http://localhost:3000/api/users/u2', {
				method: 'POST',
				body: JSON.stringify({ name: 'Ada' }),
			})
		);
		expect(postResponse.status).toBe(200);
		expect(await postResponse.json()).toEqual({
			id: 'u2',
			name: 'Ada',
		});

		const healthResponse = await handler(
			new Request('http://localhost:3000/api/health')
		);
		expect(healthResponse.status).toBe(200);
		expect(await healthResponse.json()).toEqual({ ok: true });

		const actionResult = await callLayerAction(
			UsersLayer,
			'users/refresh',
			undefined,
			{
				baseUrl: 'http://localhost:3000',
				fetch: createHandlerFetch(handler),
			}
		);
		expect(actionResult).toEqual({ refreshed: true });
	});

	it('should expose file routes and actions in the server manifest', () => {
		const AdminLayer = defineLayer({
			name: 'file-admin',
			server: fromServerFiles({
				'./src/server/api/admin/route.ts': {
					methods: {
						DELETE: () => ({ deleted: true }),
					},
				},
				'./src/server/actions/admin.ts': {
					actions: {
						ban: () => ({ banned: true }),
						unban: () => ({ unbanned: true }),
					},
				},
			}),
		});

		const manifest = createLayerServerManifest([AdminLayer]);

		expect(manifest.routes).toEqual([
			{
				layer: 'file-admin',
				source: 'api',
				path: '/api/admin',
				methods: ['DELETE'],
			},
		]);
		expect(manifest.actions).toEqual([
			{
				layer: 'file-admin',
				name: 'admin/ban',
				method: 'POST',
				path: '/_effuse/actions/file-admin/admin%2Fban',
				legacyPath: '/_effuse/actions/admin%2Fban',
			},
			{
				layer: 'file-admin',
				name: 'admin/unban',
				method: 'POST',
				path: '/_effuse/actions/file-admin/admin%2Funban',
				legacyPath: '/_effuse/actions/admin%2Funban',
			},
		]);
	});
});
