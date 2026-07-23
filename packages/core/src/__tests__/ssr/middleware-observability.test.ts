import { describe, it, expect } from 'vitest';
import { defineServerMiddleware } from '../../ssr/middleware-definition.js';
import { compileServerMiddlewareGraph } from '../../ssr/middleware-graph.js';
import { runServerRequestPipeline } from '../../ssr/middleware-pipeline.js';
import type { ServerMiddlewareTrace } from '../../ssr/middleware-pipeline.js';
import type { ServerRequestMiddleware } from '../../ssr/middleware-definition.js';

const url = (path: string) => `https://x.test${path}`;

const graphOf = (
	entries: readonly {
		name: string;
		scope?: 'engine' | 'global' | 'layer' | 'route';
		owner?: string;
		handler: ServerRequestMiddleware;
	}[]
) =>
	compileServerMiddlewareGraph(
		entries.map((entry) => {
			const scope = entry.scope ?? 'global';
			const middleware = defineServerMiddleware({
				name: entry.name,
				phase: 'request',
				handler: entry.handler,
			});
			return scope === 'layer'
				? { scope, owner: entry.owner ?? 'auth', middleware }
				: { scope, middleware };
		})
	);

describe('middleware observability', () => {
	it('traces each middleware with name, scope, owner, and target', async () => {
		const traces: ServerMiddlewareTrace[] = [];
		const graph = graphOf([
			{ name: 'security', scope: 'engine', handler: async (_c, n) => n() },
			{
				name: 'session',
				scope: 'layer',
				owner: 'auth',
				handler: async (_c, n) => n(),
			},
		]);

		await runServerRequestPipeline(graph, {
			request: new Request(url('/api/a')),
			target: 'api',
			resolve: () => ({ ok: true }),
			onTrace: (trace) => traces.push(trace),
		});

		// Spans close inner-first as the onion unwinds, so the innermost
		// middleware reports before the outer one that wraps it.
		expect(traces.map((t) => [t.name, t.scope, t.owner, t.target])).toEqual([
			['session', 'layer', 'auth', 'api'],
			['security', 'engine', undefined, 'api'],
		]);
	});

	it('records a non-negative duration for each middleware', async () => {
		const traces: ServerMiddlewareTrace[] = [];
		const graph = graphOf([
			{ name: 'slow', handler: async (_c, n) => n() },
		]);

		await runServerRequestPipeline(graph, {
			request: new Request(url('/api/a')),
			target: 'api',
			resolve: () => ({ ok: true }),
			onTrace: (trace) => traces.push(trace),
		});

		expect(traces).toHaveLength(1);
		expect(traces[0]?.durationMs).toBeGreaterThanOrEqual(0);
		expect(Number.isFinite(traces[0]?.durationMs)).toBe(true);
	});

	it('marks the middleware that failed and still reports its identity', async () => {
		const traces: ServerMiddlewareTrace[] = [];
		const graph = graphOf([
			{ name: 'ok', handler: async (_c, n) => n() },
			{
				name: 'boom',
				handler: () => {
					throw new Error('secret-token-abc123 leaked internals');
				},
			},
		]);

		await expect(
			runServerRequestPipeline(graph, {
				request: new Request(url('/api/a')),
				target: 'api',
				resolve: () => ({ ok: true }),
				onTrace: (trace) => traces.push(trace),
			})
		).rejects.toThrow('secret-token-abc123 leaked internals');

		const failed = traces.find((t) => t.name === 'boom');
		expect(failed?.failed).toBe(true);
		// The trace identifies the owner without embedding the error message.
		expect(JSON.stringify(failed)).not.toContain('secret-token-abc123');
	});

	it('does not trace middleware that was never selected', async () => {
		const traces: ServerMiddlewareTrace[] = [];
		const graph = compileServerMiddlewareGraph([
			{
				scope: 'route',
				middleware: defineServerMiddleware({
					name: 'other-path',
					phase: 'request',
					match: { paths: '/other' },
					handler: async (_c, n) => n(),
				}),
			},
		]);

		await runServerRequestPipeline(graph, {
			request: new Request(url('/api/a')),
			target: 'api',
			resolve: () => ({ ok: true }),
			onTrace: (trace) => traces.push(trace),
		});

		expect(traces).toEqual([]);
	});

	it('marks traces from a rewritten pass with the new path', async () => {
		const traces: ServerMiddlewareTrace[] = [];
		const graph = compileServerMiddlewareGraph([
			{
				scope: 'route',
				middleware: defineServerMiddleware({
					name: 'rewriter',
					phase: 'request',
					match: { paths: '/old' },
					handler: async (_c, next) => next(new Request(url('/new'))),
				}),
			},
			{
				scope: 'route',
				middleware: defineServerMiddleware({
					name: 'new-guard',
					phase: 'request',
					match: { paths: '/new' },
					handler: async (_c, n) => n(),
				}),
			},
		]);

		await runServerRequestPipeline(graph, {
			request: new Request(url('/old')),
			target: 'api',
			resolve: () => ({ ok: true }),
			onTrace: (trace) => traces.push(trace),
		});

		expect(traces.map((t) => [t.name, t.pathname])).toEqual([
			['rewriter', '/old'],
			['new-guard', '/new'],
		]);
	});
});
