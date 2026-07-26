import { describe, it, expect, afterEach } from 'vitest';
import { handleLayerServerRequest } from '../../ssr/server-routing.js';
import { compileServerMiddlewareGraph } from '../../ssr/middleware-graph.js';
import { defineServerMiddleware } from '../../ssr/middleware-definition.js';
import { createResponseCache } from '../../ssr/response-cache.js';
import { defineLayer } from '../../layers/api/defineLayer.js';
import { clearGlobalLayerContext } from '../../layers/context.js';
import { clearGlobalTracing } from '../../layers/tracing/index.js';

afterEach(() => {
	clearGlobalLayerContext();
	clearGlobalTracing();
});

const get = (path: string, init?: RequestInit) =>
	new Request(`http://localhost:3000${path}`, init);

const layer = (onHandler: () => void = () => undefined) =>
	defineLayer({
		name: 'app',
		server: {
			api: {
				'/api/admin/reports': {
					GET: () => {
						onHandler();
						return { ok: true };
					},
				},
				'/api/public': { GET: () => ({ open: true }) },
			},
		},
	});

const authGuard = defineServerMiddleware({
	name: 'admin-auth',
	phase: 'request',
	match: { paths: '/api/admin/[...rest]' },
	handler: ({ request }, next) => {
		if (request.headers.get('authorization') !== 'Bearer ok') {
			return Response.json({ error: 'Unauthorized' }, { status: 401 });
		}
		return next();
	},
});

const graph = () =>
	compileServerMiddlewareGraph([
		{ scope: 'global', middleware: authGuard },
	]);

