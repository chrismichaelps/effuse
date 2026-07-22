import { describe, it, expect, expectTypeOf, afterEach } from 'vitest';
import { callLayerAction } from '../../ssr/actions.js';
import { createHandler } from '../../ssr/handler.js';
import { createLayerServerManifest } from '../../ssr/manifest.js';
import {
	defineServerFileHandler,
	fromServerFiles,
	type ServerApiFileModule,
	type ServerFileContext,
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
	it('should infer exact params and preserve handler identity', () => {
		const handler = (context: ServerFileContext<'/api/users/[id]'>) => {
			expectTypeOf(context.params).toEqualTypeOf<Readonly<{ id: string }>>();
			// @ts-expect-error undeclared route params must not compile
			context.params.userId;
			return { id: context.params.id };
		};
		const GET = defineServerFileHandler('/api/users/[id]', handler);

		expect(GET).toBe(handler);
		expect(GET({ params: { id: 'u1' } } as never)).toEqual({ id: 'u1' });

		const optional = defineServerFileHandler(
			'/api/(docs)/docs/[[...slug]]',
			({ params }) => {
				expectTypeOf(params).toEqualTypeOf<Readonly<{ slug: string }>>();
				return params.slug || 'index';
			}
		);
		expect(optional({ params: { slug: '' } } as never)).toBe('index');
	});

	it('should reject a handler path that drifts from its file route', () => {
		const Layer = defineLayer({
			name: 'file-path-mismatch',
			server: fromServerFiles({
				'./src/server/api/users/[id]/route.ts': {
					GET: defineServerFileHandler('/api/projects/[id]', ({ params }) => ({
						id: params.id,
					})),
				},
			}),
		});
		const manifest = createLayerServerManifest([Layer]);

		expect(manifest.routes).toEqual([]);
		expect(manifest.diagnostics).toEqual([
			expect.objectContaining({
				code: 'server_file_path_mismatch',
				filePath: './src/server/api/users/[id]/route.ts',
				key: '/api/projects/[id]',
				target: '/api/users/[id]',
			}),
		]);
	});

	it('should convert server file paths into Effuse route and action names', () => {
		expect(serverFileToRoutePath('./src/server/api/users/[id]/route.ts')).toBe(
			'/api/users/[id]'
		);
		expect(serverFileToRoutePath('./app/api/users/[id]/route.ts')).toBe(
			'/api/users/[id]'
		);
		expect(
			serverFileToRoutePath('./app/api/(admin)/docs/[[...slug]]/route.ts')
		).toBe('/api/docs/[[...slug]]');
		expect(serverFileToRoutePath('./src/api/health.ts')).toBe('/api/health');
		expect(
			serverFileToRoutePath('./routes/api/users/[id].ts', {
				apiDir: ['routes/api', 'server/api'],
			})
		).toBe('/api/users/[id]');
		expect(serverFileToRoutePath('./src/server/api/index.ts')).toBe('/api');
		expect(serverFileToRoutePath('./users/[id].ts')).toBe('/api/users/[id]');
		expect(
			serverFileToActionName('./src/server/actions/users/refresh.ts')
		).toBe('users/refresh');
		expect(serverFileToActionName('./app/actions/users/refresh.ts')).toBe(
			'users/refresh'
		);
		expect(
			serverFileToActionName('./app/actions/(admin)/users/refresh.ts')
		).toBe('users/refresh');
		expect(serverFileToActionName('./src/actions/users/index.ts')).toBe(
			'users'
		);
		expect(
			serverFileToActionName('./commands/users/refresh.ts', {
				actionsDir: ['commands', 'server/actions'],
			})
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
						GET: defineServerFileHandler(
							'/api/users/[id]',
							({ params, query }) => ({
								id: params.id,
								tab: query.tab,
							})
						),
						POST: defineServerFileHandler(
							'/api/users/[id]',
							async ({ json, params }) => {
								const input = await json<{ name: string }>();
								return {
									id: params.id,
									name: input.name,
								};
							}
						),
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

	it('should dispatch Next-style app/api files and app/actions files by default', async () => {
		const ProjectsLayer = defineLayer({
			name: 'next-style-files',
			server: fromServerFiles({
				'./app/api/projects/[id]/route.ts': {
					GET: ({ params }) => ({
						id: params.id,
						source: 'app-api',
					}),
				},
				'./app/api/[id]/route.ts': {
					GET: ({ params }) => ({
						id: params.id,
						source: 'app-api-dynamic',
					}),
				},
				'./app/api/(docs)/docs/[[...slug]]/route.ts': {
					GET: ({ params }) => ({
						slug: params.slug || 'index',
						source: 'app-api-group',
					}),
				},
				'./app/actions/projects/archive.ts': {
					default: () => ({ archived: true, source: 'app-actions' }),
				},
			}),
		});
		const handler = createHandler({
			root: createRoot() as any,
			layers: [ProjectsLayer],
		});

		const routeResponse = await handler(
			new Request('http://localhost:3000/api/projects/p1')
		);
		expect(routeResponse.status).toBe(200);
		expect(await routeResponse.json()).toEqual({
			id: 'p1',
			source: 'app-api',
		});

		const docsIndexResponse = await handler(
			new Request('http://localhost:3000/api/docs')
		);
		expect(docsIndexResponse.status).toBe(200);
		expect(await docsIndexResponse.json()).toEqual({
			slug: 'index',
			source: 'app-api-group',
		});

		const docsNestedResponse = await handler(
			new Request('http://localhost:3000/api/docs/guides/setup')
		);
		expect(docsNestedResponse.status).toBe(200);
		expect(await docsNestedResponse.json()).toEqual({
			slug: 'guides/setup',
			source: 'app-api-group',
		});

		const actionResult = await callLayerAction(
			ProjectsLayer,
			'projects/archive',
			undefined,
			{
				baseUrl: 'http://localhost:3000',
				fetch: createHandlerFetch(handler),
			}
		);
		expect(actionResult).toEqual({
			archived: true,
			source: 'app-actions',
		});
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

	it('should report file route and action diagnostics in the manifest', () => {
		const DiagnosticsLayer = defineLayer({
			name: 'file-diagnostics',
			server: fromServerFiles({
				api: {
					'./src/server/api/settings.ts': {
						path: '/api/settings',
						GET: () => ({ ok: true }),
					},
					'./src/server/api/settings-copy.ts': {
						path: '/api/settings',
						GET: () => ({ ok: false }),
					},
					'./src/server/api/users/[id].ts': {
						GET: ({ params }) => ({ id: params.id }),
					},
					'./src/server/api/users/[name].ts': {
						GET: ({ params }) => ({ name: params.name }),
					},
					'./src/server/api/empty.ts': {},
					'./src/server/api/lowercase.ts': {
						get: () => ({ ok: true }),
					} as unknown as ServerApiFileModule,
				},
				actions: {
					'./src/server/actions/refresh.ts': {
						name: 'users/refresh',
						default: () => ({ ok: true }),
					},
					'./src/server/actions/refresh-copy.ts': {
						name: 'users/refresh',
						default: () => ({ ok: false }),
					},
					'./src/server/actions/empty.ts': {},
				},
			}),
		});

		const manifest = createLayerServerManifest([DiagnosticsLayer]);
		const diagnostics = manifest.diagnostics ?? [];

		expect(manifest.routes.map((route) => route.path)).toEqual([
			'/api/settings',
			'/api/users/[id]',
		]);
		expect(manifest.actions.map((action) => action.name)).toEqual([
			'users/refresh',
		]);
		expect(diagnostics.map((diagnostic) => diagnostic.code)).toEqual(
			expect.arrayContaining([
				'server_file_duplicate_route',
				'server_file_ambiguous_route',
				'server_file_invalid_route',
				'server_file_invalid_method',
				'server_file_duplicate_action',
				'server_file_invalid_action',
			])
		);
		expect(
			diagnostics.every((diagnostic) => diagnostic.layer === 'file-diagnostics')
		).toBe(true);
		expect(diagnostics).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					code: 'server_file_duplicate_route',
					target: '/api/settings',
					filePath: './src/server/api/settings-copy.ts',
				}),
				expect.objectContaining({
					code: 'server_file_ambiguous_route',
					target: '/api/users/[name]',
					filePath: './src/server/api/users/[name].ts',
				}),
				expect.objectContaining({
					code: 'server_file_duplicate_action',
					target: 'users/refresh',
					filePath: './src/server/actions/refresh-copy.ts',
				}),
			])
		);
	});
});
