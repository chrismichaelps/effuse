import { describe, it, expect, vi, afterEach } from 'vitest';
import { defineLayer } from '../../layers/api/defineLayer.js';
import { clearGlobalLayerContext } from '../../layers/context.js';
import { clearGlobalTracing } from '../../layers/tracing/index.js';
import { defineServerRequest } from '../../ssr/request-contract.js';
import { defineServerRoute } from '../../ssr/route-contract.js';
import { serverSchema } from '../../ssr/server-schema.js';
import { createTypedRouteClient } from '../../ssr/typed-route-client.js';
import { createInProcessRouteFetch } from '../../ssr/in-process-route-client.js';
import { LayerServerClientError } from '../../ssr/client.js';

afterEach(() => {
	clearGlobalLayerContext();
	clearGlobalTracing();
});

const searchRoute = defineServerRoute({
	path: '/api/search',
	request: defineServerRequest({
		query: serverSchema.object({ limit: serverSchema.numberFromString }),
	}),
	response: serverSchema.object({ total: serverSchema.number }),
	GET: (ctx) => ({ total: ctx.input.query.limit }),
});

describe('createInProcessRouteFetch', () => {
	it('dispatches a typed client call through the real pipeline with no HTTP round-trip', async () => {
		const layers = [
			defineLayer({ name: 'search', server: { routes: [searchRoute] } }),
		];
		// A spy on the global fetch proves no network transport is used.
		const networkFetch = vi.spyOn(globalThis, 'fetch');

		const client = createTypedRouteClient(
			{ search: searchRoute },
			{
				baseUrl: 'http://ssr.local',
				fetch: createInProcessRouteFetch(layers),
			}
		);

		const result = await client.search({ query: { limit: '3' } });

		// Decoded by the route's request contract (number, not "3") and typed as
		// { total: number } by its response contract — end to end, in process.
		const total: number = result.total;
		expect(total).toBe(3);
		expect(networkFetch).not.toHaveBeenCalled();
		networkFetch.mockRestore();
	});

	it('preserves middleware and auth semantics on a direct call', async () => {
		const handlerSpy = vi.fn(() => ({ ok: true }));
		const secureRoute = defineServerRoute({
			path: '/api/secure',
			middleware: [
				(ctx, next) =>
					ctx.request.headers.get('x-key') === 'let-me-in'
						? next()
						: new Response('nope', { status: 401 }),
			],
			request: defineServerRequest({}),
			response: serverSchema.object({ ok: serverSchema.boolean }),
			GET: handlerSpy,
		});
		const layers = [
			defineLayer({ name: 'secure', server: { routes: [secureRoute] } }),
		];
		const client = createTypedRouteClient(
			{ secure: secureRoute },
			{ baseUrl: 'http://ssr.local', fetch: createInProcessRouteFetch(layers) }
		);

		// Missing header: middleware short-circuits, handler never runs.
		await expect(client.secure()).rejects.toBeInstanceOf(
			LayerServerClientError
		);
		expect(handlerSpy).not.toHaveBeenCalled();

		// With the header, the same middleware lets it through.
		const ok = await client.secure(undefined, {
			headers: { 'x-key': 'let-me-in' },
		});
		expect(ok).toEqual({ ok: true });
		expect(handlerSpy).toHaveBeenCalledTimes(1);
	});

	it('short-circuits invalid input through the stable validation response', async () => {
		const layers = [
			defineLayer({ name: 'search', server: { routes: [searchRoute] } }),
		];
		const client = createTypedRouteClient(
			{ search: searchRoute },
			{ baseUrl: 'http://ssr.local', fetch: createInProcessRouteFetch(layers) }
		);

		// `limit` fails numberFromString decoding; the contract rejects it with a
		// 4xx before the handler runs, surfaced to the caller as a client error.
		await expect(
			client.search({ query: { limit: 'not-a-number' } })
		).rejects.toBeInstanceOf(LayerServerClientError);
	});

	it('returns a 404 when no route matches', async () => {
		const layers = [
			defineLayer({ name: 'search', server: { routes: [searchRoute] } }),
		];
		const inProcessFetch = createInProcessRouteFetch(layers);

		const response = await inProcessFetch('http://ssr.local/api/missing');

		expect(response.status).toBe(404);
	});
});