describe('filesystem middleware in route dispatch', () => {
	it('rejects an unauthenticated request before the handler runs', async () => {
		let handlerRan = false;
		const response = await handleLayerServerRequest(
			get('/api/admin/reports'),
			[layer(() => (handlerRan = true))],
			{ middleware: graph() }
		);

		expect(response?.status).toBe(401);
		expect(handlerRan).toBe(false);
	});

	it('allows an authenticated request through to the handler', async () => {
		let handlerRan = false;
		const response = await handleLayerServerRequest(
			get('/api/admin/reports', {
				headers: { authorization: 'Bearer ok' },
			}),
			[layer(() => (handlerRan = true))],
			{ middleware: graph() }
		);

		expect(response?.status).toBe(200);
		expect(handlerRan).toBe(true);
		expect(await response?.json()).toEqual({ ok: true });
	});

	it('does not apply middleware whose match excludes the route', async () => {
		const response = await handleLayerServerRequest(
			get('/api/public'),
			[layer()],
			{ middleware: graph() }
		);

		expect(response?.status).toBe(200);
		expect(await response?.json()).toEqual({ open: true });
	});

	it('behaves exactly as before when no graph is supplied', async () => {
		const response = await handleLayerServerRequest(
			get('/api/admin/reports'),
			[layer()]
		);

		// Without a graph the guard cannot run; dispatch is unchanged.
		expect(response?.status).toBe(200);
	});

	it('runs auth middleware outside the cache so a guard is never bypassed', async () => {
		const cache = createResponseCache();
		const cachedLayer = defineLayer({
			name: 'cached',
			server: {
				api: {
					'/api/admin/reports': {
						GET: () => ({ secret: true }),
						metadata: { cache: { revalidate: 60 } },
					},
				},
			},
		});

		// Warm the cache with an authenticated request.
		const authed = await handleLayerServerRequest(
			get('/api/admin/reports', { headers: { authorization: 'Bearer ok' } }),
			[cachedLayer],
			{ middleware: graph(), cache }
		);
		expect(authed?.status).toBe(200);

		// An unauthenticated request must still be rejected, never served the
		// cached authenticated response.
		const anonymous = await handleLayerServerRequest(
			get('/api/admin/reports'),
			[cachedLayer],
			{ middleware: graph(), cache }
		);
		expect(anonymous?.status).toBe(401);
	});

	it('threads request middleware locals into layer middleware and the handler', async () => {
		const order: string[] = [];
		const localGraph = compileServerMiddlewareGraph([
			{
				scope: 'global',
				middleware: defineServerMiddleware({
					name: 'request-context',
					phase: 'request',
					handler: async (ctx, next) => {
						order.push('filesystem:in');
						ctx.locals['actor'] = 'u1';
						const response = await next();
						order.push('filesystem:out');
						return response;
					},
				}),
			},
		]);
		const scopedLayer = defineLayer({
			name: 'scoped',
			server: {
				middleware: [
					async (ctx, next) => {
						order.push(`layer:${String(ctx.locals['actor'])}`);
						return next();
					},
				],
				api: {
					'/api/scoped': {
						GET: (ctx) => {
							order.push('handler');
							return { actor: ctx.locals['actor'] };
						},
					},
				},
			},
		});

		const response = await handleLayerServerRequest(
			get('/api/scoped'),
			[scopedLayer],
			{ middleware: localGraph }
		);

		expect(await response?.json()).toEqual({ actor: 'u1' });
		expect(order).toEqual([
			'filesystem:in',
			'layer:u1',
			'handler',
			'filesystem:out',
		]);
	});

	it('re-matches the route and its guards after a pathname rewrite', async () => {
		const seen: string[] = [];
		const rewriteGraph = compileServerMiddlewareGraph([
			{
				scope: 'global',
				middleware: defineServerMiddleware({
					name: 'legacy-rewrite',
					phase: 'request',
					match: { paths: '/api/legacy' },
					handler: (_ctx, next) =>
						next(new Request('http://localhost:3000/api/current')),
				}),
			},
			{
				scope: 'route',
				middleware: defineServerMiddleware({
					name: 'current-guard',
					phase: 'request',
					match: { paths: '/api/current' },
					handler: (_ctx, next) => {
						seen.push('current-guard');
						return next();
					},
				}),
			},
		]);
		const rewriteLayer = defineLayer({
			name: 'rewrite',
			server: {
				api: {
					'/api/legacy': { GET: () => ({ route: 'legacy' }) },
					'/api/current': { GET: () => ({ route: 'current' }) },
				},
			},
		});

		const response = await handleLayerServerRequest(
			get('/api/legacy'),
			[rewriteLayer],
			{ middleware: rewriteGraph }
		);

		expect(await response?.json()).toEqual({ route: 'current' });
		expect(seen).toEqual(['current-guard']);
	});

	it('runs request middleware cleanup after handler cleanup', async () => {
		const disposed: string[] = [];
		const cleanupGraph = compileServerMiddlewareGraph([
			{
				scope: 'global',
				middleware: defineServerMiddleware({
					name: 'cleanup',
					phase: 'request',
					handler: (ctx, next) => {
						ctx.defer(() => {
							disposed.push('request');
						});
						return next();
					},
				}),
			},
		]);
		const cleanupLayer = defineLayer({
			name: 'cleanup',
			server: {
				api: {
					'/api/cleanup': {
						GET: (ctx) => {
							ctx.defer(() => {
								disposed.push('handler');
							});
							return { ok: true };
						},
					},
				},
			},
		});

		await handleLayerServerRequest(get('/api/cleanup'), [cleanupLayer], {
			middleware: cleanupGraph,
		});

		expect(disposed).toEqual(['handler', 'request']);
	});

	it('returns null for an unmatched route without running middleware', async () => {
		let ran = false;
		const tracking = compileServerMiddlewareGraph([
			{
				scope: 'global',
				middleware: defineServerMiddleware({
					name: 'tracker',
					phase: 'request',
					handler: (_ctx, next) => {
						ran = true;
						return next();
					},
				}),
			},
		]);

		const response = await handleLayerServerRequest(
			get('/api/missing'),
			[layer()],
			{ middleware: tracking }
		);

		expect(response).toBeNull();
		expect(ran).toBe(false);
	});
});
