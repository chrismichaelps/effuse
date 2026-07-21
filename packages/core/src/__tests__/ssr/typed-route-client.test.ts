import { describe, it, expect, vi } from 'vitest';
import { defineServerRequest } from '../../ssr/request-contract.js';
import { defineServerRoute } from '../../ssr/route-contract.js';
import { serverSchema } from '../../ssr/server-schema.js';
import { createTypedRouteClient } from '../../ssr/typed-route-client.js';
import { LayerServerClientError } from '../../ssr/client.js';

const searchRoute = defineServerRoute({
	path: '/api/search',
	request: defineServerRequest({
		query: serverSchema.object({ limit: serverSchema.numberFromString }),
	}),
	response: serverSchema.object({ total: serverSchema.number }),
	GET: (ctx) => ({ total: ctx.input.query.limit }),
});

const userRoute = defineServerRoute({
	path: '/api/users/:id',
	request: defineServerRequest({
		params: serverSchema.object({ id: serverSchema.numberFromString }),
		json: serverSchema.object({ name: serverSchema.string }),
	}),
	response: serverSchema.object({ ok: serverSchema.boolean }),
	POST: (ctx) => ({ ok: ctx.input.params.id > 0 && ctx.input.json.name !== '' }),
});

const jsonResponse = (body: unknown, status = 200) =>
	new Response(JSON.stringify(body), {
		status,
		headers: { 'Content-Type': 'application/json' },
	});

describe('createTypedRouteClient', () => {
	it('sends query input and resolves the response contract type', async () => {
		const fetchImpl = vi.fn(async () => jsonResponse({ total: 3 }));
		const client = createTypedRouteClient(
			{ search: searchRoute },
			{ baseUrl: 'http://localhost:3000', fetch: fetchImpl }
		);

		const result = await client.search({ query: { limit: '3' } });

		// Typed as { total: number } from the response contract, not `unknown`.
		const total: number = result.total;
		expect(total).toBe(3);

		const [url, init] = fetchImpl.mock.calls[0] as unknown as [
			URL,
			RequestInit,
		];
		expect(url.toString()).toBe('http://localhost:3000/api/search?limit=3');
		expect(init.method).toBe('GET');
	});

	it('substitutes path params and sends a JSON body', async () => {
		const fetchImpl = vi.fn(async () => jsonResponse({ ok: true }));
		const client = createTypedRouteClient(
			{ user: userRoute },
			{ baseUrl: 'http://localhost:3000', fetch: fetchImpl }
		);

		const result = await client.user({
			params: { id: '42' },
			body: { name: 'ada' },
		});

		expect(result.ok).toBe(true);
		const [url, init] = fetchImpl.mock.calls[0] as unknown as [
			URL,
			RequestInit,
		];
		expect(url.toString()).toBe('http://localhost:3000/api/users/42');
		// Defaults to the single method the route declares.
		expect(init.method).toBe('POST');
		expect(init.body).toBe(JSON.stringify({ name: 'ada' }));
		expect(new Headers(init.headers).get('Content-Type')).toBe(
			'application/json'
		);
	});

	it('merges client headers with per-call header input', async () => {
		const fetchImpl = vi.fn(async () => jsonResponse({ total: 1 }));
		const client = createTypedRouteClient(
			{ search: searchRoute },
			{
				baseUrl: 'http://localhost:3000',
				fetch: fetchImpl,
				headers: { 'X-Client': 'effuse' },
			}
		);

		await client.search(
			{ query: { limit: '1' } },
			{ headers: { 'X-Call': 'one' } }
		);

		const [, init] = fetchImpl.mock.calls[0] as unknown as [URL, RequestInit];
		const headers = new Headers(init.headers);
		expect(headers.get('X-Client')).toBe('effuse');
		expect(headers.get('X-Call')).toBe('one');
	});

	it('throws a typed client error for a failed response', async () => {
		const fetchImpl = vi.fn(async () =>
			jsonResponse({ error: 'nope' }, 400)
		);
		const client = createTypedRouteClient(
			{ search: searchRoute },
			{ baseUrl: 'http://localhost:3000', fetch: fetchImpl }
		);

		await expect(client.search({ query: { limit: 'x' } })).rejects.toBeInstanceOf(
			LayerServerClientError
		);
	});

	it('leaves the result unknown for a route without a response contract', async () => {
		const untyped = defineServerRoute({
			path: '/api/untyped',
			request: defineServerRequest({}),
			GET: () => ({ anything: true }),
		});
		const fetchImpl = vi.fn(async () => jsonResponse({ anything: true }));
		const client = createTypedRouteClient(
			{ untyped },
			{ baseUrl: 'http://localhost:3000', fetch: fetchImpl }
		);

		const result = await client.untyped();

		// `unknown` — an untyped route must not masquerade as typed.
		expect((result as { anything: boolean }).anything).toBe(true);
	});
});

// Type-level guarantees. `@ts-expect-error` fails compilation if the marked line
// does NOT error, so these prove inference is real rather than collapsing to any.
describe('typed client inference', () => {
	const client = createTypedRouteClient(
		{ search: searchRoute, user: userRoute },
		{ baseUrl: 'http://localhost:3000' }
	);

	it('rejects unknown input sources and wrong result types', () => {
		void (async () => {
			// @ts-expect-error - `nope` is not a source declared by the contract.
			await client.search({ nope: { limit: '1' } });

			// @ts-expect-error - the contract declares a query source; it is required.
			await client.search({});

			const result = await client.search({ query: { limit: '1' } });
			// @ts-expect-error - `total` is a number from the response contract.
			const wrong: string = result.total;
			void wrong;

			// @ts-expect-error - `missing` is not part of the response contract.
			void result.missing;

			// @ts-expect-error - the user route requires params and body.
			await client.user({ params: { id: '1' } });
		});
		expect(true).toBe(true);
	});
});
