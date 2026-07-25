import { describe, it, expect } from 'vitest';
import { defineServerMiddleware } from '../../ssr/middleware-definition.js';
import { compileServerMiddlewareGraph } from '../../ssr/middleware-graph.js';
import { runServerRequestPipeline } from '../../ssr/middleware-pipeline.js';
import type {
	ServerMiddlewareTarget,
	ServerRequestMiddleware,
} from '../../ssr/middleware-definition.js';
import type { ServerMiddlewareScope } from '../../ssr/middleware-graph.js';

/**
 * Conformance for the compiled middleware pipeline: the behaviours #301
 * requires across nested scopes, every target, streaming, concurrency, and
 * failure. These assert the contract an application depends on, independently
 * of the unit tests for each part.
 */

const url = (path: string) => `https://x.test${path}`;

interface Entry {
	readonly name: string;
	readonly scope?: ServerMiddlewareScope;
	readonly owner?: string;
	readonly paths?: string;
	readonly targets?: ServerMiddlewareTarget;
	readonly handler: ServerRequestMiddleware;
}

const graphOf = (entries: readonly Entry[]) =>
	compileServerMiddlewareGraph(
		entries.map((entry) => {
			const scope = entry.scope ?? 'global';
			const middleware = defineServerMiddleware({
				name: entry.name,
				phase: 'request',
				...(entry.paths || entry.targets
					? {
							match: {
								...(entry.paths ? { paths: entry.paths } : {}),
								...(entry.targets ? { targets: entry.targets } : {}),
							},
						}
					: {}),
				handler: entry.handler,
			});
			return scope === 'layer'
				? { scope, owner: entry.owner ?? 'auth', middleware }
				: { scope, middleware };
		})
	);

const passThrough =
	(record: string[], name: string): ServerRequestMiddleware =>
	async (_ctx, next) => {
		record.push(name);
		return next();
	};

describe('middleware conformance: nested scopes', () => {
	it('runs every scope in onion order for one request', async () => {
		const order: string[] = [];
		const graph = graphOf([
			{ name: 'engine', scope: 'engine', handler: passThrough(order, 'engine') },
			{ name: 'global', scope: 'global', handler: passThrough(order, 'global') },
			{
				name: 'layer',
				scope: 'layer',
				owner: 'auth',
				handler: passThrough(order, 'layer'),
			},
			{ name: 'route', scope: 'route', handler: passThrough(order, 'route') },
		]);

		await runServerRequestPipeline(graph, {
			request: new Request(url('/api/a')),
			target: 'api',
			resolve: () => {
				order.push('handler');
				return { ok: true };
			},
		});

		expect(order).toEqual(['engine', 'global', 'layer', 'route', 'handler']);
	});
});

describe('middleware conformance: targets', () => {
	it.each<ServerMiddlewareTarget>(['api', 'action', 'page'])(
		'dispatches for the %s target',
		async (target) => {
			const seen: string[] = [];
			const graph = graphOf([
				{ name: `mw-${target}`, targets: target, handler: passThrough(seen, target) },
			]);

			await runServerRequestPipeline(graph, {
				request: new Request(url('/x')),
				target,
				resolve: () => ({ ok: true }),
			});

			expect(seen).toEqual([target]);
		}
	);

	it('excludes static assets by default', async () => {
		const seen: string[] = [];
		const graph = graphOf([
			{ name: 'default-targets', handler: passThrough(seen, 'ran') },
		]);

		await runServerRequestPipeline(graph, {
			request: new Request(url('/logo.png')),
			target: 'asset',
			resolve: () => ({ ok: true }),
		});

		// Assets are opt-in so middleware cannot accidentally intercept caching.
		expect(seen).toEqual([]);
	});
});

