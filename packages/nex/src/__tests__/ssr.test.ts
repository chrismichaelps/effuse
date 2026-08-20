/**
 * MIT License
 *
 * Copyright (c) 2025 Chris M. Perez
 */

import { describe, expect, it, vi } from 'vitest';
import { buildCatalog, createNexClient, createNexHandler } from '../index.js';

const catalog = buildCatalog(`
	type Query { posts: [Post!]! @connection me: String! }
	type Post { id: ID! title: String! }
	schema { query: Query }
`);

const resolvers = {
	Query: {
		posts: () => [
			{ id: '1', title: 'first' },
			{ id: '2', title: 'second' },
		],
		me: () => 'ada',
	},
};

/** What a render does: talk to the handler in the same process. */
const renderTimeClient = (handler: ReturnType<typeof createNexHandler>) =>
	createNexClient({
		endpoint: 'http://render/nex',
		fetch: ((url: string, init: RequestInit) =>
			handler(new Request(url, init))) as unknown as typeof fetch,
	});

describe('rendering on the server', () => {
	it('answers without a socket', async () => {
		const handler = createNexHandler({ catalog, resolvers });
		const result = await renderTimeClient(handler).request(
			'{ posts | page first: 2 { title } }'
		);

		expect(result.errors).toBeUndefined();
		expect(result.data).toMatchObject({
			posts: { items: [{ title: 'first' }, { title: 'second' }] },
		});
	});

	it('carries the render into the browser without asking again', async () => {
		const handler = createNexHandler({ catalog, resolvers });
		const render = renderTimeClient(handler);

		await render.prefetch('{ me }');
		const payload = JSON.parse(
			JSON.stringify(render.dehydrate())
		) as ReturnType<typeof render.dehydrate>;

		const browserFetch = vi.fn();
		const browser = createNexClient({
			endpoint: '/nex',
			fetch: browserFetch as unknown as typeof fetch,
		});
		browser.hydrate(payload);

		expect((await browser.request('{ me }')).data).toEqual({ me: 'ada' });
		expect(browserFetch).not.toHaveBeenCalled();
	});

	it('keeps the answers of one render to itself', async () => {
		const handler = createNexHandler({ catalog, resolvers });
		const first = renderTimeClient(handler);
		const second = renderTimeClient(handler);

		await first.prefetch('{ me }');

		expect(second.dehydrate().results).toEqual([]);
		expect(first.dehydrate().results).toHaveLength(1);
	});

	it('carries what the render was given to every resolver', async () => {
		const seen: unknown[] = [];
		const handler = createNexHandler<{ requestId: string }>({
			catalog,
			context: { requestId: 'render-1' },
			resolvers: {
				Query: {
					me: (_source, _args, context) => {
						seen.push(context.requestId);
						return 'ada';
					},
					posts: () => [],
				},
			},
		});

		await renderTimeClient(handler).request('{ me }');

		expect(seen).toEqual(['render-1']);
	});

	it('stops the render when the request it belongs to goes away', async () => {
		const resolved = vi.fn(() => 'ada');
		const handler = createNexHandler({
			catalog,
			resolvers: { Query: { ...resolvers.Query, me: resolved } },
		});

		const controller = new AbortController();
		controller.abort();

		const response = await handler(
			new Request('http://render/nex', {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({ query: '{ me }' }),
				signal: controller.signal,
			})
		);

		expect(resolved).not.toHaveBeenCalled();
		expect(response.status).toBe(200);
	});
});
