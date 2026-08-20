/**
 * MIT License
 *
 * Copyright (c) 2025 Chris M. Perez
 */

import { describe, expect, it, vi } from 'vitest';
import { NexErrorCode, buildCatalog, execute, subscribe } from '../index.js';

const catalog = buildCatalog(`
	schema { query: Query live: Live }
	type Query { node: Node media: Media items: [Item!]! one: Item }
	interface Node { id: ID! }
	type User implements Node { id: ID! name: String! }
	type Photo { url: String! }
	union Media = User | Photo
	type Item { id: ID! }
	type Live { ticks: Int! }
`);

describe('errors from places other than a field resolver', () => {
	it('reports a __resolveType that threw', async () => {
		const result = await execute({
			request: '{ media { __typename } }',
			catalog,
			resolvers: {
				Query: { media: () => ({ url: 'x' }) },
				Media: {
					__resolveType: () => {
						throw new Error('cannot tell what this is');
					},
				},
			},
		});

		expect(result.errors?.[0]?.message).toContain('cannot tell what this is');
		expect(result.errors?.[0]?.path).toEqual(['media']);
	});

	it('reports a __resolveType that named a type the catalog does not hold', async () => {
		const result = await execute({
			request: '{ media { __typename } }',
			catalog,
			resolvers: {
				Query: { media: () => ({ url: 'x' }) },
				Media: { __resolveType: () => 'Nowhere' },
			},
		});

		expect(result.data).toEqual({ media: null });
		expect(result.errors?.[0]?.message).toMatch(/Nowhere/);
	});

	it('reports a resolver that returned a rejected promise', async () => {
		const result = await execute({
			request: '{ one { id } }',
			catalog,
			resolvers: {
				Query: { one: () => Promise.reject(new Error('late failure')) },
			},
		});

		expect(result.errors?.[0]?.message).toBe('late failure');
		expect(result.errors?.[0]?.code).toBe(NexErrorCode.RESOLVER);
	});

	it('reports a resolver that threw something that is not an error', async () => {
		const result = await execute({
			request: '{ one { id } }',
			catalog,
			resolvers: {
				Query: {
					one: () => {
						throw 'just a string';
					},
				},
			},
		});

		expect(result.errors?.[0]?.message).toContain('just a string');
	});

	it('reports a list field that resolved to something that is not a list', async () => {
		const result = await execute({
			request: '{ items { id } }',
			catalog,
			resolvers: { Query: { items: () => ({ nope: true }) } },
		});

		expect(result.data).toBeNull();
		expect(result.errors?.[0]?.message).toMatch(/list/i);
	});

	it('keeps going when one row of a list fails', async () => {
		const result = await execute({
			request: '{ items { id } }',
			catalog,
			resolvers: {
				Query: {
					items: () => [{ id: '1' }, { id: '2' }],
				},
				Item: {
					id: (source) => {
						if ((source as { id: string }).id === '1') {
							throw new Error('row one is broken');
						}
						return (source as { id: string }).id;
					},
				},
			},
		});

		expect(result.data).toBeNull();
		expect(result.errors).toHaveLength(1);
		expect(result.errors?.[0]?.path).toEqual(['items', 0, 'id']);
	});

	it('survives a formatError that throws', async () => {
		const result = await execute({
			request: '{ one { id } }',
			catalog,
			resolvers: {
				Query: {
					one: () => {
						throw new Error('the original failure');
					},
				},
			},
			formatError: () => {
				throw new Error('the formatter is broken');
			},
		});

		expect(result.errors?.[0]?.message).toBe('the original failure');
	});

	it('reports a live source that failed to open', async () => {
		const results = [];

		for await (const snapshot of subscribe({
			request: 'live L { ticks }',
			catalog,
			sources: {
				Live: {
					ticks: () => {
						throw new Error('the broker is down');
					},
				},
			},
		})) {
			results.push(snapshot);
		}

		expect(results[0]?.errors?.[0]?.message).toContain('the broker is down');
	});

	it('reports a live source that failed part way through', async () => {
		const results = [];

		for await (const snapshot of subscribe({
			request: 'live L { ticks }',
			catalog,
			sources: {
				Live: {
					ticks: async function* () {
						yield 1;
						throw new Error('the connection dropped');
					},
				},
			},
		})) {
			results.push(snapshot);
		}

		expect(results).toHaveLength(2);
		expect(results[0]?.data).toEqual({ ticks: 1 });
		expect(results[1]?.errors?.[0]?.message).toContain(
			'the connection dropped'
		);
	});

	it('never reports the same failure twice', async () => {
		const result = await execute({
			request: '{ one { id } }',
			catalog,
			resolvers: {
				Query: { one: () => ({}) },
				Item: {
					id: () => {
						throw new Error('once');
					},
				},
			},
		});

		expect(result.errors).toHaveLength(1);
	});

	it('tells a watcher about a failure exactly once', async () => {
		const onFieldError = vi.fn();

		await execute({
			request: '{ one { id } }',
			catalog,
			resolvers: {
				Query: { one: () => ({}) },
				Item: {
					id: () => {
						throw new Error('once');
					},
				},
			},
			instrumentation: { onFieldError },
		});

		expect(onFieldError).toHaveBeenCalledTimes(1);
	});
});
