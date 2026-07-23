import { describe, it, expect } from 'vitest';
import { defineServerMiddleware } from '../../ssr/middleware-definition.js';
import { compileServerMiddlewareGraph } from '../../ssr/middleware-graph.js';
import { runServerRequestPipeline } from '../../ssr/middleware-pipeline.js';
import { isReservedServerPath } from '../../ssr/middleware-graph.js';

const url = (path: string) => `https://x.test${path}`;
const noop = () => undefined;

describe('isReservedServerPath', () => {
	it('recognizes the framework-internal namespace', () => {
		expect(isReservedServerPath('/_effuse/actions/save')).toBe(true);
		expect(isReservedServerPath('/_effuse/')).toBe(true);
		expect(isReservedServerPath('/_effuse')).toBe(true);
	});

	it('does not reserve ordinary application paths', () => {
		expect(isReservedServerPath('/api/users')).toBe(false);
		expect(isReservedServerPath('/')).toBe(false);
		// A path that merely starts with the same characters is not reserved.
		expect(isReservedServerPath('/_effusive/thing')).toBe(false);
	});
});

describe('reserved path policy at compile time', () => {
	it('rejects application-scoped middleware claiming a reserved path', () => {
		for (const scope of ['global', 'route'] as const) {
			expect(() =>
				compileServerMiddlewareGraph([
					{
						scope,
						middleware: defineServerMiddleware({
							name: `claim-${scope}`,
							phase: 'request',
							match: { paths: '/_effuse/actions/[...rest]' },
							handler: noop,
						}),
					},
				])
			).toThrow(/reserved/i);
		}
	});

	it('rejects layer-scoped middleware claiming a reserved path', () => {
		expect(() =>
			compileServerMiddlewareGraph([
				{
					scope: 'layer',
					owner: 'auth',
					middleware: defineServerMiddleware({
						name: 'claim-layer',
						phase: 'request',
						match: { paths: '/_effuse/x' },
						handler: noop,
					}),
				},
			])
		).toThrow(/reserved/i);
	});

	it('allows engine-scoped middleware to own reserved paths', () => {
		const graph = compileServerMiddlewareGraph([
			{
				scope: 'engine',
				middleware: defineServerMiddleware({
					name: 'actions',
					phase: 'request',
					match: { paths: '/_effuse/actions/[...rest]' },
					handler: noop,
				}),
			},
		]);

		expect(graph.entries.map((entry) => entry.name)).toEqual(['actions']);
	});

	it('allows wildcard matches that merely cover reserved paths', () => {
		// The default '/*' match must keep working; only an explicit claim fails.
		const graph = compileServerMiddlewareGraph([
			{
				scope: 'global',
				middleware: defineServerMiddleware({
					name: 'catch-all',
					phase: 'request',
					handler: noop,
				}),
			},
		]);

		expect(graph.entries).toHaveLength(1);
	});
});

describe('reserved path policy at rewrite time', () => {
	it('rejects a rewrite that targets a reserved path', async () => {
		const graph = compileServerMiddlewareGraph([
			{
				scope: 'route',
				middleware: defineServerMiddleware({
					name: 'escalate',
					phase: 'request',
					handler: async (_ctx, next) =>
						next(new Request(url('/_effuse/actions/danger'))),
				}),
			},
		]);

		await expect(
			runServerRequestPipeline(graph, {
				request: new Request(url('/api/a')),
				target: 'api',
				resolve: () => ({ ok: true }),
			})
		).rejects.toThrow(/reserved/i);
	});

	it('allows a rewrite to an ordinary path', async () => {
		const graph = compileServerMiddlewareGraph([
			{
				scope: 'route',
				middleware: defineServerMiddleware({
					name: 'rewrite',
					phase: 'request',
					match: { paths: '/old' },
					handler: async (_ctx, next) => next(new Request(url('/new'))),
				}),
			},
		]);

		const response = await runServerRequestPipeline(graph, {
			request: new Request(url('/old')),
			target: 'api',
			resolve: (request) => ({ path: new URL(request.url).pathname }),
		});

		expect(await response.json()).toEqual({ path: '/new' });
	});

	it('still serves a request that starts on a reserved path', async () => {
		const graph = compileServerMiddlewareGraph([]);

		const response = await runServerRequestPipeline(graph, {
			request: new Request(url('/_effuse/actions/save')),
			target: 'action',
			resolve: () => ({ ok: true }),
		});

		expect(await response.json()).toEqual({ ok: true });
	});
});
