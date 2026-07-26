import { describe, it, expect, afterEach } from 'vitest';
import { createHandler } from '../../ssr/handler.js';
import { defineLayer } from '../../layers/api/defineLayer.js';
import { clearGlobalLayerContext } from '../../layers/context.js';
import { clearGlobalTracing } from '../../layers/tracing/index.js';
import { defineServerRequest } from '../../ssr/request-contract.js';
import { defineServerRoute } from '../../ssr/route-contract.js';
import { serverSchema } from '../../ssr/server-schema.js';
import { streamResponse } from '../../ssr/response-contract.js';
import { createTypedRouteClient } from '../../ssr/typed-route-client.js';
import { createInProcessRouteFetch } from '../../ssr/in-process-route-client.js';
import { LayerServerClientError } from '../../ssr/client.js';

afterEach(() => {
	clearGlobalLayerContext();
	clearGlobalTracing();
});

const streamOf = (text: string): ReadableStream<Uint8Array> =>
	new ReadableStream({
		start(controller) {
			controller.enqueue(new TextEncoder().encode(text));
			controller.close();
		},
	});

const downloadRoute = defineServerRoute({
	path: '/api/download',
	request: defineServerRequest({}),
	response: streamResponse(),
	GET: () =>
		new Response(streamOf('chunk-a|chunk-b'), {
			headers: { 'Content-Type': 'application/octet-stream' },
		}),
});

const handlerFor = (layer: ReturnType<typeof defineLayer>) =>
	createHandler({ root: undefined as never, layers: [layer] });

describe('streaming response contracts', () => {
	it('passes a streamed Response through untouched without contract validation', async () => {
		const handler = handlerFor(
			defineLayer({ name: 'files', server: { routes: [downloadRoute] } })
		);

		const response = await handler(
			new Request('http://localhost:3000/api/download')
		);

		// No server_response_contract 500 — a streaming route opts out of
		// response-body validation, and the raw stream reaches the wire intact.
		expect(response.status).toBe(200);
		expect(response.headers.get('Content-Type')).toBe(
			'application/octet-stream'
		);
		expect(await response.text()).toBe('chunk-a|chunk-b');
	});

	it('surfaces the raw Response to a typed client instead of a decoded value', async () => {
		const layers = [
			defineLayer({ name: 'files', server: { routes: [downloadRoute] } }),
		];
		const client = createTypedRouteClient(
			{ download: downloadRoute },
			{ baseUrl: 'http://ssr.local', fetch: createInProcessRouteFetch(layers) }
		);

		const result = await client.download();

		// Typed as Response (not `unknown`, not a decoded body) so the caller owns
		// how the stream is consumed.
		const response: Response = result;
		expect(response).toBeInstanceOf(Response);
		expect(await response.text()).toBe('chunk-a|chunk-b');
	});

	it('still throws on a non-2xx streamed route', async () => {
		const failing = defineServerRoute({
			path: '/api/download',
			request: defineServerRequest({}),
			response: streamResponse(),
			GET: () => new Response('boom', { status: 503 }),
		});
		const layers = [
			defineLayer({ name: 'files', server: { routes: [failing] } }),
		];
		const client = createTypedRouteClient(
			{ download: failing },
			{ baseUrl: 'http://ssr.local', fetch: createInProcessRouteFetch(layers) }
		);

		await expect(client.download()).rejects.toBeInstanceOf(
			LayerServerClientError
		);
	});

	it('is exposed on serverSchema for ergonomic declaration', () => {
		expect(serverSchema.stream).toBe(streamResponse);
	});
});
