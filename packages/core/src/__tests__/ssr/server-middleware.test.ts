/**
 * MIT License
 *
 * Copyright (c) 2025 Chris M. Perez
 */

import { describe, it, expect, vi, afterEach } from 'vitest';
import { createHandler } from '../../ssr/handler.js';
import { defineLayer } from '../../layers/api/defineLayer.js';
import { clearGlobalLayerContext } from '../../layers/context.js';
import { clearGlobalTracing } from '../../layers/tracing/index.js';
import { CreateTextNode } from '../../render/node.js';
import { EFFUSE_NODE } from '../../constants.js';
import type {
	ServerLayerContext,
	ServerMiddleware,
} from '../../layers/types.js';

afterEach(() => {
	clearGlobalLayerContext();
	clearGlobalTracing();
});

const createRoot = () =>
	CreateTextNode({ [EFFUSE_NODE]: true, text: 'middleware root' });

type AnyLayer = ReturnType<typeof defineLayer>;

// Types an inline middleware so its `ctx` is not narrowed to a no-service layer.
const mw = (middleware: ServerMiddleware): ServerMiddleware => middleware;

const fetchOf = (
	layer: AnyLayer,
	onError?: (error: unknown) => void
): ((path: string, init?: RequestInit) => Promise<Response>) => {
	const handler = createHandler({
		root: createRoot() as never,
		layers: [layer],
		...(onError ? { onError } : {}),
	});
	return (path, init) =>
		handler(new Request(`http://localhost:3000${path}`, init));
};

describe('server middleware semantics', () => {
	it('runs layer then route middleware in order and unwinds in reverse', async () => {
		const log: string[] = [];
		const trace =
			(name: string): ServerMiddleware =>
			async (_ctx, next) => {
				log.push(`enter:${name}`);
				const response = await next();
				log.push(`exit:${name}`);
				return response;
			};

		const Layer = defineLayer({
			name: 'mw-order',
			server: {
				middleware: [trace('L1'), trace('L2')],
				api: {
					'/api/x': {
						middleware: [trace('R1')],
						handler: () => {
							log.push('handler');
							return { ok: true };
						},
					},
				},
			},
		});

		const response = await fetchOf(Layer)('/api/x');

		expect(await response.json()).toEqual({ ok: true });
		expect(log).toEqual([
			'enter:L1',
			'enter:L2',
			'enter:R1',
			'handler',
			'exit:R1',
			'exit:L2',
			'exit:L1',
		]);
	});

	it('propagates the handler response when middleware returns nothing after next()', async () => {
		const Layer = defineLayer({
			name: 'mw-passthrough',
			server: {
				middleware: [
					mw(async (_ctx, next) => {
						await next();
						// Intentionally returns nothing — the common side-effect shape.
					}),
				],
				api: {
					'/api/x': () => ({ value: 42 }),
				},
			},
		});

		const response = await fetchOf(Layer)('/api/x');

		expect(response.status).toBe(200);
		expect(await response.json()).toEqual({ value: 42 });
	});

	it('short-circuits without invoking the handler when middleware returns a response', async () => {
		const handler = vi.fn(() => ({ ok: true }));
		const Layer = defineLayer({
			name: 'mw-short-circuit',
			server: {
				middleware: [() => Response.json({ blocked: true }, { status: 401 })],
				api: {
					'/api/x': handler,
				},
			},
		});

		const response = await fetchOf(Layer)('/api/x');

		expect(response.status).toBe(401);
		expect(await response.json()).toEqual({ blocked: true });
		expect(handler).not.toHaveBeenCalled();
	});

	it('lets middleware override the downstream response after next()', async () => {
		const Layer = defineLayer({
			name: 'mw-override',
			server: {
				middleware: [
					mw(async (_ctx, next) => {
						await next();
						return Response.json({ overridden: true });
					}),
				],
				api: {
					'/api/x': () => ({ original: true }),
				},
			},
		});

		const response = await fetchOf(Layer)('/api/x');

		expect(await response.json()).toEqual({ overridden: true });
	});

	it('propagates an error thrown before next() and skips the handler', async () => {
		const handler = vi.fn(() => ({ ok: true }));
		const onError = vi.fn();
		const Layer = defineLayer({
			name: 'mw-error-before',
			server: {
				middleware: [
					() => {
						throw new Error('mw failed');
					},
				],
				api: {
					'/api/x': handler,
				},
			},
		});

		const response = await fetchOf(Layer, onError)('/api/x');

		expect(response.status).toBe(500);
		expect(handler).not.toHaveBeenCalled();
		expect(onError).toHaveBeenCalledWith(expect.any(Error), expect.anything());
	});

	it('propagates an error thrown after next() even though the handler ran', async () => {
		const handler = vi.fn(() => ({ ok: true }));
		const onError = vi.fn();
		const Layer = defineLayer({
			name: 'mw-error-after',
			server: {
				middleware: [
					mw(async (_ctx, next) => {
						await next();
						throw new Error('post-processing failed');
					}),
				],
				api: {
					'/api/x': handler,
				},
			},
		});

		const response = await fetchOf(Layer, onError)('/api/x');

		expect(response.status).toBe(500);
		expect(handler).toHaveBeenCalledOnce();
		expect(onError).toHaveBeenCalledWith(expect.any(Error), expect.anything());
	});

	it('throws when a middleware calls next() more than once', async () => {
		const onError = vi.fn();
		const Layer = defineLayer({
			name: 'mw-double-next',
			server: {
				middleware: [
					mw(async (_ctx, next) => {
						await next();
						return next();
					}),
				],
				api: {
					'/api/x': () => ({ ok: true }),
				},
			},
		});

		const response = await fetchOf(Layer, onError)('/api/x');

		expect(response.status).toBe(500);
		expect(onError).toHaveBeenCalledWith(
			expect.objectContaining({
				message: 'Effuse server middleware called next() more than once.',
			}),
			expect.anything()
		);
	});

	it('shares the request scope between middleware and the handler', async () => {
		const Layer = defineLayer({
			name: 'mw-scope',
			server: {
				middleware: [
					mw((ctx, next) => {
						ctx.locals.tenant = 'acme';
						return next();
					}),
				],
				api: {
					'/api/x': (ctx: ServerLayerContext) => ({
						tenant: ctx.locals.tenant,
					}),
				},
			},
		});

		const response = await fetchOf(Layer)('/api/x');

		expect(await response.json()).toEqual({ tenant: 'acme' });
	});
});
