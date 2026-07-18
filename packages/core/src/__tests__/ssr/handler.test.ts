import { describe, it, expect, afterEach, vi } from 'vitest';
import {
	createHandler,
	createStreamingHandler,
	parseQuery,
	createRequestContext,
} from '../../ssr/handler.js';
import { defineLayer } from '../../layers/api/defineLayer.js';
import { LayerNameCollisionError } from '../../layers/errors.js';
import { clearGlobalLayerContext } from '../../layers/context.js';
import { clearGlobalTracing } from '../../layers/tracing/index.js';
import { CreateTextNode, type Component } from '../../render/node.js';
import { EFFUSE_NODE } from '../../constants.js';
import type { ServerTraceEvent } from '../../ssr/observability.js';

afterEach(() => {
	clearGlobalLayerContext();
	clearGlobalTracing();
});

const createRoot = () =>
	CreateTextNode({ [EFFUSE_NODE]: true, text: 'Hello SSR' });

const createRootComponent = (): Component => {
	const textNode = createRoot();
	return Object.assign(() => textNode, {
		_tag: 'Blueprint',
		view: () => textNode,
	}) as Component;
};

describe('SSR handler', () => {
	describe('createHandler', () => {
		it('should return 200 with HTML for a valid route', async () => {
			const handler = createHandler({
				root: createRoot() as any,
				layers: [],
			});

			const request = new Request('http://localhost:3000/');
			const response = await handler(request);

			expect(response.status).toBe(200);
			expect(response.headers.get('Content-Type')).toBe(
				'text/html; charset=utf-8'
			);

			const html = await response.text();
			expect(html).toContain('<!DOCTYPE html>');
			expect(html).toContain('Hello SSR');
		});

		it('should include ETag header', async () => {
			const handler = createHandler({
				root: createRoot() as any,
				layers: [],
			});

			const request = new Request('http://localhost:3000/');
			const response = await handler(request);

			const etag = response.headers.get('ETag');
			expect(etag).toBeTruthy();
			expect(etag).toMatch(/^"[a-f0-9]+"$/);
		});

		it('should return 304 for conditional requests with matching ETag', async () => {
			const originalNow = Date.now;
			Date.now = () => 1000000000000; // Fixed timestamp for deterministic ETags

			try {
				const handler = createHandler({
					root: createRoot() as any,
					layers: [],
				});

				// First request to get the ETag
				const firstResponse = await handler(
					new Request('http://localhost:3000/')
				);
				const etag = firstResponse.headers.get('ETag')!;

				// Second request with If-None-Match
				const secondResponse = await handler(
					new Request('http://localhost:3000/', {
						headers: { 'If-None-Match': etag },
					})
				);

				expect(secondResponse.status).toBe(304);
			} finally {
				Date.now = originalNow;
			}
		});

		it('should skip static asset paths', async () => {
			const handler = createHandler({
				root: createRoot() as any,
				layers: [],
			});

			const extensions = ['.js', '.css', '.png', '.jpg', '.svg', '.ico'];

			for (const ext of extensions) {
				const request = new Request(`http://localhost:3000/assets/file${ext}`);
				const response = await handler(request);
				expect(response.status).toBe(404);
			}
		});

		it('should include Cache-Control header', async () => {
			const handler = createHandler({
				root: createRoot() as any,
				layers: [],
				cacheMaxAge: 60,
				cacheSMaxAge: 3600,
			});

			const request = new Request('http://localhost:3000/');
			const response = await handler(request);

			const cacheControl = response.headers.get('Cache-Control');
			expect(cacheControl).toContain('public');
			expect(cacheControl).toContain('max-age=60');
			expect(cacheControl).toContain('s-maxage=3600');
			expect(cacheControl).toContain('must-revalidate');
		});

		it('should include X-Content-Type-Options header', async () => {
			const handler = createHandler({
				root: createRoot() as any,
				layers: [],
			});

			const request = new Request('http://localhost:3000/');
			const response = await handler(request);

			expect(response.headers.get('X-Content-Type-Options')).toBe('nosniff');
		});

		it('should include Content-Length header', async () => {
			const handler = createHandler({
				root: createRoot() as any,
				layers: [],
			});

			const request = new Request('http://localhost:3000/');
			const response = await handler(request);

			const contentLength = response.headers.get('Content-Length');
			expect(contentLength).toBeTruthy();
			expect(Number(contentLength)).toBeGreaterThan(0);
		});

		it('should serve layer API routes before SSR fallback', async () => {
			const ApiLayer = defineLayer({
				name: 'api',
				services: {
					clock: () => ({ now: () => 123 }),
				},
				server: {
					api: {
						'/api/time': ({ services }) => ({
							now: services.clock.now(),
						}),
					},
				},
			});

			const handler = createHandler({
				root: createRoot() as any,
				layers: [ApiLayer],
			});

			const response = await handler(
				new Request('http://localhost:3000/api/time')
			);

			expect(response.status).toBe(200);
			expect(response.headers.get('Content-Type')).toContain(
				'application/json'
			);
			expect(await response.json()).toEqual({ now: 123 });
		});

		it('should serve layer API routes from aliased layer records', async () => {
			const ApiLayer = defineLayer({
				name: 'api-via-alias',
				services: {
					clock: () => ({ now: () => 456 }),
				},
				server: {
					api: {
						'/api/aliased-time': ({ services }) => ({
							now: services.clock.now(),
						}),
					},
				},
			});

			const handler = createHandler({
				root: createRoot() as any,
				layers: { api: ApiLayer },
			});

			const response = await handler(
				new Request('http://localhost:3000/api/aliased-time')
			);

			expect(response.status).toBe(200);
			expect(await response.json()).toEqual({ now: 456 });
		});

		it('should report duplicate layer names through onError', async () => {
			const onError = vi.fn();
			const FirstLayer = defineLayer({
				name: 'duplicate-handler',
				server: {
					api: {
						'/api/duplicate-handler': () => ({ ok: true }),
					},
				},
			});
			const SecondLayer = defineLayer({
				name: 'duplicate-handler',
			});
			const handler = createHandler({
				root: createRootComponent(),
				layers: [FirstLayer, SecondLayer],
				onError,
			});

			const response = await handler(
				new Request('http://localhost:3000/api/duplicate-handler')
			);

			expect(response.status).toBe(500);
			expect(onError).toHaveBeenCalledOnce();
			expect(onError.mock.calls[0][0]).toBeInstanceOf(LayerNameCollisionError);
			expect(String(onError.mock.calls[0][0])).toContain(
				'Layer "duplicate-handler" is registered more than once'
			);
		});

		it('should pass route params and query to layer API handlers', async () => {
			const ApiLayer = defineLayer({
				name: 'api-params',
				server: {
					api: {
						'/api/users/:id': ({ params, query }) => ({
							id: params.id,
							tab: query.tab,
						}),
					},
				},
			});

			const handler = createHandler({
				root: createRoot() as any,
				layers: [ApiLayer],
			});

			const response = await handler(
				new Request('http://localhost:3000/api/users/u1?tab=settings')
			);

			expect(response.status).toBe(200);
			expect(await response.json()).toEqual({
				id: 'u1',
				tab: 'settings',
			});
		});

		it('should normalize route groups and bracket params through shared grammar', async () => {
			const ApiLayer = defineLayer({
				name: 'api-shared-route-pattern',
				server: {
					api: {
						'/api/(admin)/users/[id]': ({ params }) => ({ id: params.id }),
					},
				},
			});
			const handler = createHandler({
				root: createRoot() as any,
				layers: [ApiLayer],
			});

			const response = await handler(
				new Request('http://localhost:3000/api/users/a%20b')
			);

			expect(response.status).toBe(200);
			expect(await response.json()).toEqual({ id: 'a b' });
		});

		it('should require at least one segment for required catch-all routes', async () => {
			const routeHandler = vi.fn(({ params }) => ({ slug: params.slug }));
			const ApiLayer = defineLayer({
				name: 'api-required-catch-all',
				server: {
					api: {
						'/api/docs/[...slug]': routeHandler,
					},
				},
			});
			const handler = createHandler({
				root: createRoot() as any,
				layers: [ApiLayer],
			});

			const missing = await handler(
				new Request('http://localhost:3000/api/docs')
			);
			const matched = await handler(
				new Request('http://localhost:3000/api/docs/guides/routing')
			);

			expect(missing.headers.get('Content-Type')).toContain('text/html');
			expect(await matched.json()).toEqual({ slug: 'guides/routing' });
			expect(routeHandler).toHaveBeenCalledOnce();
		});

		it('should prefer exact routes over optional catch-alls in either order', async () => {
			for (const paths of [
				['/api/shop/[[...slug]]', '/api/shop'],
				['/api/shop', '/api/shop/[[...slug]]'],
			]) {
				const api = Object.fromEntries(
					paths.map((path) => [
						path,
						() => ({ route: path === '/api/shop' ? 'exact' : 'catch-all' }),
					])
				);
				const ApiLayer = defineLayer({
					name: `api-route-order-${paths[0]}`,
					server: { api },
				});
				const handler = createHandler({
					root: createRoot() as any,
					layers: [ApiLayer],
				});

				const response = await handler(
					new Request('http://localhost:3000/api/shop')
				);
				expect(await response.json()).toEqual({ route: 'exact' });
			}
		});

		it('should return 405 when a layer API route exists but method is missing', async () => {
			const ApiLayer = defineLayer({
				name: 'api-methods',
				server: {
					api: {
						'/api/read-only': {
							GET: () => ({ ok: true }),
						},
					},
				},
			});

			const handler = createHandler({
				root: createRoot() as any,
				layers: [ApiLayer],
			});

			const response = await handler(
				new Request('http://localhost:3000/api/read-only', {
					method: 'POST',
				})
			);

			expect(response.status).toBe(405);
			expect(response.headers.get('Allow')).toBe('GET');
		});

		it('should dispatch layer actions through the reserved action endpoint', async () => {
			const ActionLayer = defineLayer({
				name: 'actions',
				services: {
					math: () => ({ double: (value: number) => value * 2 }),
				},
				server: {
					actions: {
						double: async ({ json, services }) => {
							const input = await json<{ value: number }>();
							return {
								value: services.math.double(input.value),
							};
						},
					},
				},
			});

			const handler = createHandler({
				root: createRoot() as any,
				layers: [ActionLayer],
			});

			const response = await handler(
				new Request('http://localhost:3000/_effuse/actions/double', {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({ value: 21 }),
				})
			);

			expect(response.status).toBe(200);
			expect(await response.json()).toEqual({ value: 42 });
		});

		it('should compose dependency, layer, and route middleware in order', async () => {
			const events: string[] = [];
			const AuthLayer = defineLayer({
				name: 'auth',
				server: {
					middleware: [
						async (_ctx, next) => {
							events.push('auth:before');
							const response = await next();
							events.push('auth:after');
							return response;
						},
					],
				},
			});
			const ApiLayer = defineLayer({
				name: 'middleware-api',
				dependencies: ['auth'] as const,
				server: {
					middleware: [
						async (_ctx, next) => {
							events.push('api:before');
							const response = await next();
							events.push('api:after');
							return response;
						},
					],
					api: {
						'/api/middleware-order': {
							GET: () => {
								events.push('handler');
								return { ok: true };
							},
							middleware: [
								async (_ctx, next) => {
									events.push('route:before');
									const response = await next();
									events.push('route:after');
									return response;
								},
							],
						},
					},
				},
			});
			const handler = createHandler({
				root: createRoot() as any,
				layers: [ApiLayer, AuthLayer],
			});

			const response = await handler(
				new Request('http://localhost:3000/api/middleware-order')
			);

			expect(response.status).toBe(200);
			expect(await response.json()).toEqual({ ok: true });
			expect(events).toEqual([
				'auth:before',
				'api:before',
				'route:before',
				'handler',
				'route:after',
				'api:after',
				'auth:after',
			]);
		});

		it('should allow middleware to short-circuit auth failures', async () => {
			const handlerSpy = vi.fn();
			const AuthLayer = defineLayer({
				name: 'auth-short-circuit',
				server: {
					middleware: [() => new Response('Unauthorized', { status: 401 })],
				},
			});
			const ApiLayer = defineLayer({
				name: 'secure-api',
				dependencies: ['auth-short-circuit'] as const,
				server: {
					api: {
						'/api/secure': () => {
							handlerSpy();
							return { ok: true };
						},
					},
				},
			});
			const handler = createHandler({
				root: createRoot() as any,
				layers: [ApiLayer, AuthLayer],
			});

			const response = await handler(
				new Request('http://localhost:3000/api/secure')
			);

			expect(response.status).toBe(401);
			expect(await response.text()).toBe('Unauthorized');
			expect(handlerSpy).not.toHaveBeenCalled();
		});

		it('should apply cache, CORS, and runtime metadata headers', async () => {
			const ApiLayer = defineLayer({
				name: 'metadata-api',
				server: {
					api: {
						'/api/metadata': {
							GET: () => ({ ok: true }),
							metadata: {
								cache: {
									revalidate: 60,
									tags: ['users', 'settings'],
								},
								cors: {
									credentials: true,
									headers: ['Content-Type'],
									maxAge: 600,
									methods: ['GET'],
									origin: 'https://app.example',
								},
								maxDuration: 5,
								region: ['iad1', 'sfo1'],
								runtime: 'edge',
							},
						},
					},
				},
			});
			const handler = createHandler({
				root: createRoot() as any,
				layers: [ApiLayer],
			});

			const response = await handler(
				new Request('http://localhost:3000/api/metadata')
			);

			expect(response.status).toBe(200);
			expect(response.headers.get('Cache-Control')).toBe(
				's-maxage=60, stale-while-revalidate'
			);
			expect(response.headers.get('X-Effuse-Cache-Tags')).toBe(
				'users, settings'
			);
			expect(response.headers.get('Access-Control-Allow-Origin')).toBe(
				'https://app.example'
			);
			expect(response.headers.get('Access-Control-Allow-Methods')).toBe('GET');
			expect(response.headers.get('Access-Control-Allow-Headers')).toBe(
				'Content-Type'
			);
			expect(response.headers.get('Access-Control-Allow-Credentials')).toBe(
				'true'
			);
			expect(response.headers.get('Access-Control-Max-Age')).toBe('600');
			expect(response.headers.get('X-Effuse-Runtime')).toBe('edge');
			expect(response.headers.get('X-Effuse-Region')).toBe('iad1, sfo1');
			expect(response.headers.get('X-Effuse-Max-Duration')).toBe('5');
			expect(await response.json()).toEqual({ ok: true });
		});

		it('should emit server trace events for successful API routes', async () => {
			const events: ServerTraceEvent[] = [];
			const ApiLayer = defineLayer({
				name: 'trace-api',
				server: {
					api: {
						'/api/traced': () => ({ ok: true }),
					},
				},
			});
			const handler = createHandler({
				root: createRoot() as any,
				layers: [ApiLayer],
				onServerTrace: (event) => events.push(event),
			});

			const response = await handler(
				new Request('http://localhost:3000/api/traced')
			);

			expect(response.status).toBe(200);
			expect(events).toHaveLength(1);
			expect(events[0]).toMatchObject({
				kind: 'api',
				layer: 'trace-api',
				method: 'GET',
				ok: true,
				path: '/api/traced',
				route: '/api/traced',
				status: 200,
				target: '/api/traced',
			});
			expect(events[0]!.durationMs).toBeGreaterThanOrEqual(0);
		});

		it('should isolate server trace hook failures', async () => {
			const onTraceError = vi.fn();
			const ApiLayer = defineLayer({
				name: 'trace-isolated',
				server: {
					api: {
						'/api/isolate-trace': () => ({ ok: true }),
					},
				},
			});
			const handler = createHandler({
				root: createRoot() as any,
				layers: [ApiLayer],
				onServerTrace: () => {
					throw new Error('trace sink failed');
				},
				onServerTraceError: onTraceError,
			});

			const response = await handler(
				new Request('http://localhost:3000/api/isolate-trace')
			);

			expect(response.status).toBe(200);
			expect(await response.json()).toEqual({ ok: true });
			expect(onTraceError).toHaveBeenCalledOnce();
			expect(onTraceError.mock.calls[0][0]).toBeInstanceOf(Error);
			expect(onTraceError.mock.calls[0][1]).toMatchObject({
				kind: 'api',
				ok: true,
				status: 200,
				target: '/api/isolate-trace',
			});
		});

		it('should emit server trace events for 405 responses', async () => {
			const events: ServerTraceEvent[] = [];
			const ApiLayer = defineLayer({
				name: 'trace-405',
				server: {
					api: {
						'/api/read-only': {
							GET: () => ({ ok: true }),
						},
					},
				},
			});
			const handler = createHandler({
				root: createRoot() as any,
				layers: [ApiLayer],
				onServerTrace: (event) => events.push(event),
			});

			const response = await handler(
				new Request('http://localhost:3000/api/read-only', {
					method: 'POST',
				})
			);

			expect(response.status).toBe(405);
			expect(events[0]).toMatchObject({
				kind: 'api',
				layer: 'trace-405',
				method: 'POST',
				ok: false,
				status: 405,
				target: '/api/read-only',
			});
		});

		it('should emit server trace events for action errors', async () => {
			const events: ServerTraceEvent[] = [];
			const ActionLayer = defineLayer({
				name: 'trace-action',
				server: {
					actions: {
						save: ({ response }) =>
							response.error('SAVE_FAILED', 'Save failed.', { status: 409 }),
					},
				},
			});
			const handler = createHandler({
				root: createRoot() as any,
				layers: [ActionLayer],
				onServerTrace: (event) => events.push(event),
			});

			const response = await handler(
				new Request('http://localhost:3000/_effuse/actions/trace-action/save', {
					method: 'POST',
				})
			);

			expect(response.status).toBe(409);
			expect(events[0]).toMatchObject({
				kind: 'action',
				layer: 'trace-action',
				method: 'POST',
				ok: false,
				path: '/_effuse/actions/trace-action/save',
				status: 409,
				target: 'save',
			});
		});

		it('should emit server trace events for thrown route errors', async () => {
			const events: ServerTraceEvent[] = [];
			const onError = vi.fn();
			const ApiLayer = defineLayer({
				name: 'trace-thrown',
				server: {
					api: {
						'/api/boom': () => {
							throw new Error('boom');
						},
					},
				},
			});
			const handler = createHandler({
				root: createRoot() as any,
				layers: [ApiLayer],
				onError,
				onServerTrace: (event) => events.push(event),
			});

			const response = await handler(
				new Request('http://localhost:3000/api/boom')
			);

			expect(response.status).toBe(500);
			expect(onError).toHaveBeenCalledOnce();
			expect(events[0]).toMatchObject({
				error: {
					message: 'boom',
					name: 'Error',
				},
				kind: 'api',
				layer: 'trace-thrown',
				method: 'GET',
				ok: false,
				status: 500,
				target: '/api/boom',
			});
		});
	});

	describe('createStreamingHandler', () => {
		it('should return a streaming response', async () => {
			const handler = createStreamingHandler({
				root: createRoot() as any,
				layers: [],
			});

			const request = new Request('http://localhost:3000/');
			const response = await handler(request);

			expect(response.status).toBe(200);
			expect(response.headers.get('Content-Type')).toBe(
				'text/html; charset=utf-8'
			);
			expect(response.headers.get('Transfer-Encoding')).toBe('chunked');

			const html = await response.text();
			expect(html).toContain('<!DOCTYPE html>');
			expect(html).toContain('Hello SSR');
			expect(html).toContain('__EFFUSE_DATA__');
		});

		it('should skip static assets', async () => {
			const handler = createStreamingHandler({
				root: createRoot() as any,
				layers: [],
			});

			const response = await handler(
				new Request('http://localhost:3000/style.css')
			);
			expect(response.status).toBe(404);
		});

		it('should serve layer API routes before streaming SSR fallback', async () => {
			const ApiLayer = defineLayer({
				name: 'stream-api',
				server: {
					api: {
						'/api/stream': () => ({ ok: true }),
					},
				},
			});

			const handler = createStreamingHandler({
				root: createRoot() as any,
				layers: [ApiLayer],
			});

			const response = await handler(
				new Request('http://localhost:3000/api/stream')
			);

			expect(response.status).toBe(200);
			expect(response.headers.get('Content-Type')).toContain(
				'application/json'
			);
			expect(await response.json()).toEqual({ ok: true });
		});

		it('should report duplicate layer names through streaming onError', async () => {
			const onError = vi.fn();
			const FirstLayer = defineLayer({
				name: 'duplicate-stream',
			});
			const SecondLayer = defineLayer({
				name: 'duplicate-stream',
			});
			const handler = createStreamingHandler({
				root: createRootComponent(),
				layers: [FirstLayer, SecondLayer],
				onError,
			});

			const response = await handler(new Request('http://localhost:3000/'));

			expect(response.status).toBe(500);
			expect(onError).toHaveBeenCalledOnce();
			expect(onError.mock.calls[0][0]).toBeInstanceOf(LayerNameCollisionError);
			expect(String(onError.mock.calls[0][0])).toContain(
				'Layer "duplicate-stream" is registered more than once'
			);
		});
	});

	describe('concurrent safety', () => {
		it('should serialize concurrent renders without corruption', async () => {
			const results = await Promise.all([
				createHandler({
					root: createRoot() as any,
					layers: [],
				})(new Request('http://localhost:3000/a')),
				createHandler({
					root: createRoot() as any,
					layers: [],
				})(new Request('http://localhost:3000/b')),
			]);

			for (const response of results) {
				expect(response.status).toBe(200);
				const html = await response.text();
				expect(html).toContain('Hello SSR');
				expect(html).toContain('<!DOCTYPE html>');
			}
		});
	});

	describe('parseQuery', () => {
		it('should parse URL search params', () => {
			const url = new URL('http://localhost:3000/search?q=effuse&page=2');
			const query = parseQuery(url);

			expect(query).toEqual({ q: 'effuse', page: '2' });
		});

		it('should return empty object for no params', () => {
			const url = new URL('http://localhost:3000/');
			const query = parseQuery(url);

			expect(query).toEqual({});
		});
	});

	describe('error handling', () => {
		it('should call onError when createHandler throws', async () => {
			const onError = vi.fn();
			const handler = createHandler({
				root: createRoot() as any,
				layers: [],
				onError,
				transform: () => {
					throw new Error('transform failed');
				},
			});

			const request = new Request('http://localhost:3000/');
			const response = await handler(request);

			expect(response.status).toBe(500);
			expect(onError).toHaveBeenCalledOnce();
			expect(onError.mock.calls[0][0]).toBeInstanceOf(Error);
			expect(onError.mock.calls[0][0].message).toBe('transform failed');
			expect(onError.mock.calls[0][1]).toBeInstanceOf(Request);
		});

		it('should console.error when createHandler throws without onError', async () => {
			const consoleSpy = vi
				.spyOn(console, 'error')
				.mockImplementation(() => {});
			const handler = createHandler({
				root: createRoot() as any,
				layers: [],
				transform: () => {
					throw new Error('transform failed');
				},
			});

			const request = new Request('http://localhost:3000/');
			const response = await handler(request);

			expect(response.status).toBe(500);
			expect(consoleSpy).toHaveBeenCalledOnce();
			expect(consoleSpy.mock.calls[0][0]).toContain(
				'[effuse-ssr] Render error:'
			);
			expect(consoleSpy.mock.calls[0][1]).toBeInstanceOf(Error);

			consoleSpy.mockRestore();
		});

		it('should call onError when createStreamingHandler throws', async () => {
			const onError = vi.fn();
			const handler = createStreamingHandler({
				root: createRoot() as any,
				layers: [],
				onError,
				transform: () => {
					throw new Error('stream transform failed');
				},
			});

			const request = new Request('http://localhost:3000/');
			const response = await handler(request);

			expect(response.status).toBe(500);
			expect(onError).toHaveBeenCalledOnce();
			expect(onError.mock.calls[0][0]).toBeInstanceOf(Error);
			expect(onError.mock.calls[0][0].message).toBe('stream transform failed');
			expect(onError.mock.calls[0][1]).toBeInstanceOf(Request);
		});

		it('should console.error when createStreamingHandler throws without onError', async () => {
			const consoleSpy = vi
				.spyOn(console, 'error')
				.mockImplementation(() => {});
			const handler = createStreamingHandler({
				root: createRoot() as any,
				layers: [],
				transform: () => {
					throw new Error('stream transform failed');
				},
			});

			const request = new Request('http://localhost:3000/');
			const response = await handler(request);

			expect(response.status).toBe(500);
			expect(consoleSpy).toHaveBeenCalledOnce();
			expect(consoleSpy.mock.calls[0][0]).toContain(
				'[effuse-ssr] Streaming render error:'
			);
			expect(consoleSpy.mock.calls[0][1]).toBeInstanceOf(Error);

			consoleSpy.mockRestore();
		});
	});

	describe('createRequestContext', () => {
		it('should create context from request', () => {
			const request = new Request('http://localhost:3000/docs?lang=en');
			const ctx = createRequestContext(request, { slug: 'getting-started' });

			expect(ctx.request).toBe(request);
			expect(ctx.url.pathname).toBe('/docs');
			expect(ctx.params).toEqual({ slug: 'getting-started' });
			expect(ctx.query).toEqual({ lang: 'en' });
		});
	});
});
