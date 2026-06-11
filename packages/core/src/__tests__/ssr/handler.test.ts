import { describe, it, expect, afterEach, vi } from 'vitest';
import {
	createHandler,
	createStreamingHandler,
	parseQuery,
	createRequestContext,
} from '../../ssr/handler.js';
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
	CreateTextNode({ [EFFUSE_NODE]: true, text: 'Hello SSR' });

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
					middleware: [
						() => new Response('Unauthorized', { status: 401 }),
					],
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
