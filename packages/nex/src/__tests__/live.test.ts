/**
 * MIT License
 *
 * Copyright (c) 2025 Chris M. Perez
 */

import { describe, expect, it } from 'vitest';
import {
	type ExecutionResult,
	type LiveSources,
	buildCatalog,
	subscribe,
	validateRequest,
} from '../index.js';

const catalog = buildCatalog(`
	schema { query: Query live: Live }

	type Query { hello: String! }
	type Live {
		postAdded(channel: ID!): Post!
		counter: Int!
		quiet: Int!
	}
	type Post { id: ID! title: String! author: User! }
	type User { id: ID! name: String! }
`);

/** Turn an array into the stream a source hands back. */
const streamOf = async function* <T>(values: readonly T[]): AsyncGenerator<T> {
	for (const value of values) {
		await Promise.resolve();
		yield value;
	}
};

const sources: LiveSources = {
	Live: {
		postAdded: (args) =>
			streamOf([
				{ id: '1', title: `first on ${String(args.channel)}`, authorId: 'u1' },
				{ id: '2', title: 'second', authorId: 'u1' },
			]),
		counter: () => streamOf([1, 2, 3]),
		quiet: () => streamOf([]),
	},
};

const resolvers = {
	Post: { author: () => ({ id: 'u1', name: 'Ada' }) },
};

const collect = async (
	stream: AsyncIterable<ExecutionResult>
): Promise<readonly ExecutionResult[]> => {
	const results: ExecutionResult[] = [];
	for await (const result of stream) results.push(result);
	return results;
};

describe('live operations', () => {
	it('yields a snapshot per event', async () => {
		const results = await collect(
			subscribe({
				request:
					'live Feed { postAdded(channel: "general") { title author { name } } }',
				catalog,
				resolvers,
				sources,
			})
		);

		expect(results.map((result) => result.data)).toEqual([
			{ postAdded: { title: 'first on general', author: { name: 'Ada' } } },
			{ postAdded: { title: 'second', author: { name: 'Ada' } } },
		]);
	});

	it('carries the cost on every snapshot', async () => {
		const [first] = await collect(
			subscribe({ request: 'live L { counter }', catalog, sources })
		);

		expect(first?.extensions.cost).toBe(1);
	});

	it('ends quietly when the source has nothing to send', async () => {
		expect(
			await collect(
				subscribe({ request: 'live L { quiet }', catalog, sources })
			)
		).toEqual([]);
	});

	it('stops when the consumer stops reading', async () => {
		let produced = 0;
		const counting = async function* (): AsyncGenerator<number> {
			while (true) {
				produced += 1;
				await Promise.resolve();
				yield produced;
			}
		};

		const stream = subscribe({
			request: 'live L { counter }',
			catalog,
			sources: { Live: { counter: counting } },
		});

		for await (const result of stream) {
			if ((result.data as { counter: number }).counter >= 2) break;
		}

		expect(produced).toBeLessThan(5);
	});

	it('reports a request that does not agree with the catalog, then ends', async () => {
		const results = await collect(
			subscribe({ request: 'live L { nope }', catalog, sources })
		);

		expect(results).toHaveLength(1);
		expect(results[0]?.data).toBeNull();
		expect(results[0]?.errors?.[0]?.message).toMatch(
			/Cannot query field "nope"/
		);
	});

	it('reports a live field with no source behind it', async () => {
		const results = await collect(
			subscribe({ request: 'live L { counter }', catalog, sources: {} })
		);

		expect(results[0]?.errors?.[0]?.message).toMatch(
			/No live source for field "counter"/
		);
	});

	it('keeps resolving after a snapshot reports a field error', async () => {
		const results = await collect(
			subscribe({
				request: 'live L { postAdded(channel: "c") { title author { name } } }',
				catalog,
				sources,
				resolvers: {
					Post: {
						author: (source) =>
							(source as { id: string }).id === '1'
								? Promise.reject(new Error('author lookup failed'))
								: { id: 'u1', name: 'Ada' },
					},
				},
			})
		);

		expect(results).toHaveLength(2);
		expect(results[0]?.data).toBeNull();
		expect(results[0]?.errors?.[0]?.message).toMatch(/author lookup failed/);
		expect(results[1]?.data).toMatchObject({ postAdded: { title: 'second' } });
	});

	it('refuses a query or mutation', async () => {
		const results = await collect(
			subscribe({ request: '{ hello }', catalog, sources })
		);

		expect(results[0]?.errors?.[0]?.message).toMatch(/live operation/i);
	});
});

describe('what a live operation may ask for', () => {
	it('rejects a live operation that watches more than one field', () => {
		expect(
			validateRequest('live L { counter quiet }', catalog)[0]?.message
		).toMatch(/exactly one field/i);
	});

	it('rejects two fields reached through a fragment', () => {
		expect(
			validateRequest(
				'live L { ...F } fragment F on Live { counter quiet }',
				catalog
			)[0]?.message
		).toMatch(/exactly one field/i);
	});

	it('accepts one field reached through a fragment', () => {
		expect(
			validateRequest('live L { ...F } fragment F on Live { counter }', catalog)
		).toEqual([]);
	});
});
