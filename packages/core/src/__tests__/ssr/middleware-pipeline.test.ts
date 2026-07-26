import { describe, it, expect } from 'vitest';
import { defineServerMiddleware } from '../../ssr/middleware-definition.js';
import { compileServerMiddlewareGraph } from '../../ssr/middleware-graph.js';
import { runServerRequestPipeline } from '../../ssr/middleware-pipeline.js';
import type { ServerRequestMiddleware } from '../../ssr/middleware-definition.js';

const url = (path: string) => `https://x.test${path}`;

const graphOf = (
	entries: readonly {
		name: string;
		paths?: string;
		handler: ServerRequestMiddleware;
	}[]
) =>
	compileServerMiddlewareGraph(
		entries.map((entry) => ({
			scope: 'route' as const,
			middleware: defineServerMiddleware({
				name: entry.name,
				phase: 'request',
				...(entry.paths ? { match: { paths: entry.paths } } : {}),
				handler: entry.handler,
			}),
		}))
	);

describe('runServerRequestPipeline', () => {
	it('runs the chain and terminal for a non-rewritten request', async () => {
		const graph = graphOf([
			{ name: 'pass', handler: async (_ctx, next) => next() },
		]);

		const response = await runServerRequestPipeline(graph, {
			request: new Request(url('/api/a')),
			target: 'api',
			resolve: (request) => ({ path: new URL(request.url).pathname }),
		});

		expect(await response.json()).toEqual({ path: '/api/a' });
	});

	it('re-selects middleware for a rewritten path', async () => {
		const seen: string[] = [];
		const graph = graphOf([
			{
				name: 'rewriter',
				paths: '/old',
				handler: async (ctx, next) => {
					seen.push('rewriter');
					return next(new Request(url('/new')));
				},
			},
			{
				name: 'new-guard',
				paths: '/new',
				handler: async (_ctx, next) => {
					seen.push('new-guard');
					return next();
				},
			},
		]);

		const response = await runServerRequestPipeline(graph, {
			request: new Request(url('/old')),
			target: 'api',
			resolve: (request) => ({ path: new URL(request.url).pathname }),
		});

		// The guard owning the rewritten path must run; a rewrite cannot skip it.
		expect(seen).toEqual(['rewriter', 'new-guard']);
		expect(await response.json()).toEqual({ path: '/new' });
	});

	it('rejects a rewrite chain that exceeds the bound', async () => {
		let counter = 0;
		const graph = graphOf([
			{
				name: 'looper',
				handler: async (_ctx, next) => {
					counter += 1;
					return next(new Request(url(`/loop-${String(counter)}`)));
				},
			},
		]);

		await expect(
			runServerRequestPipeline(graph, {
				request: new Request(url('/start')),
				target: 'api',
				maxRewrites: 3,
				resolve: () => ({ ok: true }),
			})
		).rejects.toThrow(/rewrite/i);
	});

	it('detects a cyclic rewrite before exhausting the bound', async () => {
		const graph = graphOf([
			{
				name: 'a-to-b',
				paths: '/a',
				handler: async (_ctx, next) => next(new Request(url('/b'))),
			},
			{
				name: 'b-to-a',
				paths: '/b',
				handler: async (_ctx, next) => next(new Request(url('/a'))),
			},
		]);

		await expect(
			runServerRequestPipeline(graph, {
				request: new Request(url('/a')),
				target: 'api',
				resolve: () => ({ ok: true }),
			})
		).rejects.toThrow(/cyclic/i);
	});

	it('does not treat a same-path request replacement as a rewrite', async () => {
		let terminalCalls = 0;
		const graph = graphOf([
			{
				name: 'headers-only',
				handler: async (ctx, next) => {
					const headers = new Headers(ctx.request.headers);
					headers.set('x-tag', '1');
					return next(new Request(ctx.request, { headers }));
				},
			},
		]);

		await runServerRequestPipeline(graph, {
			request: new Request(url('/api/a')),
			target: 'api',
			resolve: (request) => {
				terminalCalls += 1;
				return { tag: request.headers.get('x-tag') };
			},
		});

		expect(terminalCalls).toBe(1);
	});

	it('short-circuits without reaching the terminal', async () => {
		let terminalCalls = 0;
		const graph = graphOf([
			{ name: 'deny', handler: () => new Response('no', { status: 403 }) },
		]);

		const response = await runServerRequestPipeline(graph, {
			request: new Request(url('/api/a')),
			target: 'api',
			resolve: () => {
				terminalCalls += 1;
				return { ok: true };
			},
		});

		expect(response.status).toBe(403);
		expect(terminalCalls).toBe(0);
	});
});
