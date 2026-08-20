/**
 * MIT License
 *
 * Copyright (c) 2025 Chris M. Perez
 */

import { describe, expect, it, vi } from 'vitest';
import {
	buildCatalog,
	createNexClient,
	createNexHandler,
	nexMutation,
	nexQuery,
	nexQueryKey,
	NexExecutionError,
} from '../index.js';

const catalog = buildCatalog(`
	type Post @identity { id: ID! title: String! }
	type Query { posts: [Post!]! @connection missing: String? }
	type Mutation { rename(id: ID!, to: String!): Post! }
	schema { query: Query, mutation: Mutation }
`);

const handler = createNexHandler({
	catalog,
	resolvers: {
		Query: {
			posts: () => [{ id: '1', title: 'first' }],
			missing: () => {
				throw new Error('the source is down');
			},
		},
		Mutation: {
			rename: (_source, args) => ({
				id: String(args.id),
				title: String(args.to),
			}),
		},
	},
});

const client = () =>
	createNexClient({
		endpoint: 'http://render/nex',
		cache: false,
		fetch: ((url: string, init: RequestInit) =>
			handler(new Request(url, init))) as unknown as typeof fetch,
	});

const FEED = '{ posts | page first: 1 { title } }';

describe('a request as something the ecosystem can cache', () => {
	it('hands back a key and a way to run it', () => {
		const { queryKey, queryFn } = nexQuery(client(), FEED);

		expect(Array.isArray(queryKey)).toBe(true);
		expect(typeof queryFn).toBe('function');
	});

	it('runs the request and answers with what came back', async () => {
		const { queryFn } = nexQuery(client(), FEED);

		const data = await queryFn({ signal: new AbortController().signal });

		expect(data).toMatchObject({ posts: { items: [{ title: 'first' }] } });
	});

	it('names the request the same however it was spelled', () => {
		const spaced = nexQueryKey('{  posts   |  page first: 1 { title }  }');
		const tight = nexQueryKey(FEED);

		expect(spaced).toEqual(tight);
	});

	it('names two different requests differently', () => {
		expect(nexQueryKey(FEED)).not.toEqual(
			nexQueryKey('{ posts | page first: 2 { title } }')
		);
	});

	it('counts the variables as part of what a request is', () => {
		const request = 'query F($n: Int!) { posts | page first: $n { title } }';

		expect(nexQueryKey(request, { variables: { n: 1 } })).not.toEqual(
			nexQueryKey(request, { variables: { n: 2 } })
		);
	});

	it('says which library the key belongs to', () => {
		expect(nexQueryKey(FEED)[0]).toBe('nex');
	});

	it('is the same key the query helper uses', () => {
		expect(nexQuery(client(), FEED).queryKey).toEqual(nexQueryKey(FEED));
	});
});

describe('a request that did not work', () => {
	it('throws, so a cache holds nothing and a retry can happen', async () => {
		const { queryFn } = nexQuery(client(), '{ nope }');

		await expect(
			queryFn({ signal: new AbortController().signal })
		).rejects.toThrow(/Cannot query field "nope"/);
	});

	it('throws what nex would have reported', async () => {
		const { queryFn } = nexQuery(client(), '{ nope }');

		await expect(
			queryFn({ signal: new AbortController().signal })
		).rejects.toBeInstanceOf(NexExecutionError);
	});

	it('keeps an answer that came back in part', async () => {
		const onErrors = vi.fn();
		const { queryFn } = nexQuery(
			client(),
			'{ posts | page first: 1 { title } missing }',
			{
				onErrors,
			}
		);

		const data = await queryFn({ signal: new AbortController().signal });

		// The field that failed is reported rather than thrown away, and the
		// fields that worked are still an answer.
		expect(data).toMatchObject({ posts: { items: [{ title: 'first' }] } });
		expect(onErrors).toHaveBeenCalledTimes(1);
	});

	it('says nothing when nothing failed', async () => {
		const onErrors = vi.fn();
		const { queryFn } = nexQuery(client(), FEED, { onErrors });

		await queryFn({ signal: new AbortController().signal });

		expect(onErrors).not.toHaveBeenCalled();
	});

	it('carries the signal it was given', async () => {
		const controller = new AbortController();
		controller.abort();

		const { queryFn } = nexQuery(client(), FEED);

		await expect(queryFn({ signal: controller.signal })).rejects.toThrow();
	});
});

describe('a change as something the ecosystem can run', () => {
	it('runs the change with the variables it is called with', async () => {
		const { mutationFn } = nexMutation<
			{ rename: { title: string } },
			{ id: string; to: string }
		>(
			client(),
			'mutation R($id: ID!, $to: String!) { rename(id: $id, to: $to) { title } }'
		);

		const data = await mutationFn({ id: '1', to: 'renamed' });

		expect(data).toMatchObject({ rename: { title: 'renamed' } });
	});

	it('throws when the change did not happen', async () => {
		const { mutationFn } = nexMutation(client(), 'mutation { nope }');

		await expect(mutationFn({})).rejects.toThrow(/Cannot query field "nope"/);
	});
});
