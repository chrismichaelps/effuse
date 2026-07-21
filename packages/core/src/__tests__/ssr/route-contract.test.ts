import { describe, it, expect, afterEach } from 'vitest';
import { createHandler } from '../../ssr/handler.js';
import { defineLayer } from '../../layers/api/defineLayer.js';
import { clearGlobalLayerContext } from '../../layers/context.js';
import { clearGlobalTracing } from '../../layers/tracing/index.js';
import { CreateTextNode } from '../../render/node.js';
import { EFFUSE_NODE } from '../../constants.js';
import { defineServerRequest } from '../../ssr/request-contract.js';
import { defineServerRoute } from '../../ssr/route-contract.js';
import { serverSchema } from '../../ssr/server-schema.js';

afterEach(() => {
	clearGlobalLayerContext();
	clearGlobalTracing();
});

const createRoot = () =>
	CreateTextNode({ [EFFUSE_NODE]: true, text: 'Hello SSR' });

const handlerFor = (layer: ReturnType<typeof defineLayer>) =>
	createHandler({ root: createRoot() as never, layers: [layer] });

describe('route request contracts', () => {
	it('exposes decoded contract output to the handler as ctx.input', async () => {
		const route = defineServerRoute({
			path: '/api/search',
			request: defineServerRequest({
				query: serverSchema.object({
					limit: serverSchema.numberFromString,
				}),
			}),
			GET: (ctx) => ({ limit: ctx.input.query.limit }),
		});
		const handler = handlerFor(
			defineLayer({ name: 'search', server: { routes: [route] } })
		);

		const response = await handler(
			new Request('http://localhost:3000/api/search?limit=3')
		);

		expect(response.status).toBe(200);
		// Decoded to a number, not the raw "3" string.
		expect(await response.json()).toEqual({ limit: 3 });
	});

	it('decodes params and json body together', async () => {
		const route = defineServerRoute({
			path: '/api/users/:id',
			request: defineServerRequest({
				params: serverSchema.object({
					id: serverSchema.numberFromString,
				}),
				json: serverSchema.object({ name: serverSchema.string }),
			}),
			POST: (ctx) => ({ id: ctx.input.params.id, name: ctx.input.json.name }),
		});
		const handler = handlerFor(
			defineLayer({ name: 'users', server: { routes: [route] } })
		);

		const response = await handler(
			new Request('http://localhost:3000/api/users/42', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ name: 'ada' }),
			})
		);

		expect(await response.json()).toEqual({ id: 42, name: 'ada' });
	});

	it('short-circuits invalid input with a stable validation response', async () => {
		let handlerRan = false;
		const route = defineServerRoute({
			path: '/api/strict',
			request: defineServerRequest({
				query: serverSchema.object({
					limit: serverSchema.numberFromString,
				}),
			}),
			GET: () => {
				handlerRan = true;
				return { ok: true };
			},
		});
		const handler = handlerFor(
			defineLayer({ name: 'strict', server: { routes: [route] } })
		);

		const response = await handler(
			new Request('http://localhost:3000/api/strict?limit=not-a-number')
		);

		expect(response.status).toBe(400);
		expect(handlerRan).toBe(false);
		const body = (await response.json()) as { error?: unknown };
		expect(body.error).toBeDefined();
		// The failure names the offending field and leaks no internals.
		expect(JSON.stringify(body)).toContain('limit');
		expect(JSON.stringify(body)).not.toContain('at Object');
	});

	it('runs middleware before the contract parses', async () => {
		const order: string[] = [];
		const route = defineServerRoute({
			path: '/api/ordered',
			request: defineServerRequest({
				query: serverSchema.object({
					limit: serverSchema.numberFromString,
				}),
			}),
			GET: () => {
				order.push('handler');
				return { ok: true };
			},
		});
		const handler = handlerFor(
			defineLayer({
				name: 'ordered',
				server: {
					middleware: [
						async (_ctx, next) => {
							order.push('middleware');
							return next();
						},
					],
					routes: [route],
				},
			})
		);

		// Invalid input: middleware must still have run before validation rejected it.
		const response = await handler(
			new Request('http://localhost:3000/api/ordered?limit=nope')
		);

		expect(response.status).toBe(400);
		expect(order).toEqual(['middleware']);
	});

	it('leaves routes without a contract untouched', async () => {
		const handler = handlerFor(
			defineLayer({
				name: 'plain',
				server: {
					api: {
						'/api/plain': { GET: (ctx) => ({ raw: ctx.query.limit }) },
					},
				},
			})
		);

		const response = await handler(
			new Request('http://localhost:3000/api/plain?limit=7')
		);

		expect(await response.json()).toEqual({ raw: '7' });
	});
});

describe('route response contracts', () => {
	const okRoute = (handler: () => Record<string, unknown> | Response) =>
		defineServerRoute({
			path: '/api/report',
			request: defineServerRequest({}),
			response: serverSchema.object({ total: serverSchema.number }),
			GET: handler,
		});

	it('passes through a result that satisfies the response contract', async () => {
		const handler = handlerFor(
			defineLayer({
				name: 'report-ok',
				server: { routes: [okRoute(() => ({ total: 7 }))] },
			})
		);

		const response = await handler(
			new Request('http://localhost:3000/api/report')
		);

		expect(response.status).toBe(200);
		expect(await response.json()).toEqual({ total: 7 });
	});

	it('fails closed with a 500 when the handler breaks its own contract', async () => {
		const handler = handlerFor(
			defineLayer({
				name: 'report-bad',
				// `total` is a string: a server-side bug, not a client error.
				server: { routes: [okRoute(() => ({ total: 'lots', secret: 'hunter2' }))] },
			})
		);

		const response = await handler(
			new Request('http://localhost:3000/api/report')
		);

		expect(response.status).toBe(500);
		const raw = await response.text();
		expect(raw).toContain('server_response_contract');
		// Reports the offending path...
		expect(raw).toContain('total');
		// ...but redacts the rejected values. Validator messages embed the actual
		// value, which for a response contract is server-side data.
		expect(raw).not.toContain('lots');
		expect(raw).not.toContain('hunter2');
	});

	it('leaves a handler-returned Response alone', async () => {
		const route = defineServerRoute({
			path: '/api/raw',
			request: defineServerRequest({}),
			response: serverSchema.object({ total: serverSchema.number }),
			GET: () => new Response('plain', { status: 202 }),
		});
		const handler = handlerFor(
			defineLayer({ name: 'raw', server: { routes: [route] } })
		);

		const response = await handler(
			new Request('http://localhost:3000/api/raw')
		);

		expect(response.status).toBe(202);
		expect(await response.text()).toBe('plain');
	});
});
