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

const req = (path: string, init?: RequestInit) =>
	new Request(`http://localhost:3000${path}`, init);

const graphOf = (
	...middleware: ReturnType<typeof defineServerMiddleware>[]
) =>
	compileServerMiddlewareGraph(
		middleware.map((m) => ({ scope: 'global' as const, middleware: m }))
	);

describe('dispatch edge cases: methods and status', () => {
	const layer = defineLayer({
		name: 'methods',
		server: {
			api: {
				'/api/items': {
					GET: () => ({ items: [] }),
					POST: () => ({ created: true }),
				},
			},
		},
	});

	it('returns 405 with an Allow header for an unsupported method', async () => {
		const response = await handleLayerServerRequest(
			req('/api/items', { method: 'DELETE' }),
			[layer]
		);

		expect(response?.status).toBe(405);
		const allow = response?.headers.get('Allow') ?? '';
		expect(allow).toContain('GET');
		expect(allow).toContain('POST');
	});

	it('serves HEAD from the GET handler', async () => {
		const response = await handleLayerServerRequest(
			req('/api/items', { method: 'HEAD' }),
			[layer]
		);
		expect(response?.status).toBe(200);
	});

	it('returns null for a path with no route at all', async () => {
		expect(
			await handleLayerServerRequest(req('/api/nope'), [layer])
		).toBeNull();
	});
});

describe('dispatch edge cases: params and encoding', () => {
	const layer = defineLayer({
		name: 'params',
		server: {
			api: {
				'/api/users/[id]': { GET: ({ params }) => ({ id: params.id }) },
				'/api/files/[...path]': {
					GET: ({ params }) => ({ path: params.path }),
				},
			},
		},
	});

	it('decodes a percent-encoded path parameter', async () => {
		const response = await handleLayerServerRequest(
			req('/api/users/a%20b'),
			[layer]
		);
		expect(await response?.json()).toEqual({ id: 'a b' });
	});

	it('captures a multi-segment catch-all', async () => {
		const response = await handleLayerServerRequest(
			req('/api/files/docs/deep/file.txt'),
			[layer]
		);
		expect(await response?.json()).toEqual({ path: 'docs/deep/file.txt' });
	});

	it('does not match a catch-all with zero segments', async () => {
		expect(
			await handleLayerServerRequest(req('/api/files'), [layer])
		).toBeNull();
	});

	it('keeps a query string out of the matched path', async () => {
		const response = await handleLayerServerRequest(
			req('/api/users/u1?expand=roles'),
			[layer]
		);
		expect(await response?.json()).toEqual({ id: 'u1' });
	});
});

describe('dispatch edge cases: middleware ordering', () => {
	const layer = defineLayer({
		name: 'ordered',
		server: { api: { '/api/x': { GET: () => ({ ok: true }) } } },
	});

	it('runs middleware in scope order around the handler', async () => {
		const order: string[] = [];
		const mw = (name: string) =>
			defineServerMiddleware({
				name,
				phase: 'request',
				handler: async (_ctx, next) => {
					order.push(`${name}:in`);
					const response = await next();
					order.push(`${name}:out`);
					return response;
				},
			});

		await handleLayerServerRequest(req('/api/x'), [layer], {
			middleware: compileServerMiddlewareGraph([
				{ scope: 'engine', middleware: mw('engine') },
				{ scope: 'route', middleware: mw('route') },
			]),
		});

		expect(order).toEqual([
			'engine:in',
			'route:in',
			'route:out',
			'engine:out',
		]);
	});

	it('lets middleware rewrite response headers on the way out', async () => {
		const decorate = defineServerMiddleware({
			name: 'decorate',
			phase: 'request',
			handler: async (_ctx, next) => {
				const response = await next();
				const headers = new Headers(response.headers);
				headers.set('x-decorated', 'yes');
				return new Response(response.body, {
					status: response.status,
					headers,
				});
			},
		});

		const response = await handleLayerServerRequest(req('/api/x'), [layer], {
			middleware: graphOf(decorate),
		});

		expect(response?.headers.get('x-decorated')).toBe('yes');
	});

	it('propagates a middleware failure without reaching the handler', async () => {
		let handlerRan = false;
		const failing = defineServerMiddleware({
			name: 'boom',
			phase: 'request',
			handler: () => {
				throw new Error('middleware exploded');
			},
		});
		const tracked = defineLayer({
			name: 'tracked',
			server: {
				api: {
					'/api/x': {
						GET: () => {
							handlerRan = true;
							return { ok: true };
						},
					},
				},
			},
		});

		await expect(
			handleLayerServerRequest(req('/api/x'), [tracked], {
				middleware: graphOf(failing),
			})
		).rejects.toThrow('middleware exploded');
		expect(handlerRan).toBe(false);
	});
});

describe('dispatch edge cases: cache interaction', () => {
	it('does not serve a cached response to a request a guard rejects', async () => {
		const cache = createResponseCache();
		const layer = defineLayer({
			name: 'private',
			server: {
				api: {
					'/api/private': {
						GET: () => ({ secret: true }),
						metadata: { cache: { revalidate: 60 } },
					},
				},
			},
		});
		const guard = defineServerMiddleware({
			name: 'guard',
			phase: 'request',
			handler: ({ request }, next) =>
				request.headers.get('x-key') === 'ok'
					? next()
					: Response.json({ error: 'denied' }, { status: 403 }),
		});

		const allowed = await handleLayerServerRequest(
			req('/api/private', { headers: { 'x-key': 'ok' } }),
			[layer],
			{ middleware: graphOf(guard), cache }
		);
		expect(allowed?.status).toBe(200);

		const denied = await handleLayerServerRequest(req('/api/private'), [layer], {
			middleware: graphOf(guard),
			cache,
		});
		expect(denied?.status).toBe(403);
	});

	it('never caches a mutating method even under a cache policy', async () => {
		const cache = createResponseCache();
		let posts = 0;
		const layer = defineLayer({
			name: 'mutating',
			server: {
				api: {
					'/api/submit': {
						POST: () => {
							posts += 1;
							return { n: posts };
						},
						metadata: { cache: { revalidate: 60 } },
					},
				},
			},
		});

		await handleLayerServerRequest(req('/api/submit', { method: 'POST' }), [layer], { cache });
		await handleLayerServerRequest(req('/api/submit', { method: 'POST' }), [layer], { cache });

		expect(posts).toBe(2);
	});
});

describe('dispatch edge cases: handler failures', () => {
	it('propagates a thrown handler error to the adapter rather than swallowing it', async () => {
		const layer = defineLayer({
			name: 'throwing',
			server: {
				api: {
					'/api/bad': {
						GET: () => {
							throw new Error('handler failed');
						},
					},
				},
			},
		});

		// Dispatch does not invent an error envelope; the adapter owns that
		// decision (createHandler turns this into a 500). What matters is that
		// the failure is never swallowed into a misleading 200.
		await expect(
			handleLayerServerRequest(req('/api/bad'), [layer])
		).rejects.toThrow('handler failed');
	});

	it('returns a raw Response from a handler untouched', async () => {
		const layer = defineLayer({
			name: 'raw',
			server: {
				api: {
					'/api/raw': {
						GET: () =>
							new Response('plain', {
								status: 201,
								headers: { 'content-type': 'text/plain' },
							}),
					},
				},
			},
		});

		const response = await handleLayerServerRequest(req('/api/raw'), [layer]);
		expect(response?.status).toBe(201);
		expect(response?.headers.get('content-type')).toBe('text/plain');
		expect(await response?.text()).toBe('plain');
	});
});
