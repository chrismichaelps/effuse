/**
 * MIT License
 *
 * Copyright (c) 2025 Chris M. Perez
 */

import { describe, expect, it, vi } from 'vitest';
import { buildCatalog, execute, type NexScalars } from '../index.js';

const catalog = buildCatalog(`
	scalar Json
	scalar Money
	type Query {
		settings: Json!
		price: Money!
		opaque: Json!
		echo(value: Json!): Json!
		cost(amount: Money!): Money!
	}
	schema { query: Query }
`);

const scalars: NexScalars = {
	Json: {
		serialize: (value) => value,
		parse: (value) => value,
	},
	Money: {
		// Held as whole cents, written as a decimal string.
		serialize: (value) => {
			if (typeof value !== 'number') {
				throw new Error('Money is held as a whole number of cents');
			}
			return (value / 100).toFixed(2);
		},
		parse: (value) => {
			if (typeof value !== 'string' || !/^\d+\.\d{2}$/u.test(value)) {
				throw new Error('Money is written as a decimal with two places');
			}
			return Math.round(Number(value) * 100);
		},
	},
};

const run = (
	request: string,
	resolvers: Record<string, Record<string, unknown>>,
	variables?: Record<string, unknown>
) =>
	execute({
		request,
		catalog,
		scalars,
		resolvers: resolvers as never,
		...(variables === undefined ? {} : { variables }),
	});

describe('a scalar the server says how to write', () => {
	it('writes what the server said to write', async () => {
		const result = await run('{ price }', { Query: { price: () => 1250 } });

		expect(result.errors).toBeUndefined();
		expect(result.data).toEqual({ price: '12.50' });
	});

	it('carries a shape a string could never carry', async () => {
		const settings = { theme: 'dark', rows: [1, 2, 3] };
		const result = await run('{ settings }', {
			Query: { settings: () => settings },
		});

		expect(result.data).toEqual({ settings });
	});

	it('reports a value the scalar cannot write', async () => {
		const result = await run('{ price }', {
			Query: { price: () => 'twelve fifty' },
		});

		expect(result.data).toBeNull();
		expect(result.errors?.[0]?.message).toMatch(/whole number of cents/);
		expect(result.errors?.[0]?.path).toEqual(['price']);
	});
});

describe('a scalar the server says how to read', () => {
	it('hands a resolver what the scalar made of it', async () => {
		const cost = vi.fn((_amount: number) => 0);
		await run(
			'query C($amount: Money!) { cost(amount: $amount) }',
			{
				Query: {
					cost: (_s: unknown, args: { amount: number }) => cost(args.amount),
				},
			},
			{ amount: '12.50' }
		);

		expect(cost).toHaveBeenCalledWith(1250);
	});

	it('refuses a variable the scalar cannot read', async () => {
		const result = await run(
			'query C($amount: Money!) { cost(amount: $amount) }',
			{ Query: { cost: () => 0 } },
			{ amount: 'twelve fifty' }
		);

		expect(result.data).toBeNull();
		expect(result.errors?.[0]?.message).toMatch(/two places/);
	});

	it('reads a value written into the request itself', async () => {
		const cost = vi.fn((_amount: number) => 0);
		await run('{ cost(amount: "3.25") }', {
			Query: {
				cost: (_s: unknown, args: { amount: number }) => cost(args.amount),
			},
		});

		expect(cost).toHaveBeenCalledWith(325);
	});

	it('refuses a literal the scalar cannot read', async () => {
		const result = await run('{ cost(amount: "nope") }', {
			Query: { cost: () => 0 },
		});

		expect(result.errors?.[0]?.message).toMatch(/two places/);
	});
});

describe('a scalar the server said nothing about', () => {
	it('passes a value through rather than insisting on a string', async () => {
		const result = await execute({
			request: '{ opaque }',
			catalog,
			resolvers: { Query: { opaque: () => ({ nested: true }) } },
		});

		expect(result.errors).toBeUndefined();
		expect(result.data).toEqual({ opaque: { nested: true } });
	});

	it('takes what a caller sent, whatever it is', async () => {
		const result = await execute({
			request: 'query E($value: Json!) { echo(value: $value) }',
			catalog,
			variables: { value: [1, 2] },
			resolvers: {
				Query: { echo: (_s, args) => args.value },
			},
		});

		expect(result.data).toEqual({ echo: [1, 2] });
	});
});

describe('what a scalar cannot change', () => {
	it('leaves the scalars the language defines alone', async () => {
		const built = buildCatalog(`
			type Query { count: Int! }
			schema { query: Query }
		`);

		const result = await execute({
			request: '{ count }',
			catalog: built,
			scalars: { Int: { serialize: () => 'hijacked', parse: (v) => v } },
			resolvers: { Query: { count: () => 7 } },
		});

		// A catalog cannot redefine what Int means, so neither can this.
		expect(result.data).toEqual({ count: 7 });
	});
});

describe('a scalar wherever a request is served', () => {
	it('is used by a request that arrived over HTTP', async () => {
		const { createNexHandler } = await import('../index.js');
		const handler = createNexHandler({
			catalog,
			scalars,
			resolvers: { Query: { price: () => 1250 } },
		});

		const response = await handler(
			new Request('https://example.com/nex', {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({ query: '{ price }' }),
			})
		);

		expect(await response.json()).toMatchObject({ data: { price: '12.50' } });
	});

	it('reads a variable that arrived over HTTP', async () => {
		const { createNexHandler } = await import('../index.js');
		const seen: number[] = [];
		const handler = createNexHandler({
			catalog,
			scalars,
			resolvers: {
				Query: {
					cost: (_source, args) => {
						seen.push(args.amount as number);
						return args.amount;
					},
				},
			},
		});

		await handler(
			new Request('https://example.com/nex', {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({
					query: 'query C($amount: Money!) { cost(amount: $amount) }',
					variables: { amount: '12.50' },
				}),
			})
		);

		expect(seen).toEqual([1250]);
	});

	it('is used by a live operation', async () => {
		const { subscribe } = await import('../index.js');
		const live = buildCatalog(`
			scalar Money
			type Query { price: Money! }
			type Live { price: Money! }
			schema { query: Query, live: Live }
		`);

		const snapshots = subscribe({
			request: 'live P { price }',
			catalog: live,
			scalars,
			sources: {
				Live: {
					price: async function* () {
						// A live source yields the value of the field it feeds.
						yield 990;
					},
				},
			},
		});

		const [first] = [(await snapshots.next()).value];

		expect(first?.data).toEqual({ price: '9.90' });
	});
});
