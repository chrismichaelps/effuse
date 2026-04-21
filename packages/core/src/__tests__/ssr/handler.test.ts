import { describe, it, expect, afterEach } from 'vitest';
import { createHandler, parseQuery, createRequestContext } from '../../ssr/handler.js';
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