describe('middleware conformance: concurrency isolation', () => {
	it('keeps locals isolated across interleaved concurrent requests', async () => {
		const observed: string[] = [];
		const graph = graphOf([
			{
				name: 'tag-request',
				handler: async (ctx, next) => {
					const id = new URL(ctx.request.url).searchParams.get('id') ?? '';
					ctx.locals['requestId'] = id;
					// Force interleaving so a shared store would be observed.
					await new Promise((resolve) => setTimeout(resolve, 0));
					observed.push(`${id}:${String(ctx.locals['requestId'])}`);
					return next();
				},
			},
		]);

		await Promise.all(
			['a', 'b', 'c', 'd'].map((id) =>
				runServerRequestPipeline(graph, {
					request: new Request(url(`/api/x?id=${id}`)),
					target: 'api',
					resolve: () => ({ ok: true }),
				})
			)
		);

		// Every request must observe only its own value.
		expect(observed.sort()).toEqual(['a:a', 'b:b', 'c:c', 'd:d']);
	});

	it('does not leak a rewritten path between concurrent requests', async () => {
		const resolved: string[] = [];
		const graph = graphOf([
			{
				name: 'rewrite-odd',
				paths: '/odd',
				handler: async (_ctx, next) => next(new Request(url('/even'))),
			},
		]);

		await Promise.all([
			runServerRequestPipeline(graph, {
				request: new Request(url('/odd')),
				target: 'api',
				resolve: (request) => {
					resolved.push(new URL(request.url).pathname);
					return { ok: true };
				},
			}),
			runServerRequestPipeline(graph, {
				request: new Request(url('/plain')),
				target: 'api',
				resolve: (request) => {
					resolved.push(new URL(request.url).pathname);
					return { ok: true };
				},
			}),
		]);

		expect(resolved.sort()).toEqual(['/even', '/plain']);
	});
});

describe('middleware conformance: failures', () => {
	it('propagates a middleware failure without running the handler', async () => {
		let handlerRan = false;
		const graph = graphOf([
			{
				name: 'boom',
				handler: () => {
					throw new Error('middleware failed');
				},
			},
		]);

		await expect(
			runServerRequestPipeline(graph, {
				request: new Request(url('/api/a')),
				target: 'api',
				resolve: () => {
					handlerRan = true;
					return { ok: true };
				},
			})
		).rejects.toThrow('middleware failed');

		expect(handlerRan).toBe(false);
	});

	it('runs deferred cleanup exactly once when the handler throws', async () => {
		const disposed: string[] = [];
		const graph = graphOf([
			{
				name: 'cleanup',
				handler: async (ctx, next) => {
					ctx.defer(() => {
						disposed.push('done');
					});
					return next();
				},
			},
		]);

		await expect(
			runServerRequestPipeline(graph, {
				request: new Request(url('/api/a')),
				target: 'api',
				resolve: () => {
					throw new Error('handler failed');
				},
			})
		).rejects.toThrow('handler failed');

		expect(disposed).toEqual(['done']);
	});
});

describe('middleware conformance: streaming', () => {
	it('passes a streamed response through the chain intact', async () => {
		const graph = graphOf([
			{ name: 'observe', handler: async (_ctx, next) => next() },
		]);

		const response = await runServerRequestPipeline(graph, {
			request: new Request(url('/api/stream')),
			target: 'api',
			resolve: () =>
				new Response(
					new ReadableStream<Uint8Array>({
						start(controller) {
							controller.enqueue(new TextEncoder().encode('chunk-a|'));
							controller.enqueue(new TextEncoder().encode('chunk-b'));
							controller.close();
						},
					}),
					{ headers: { 'Content-Type': 'application/octet-stream' } }
				),
		});

		expect(response.headers.get('Content-Type')).toBe(
			'application/octet-stream'
		);
		expect(await response.text()).toBe('chunk-a|chunk-b');
	});
});

describe('middleware conformance: selection cost', () => {
	it('does not run middleware whose match excludes the request', async () => {
		const ran: string[] = [];
		const graph = graphOf([
			{ name: 'other-path', paths: '/other', handler: passThrough(ran, 'other') },
			{ name: 'this-path', paths: '/api/a', handler: passThrough(ran, 'this') },
		]);

		await runServerRequestPipeline(graph, {
			request: new Request(url('/api/a')),
			target: 'api',
			resolve: () => ({ ok: true }),
		});

		// A route mismatch must not execute the entry at all.
		expect(ran).toEqual(['this']);
	});
});
