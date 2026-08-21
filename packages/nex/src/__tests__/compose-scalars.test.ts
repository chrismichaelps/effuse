/**
 * MIT License
 *
 * Copyright (c) 2025 Chris M. Perez
 */

import { describe, expect, it } from 'vitest';
import {
	buildCatalog,
	composeServices,
	execute,
	type ExecutionResult,
	type NexScalars,
} from '../index.js';

const scalars: NexScalars = {
	Money: {
		serialize: (value) => {
			if (typeof value !== 'number') {
				throw new Error(`Money is held as cents, got ${typeof value}`);
			}
			return (value / 100).toFixed(2);
		},
		parse: (value) => Math.round(Number(value) * 100),
	},
};

const shopCatalog = buildCatalog(`
	scalar Money
	type Item { name: String! price: Money! }
	type Query { price: Money! item: Item! items: [Item!]! @connection }
	schema { query: Query }
`);

const answering = (data: Record<string, unknown>) => ({
	catalog: shopCatalog,
	request: async (): Promise<ExecutionResult> => ({
		data,
		extensions: { cost: 1 },
	}),
});

const run = (request: string, data: Record<string, unknown>) => {
	// The graph is told what its scalars are, the same as the run is.
	const { catalog, resolvers } = composeServices(
		{ shop: answering(data) },
		{ scalars }
	);

	return execute({ request, catalog, resolvers, scalars });
};

describe('a scalar that crossed a service boundary', () => {
	it('is not written twice', async () => {
		// The service already wrote it: what came back is "12.50", not cents.
		const result = await run('{ price }', { price: '12.50' });

		expect(result.errors).toBeUndefined();
		expect(result.data).toEqual({ price: '12.50' });
	});

	it('is not written twice inside an object', async () => {
		const result = await run('{ item { name price } }', {
			item: { name: 'Tea', price: '3.25' },
		});

		expect(result.errors).toBeUndefined();
		expect(result.data).toEqual({ item: { name: 'Tea', price: '3.25' } });
	});

	it('is not written twice on every row of a list', async () => {
		// The pipeline is applied here rather than there, so what a service
		// sends is the rows themselves.
		const result = await run('{ items | page first: 2 { price } }', {
			items: [{ price: '1.00' }, { price: '2.00' }],
		});

		expect(result.errors).toBeUndefined();
		expect(
			(result.data?.items as { items: { price: string }[] }).items
		).toEqual([{ price: '1.00' }, { price: '2.00' }]);
	});

	it('reads it back on whichever type the value turned out to be', async () => {
		const unionCatalog = buildCatalog(`
			scalar Money
			type Sale { price: Money! }
			type Gift { note: String! }
			union Event = Sale | Gift
			type Query { latest: Event! }
			schema { query: Query }
		`);

		const { catalog, resolvers } = composeServices(
			{
				shop: {
					catalog: unionCatalog,
					request: async (): Promise<ExecutionResult> => ({
						// A union answers as whichever type it turned out to be, and
						// only __typename says which.
						data: { latest: { __typename: 'Sale', price: '4.50' } },
						extensions: { cost: 1 },
					}),
				},
			},
			{ scalars }
		);

		const result = await execute({
			request: '{ latest { __typename ... on Sale { price } } }',
			catalog,
			resolvers,
			scalars,
		});

		expect(result.errors).toBeUndefined();
		expect(result.data).toEqual({
			latest: { __typename: 'Sale', price: '4.50' },
		});
	});

	it('leaves a scalar the language defines alone', async () => {
		const result = await run('{ item { name } }', {
			item: { name: 'Tea' },
		});

		expect(result.data).toEqual({ item: { name: 'Tea' } });
	});

	it('still writes what the graph resolved itself', async () => {
		const own = buildCatalog(`
			scalar Money
			type Query { local: Money! }
			schema { query: Query }
		`);
		const { catalog, resolvers } = composeServices(
			{ shop: answering({}) },
			{ scalars }
		);
		const merged = { ...resolvers, Query: { ...resolvers.Query } };

		const result = await execute({
			request: '{ price }',
			catalog,
			scalars,
			resolvers: {
				...merged,
				// A field this graph answers itself is still held as cents.
				Query: { ...merged.Query, price: () => 999 },
			},
		});

		expect(own.getType('Money')).toBeDefined();
		expect(result.data).toEqual({ price: '9.99' });
	});
});
