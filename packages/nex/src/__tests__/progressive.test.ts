/**
 * MIT License
 *
 * Copyright (c) 2025 Chris M. Perez
 */

import { describe, expect, it, vi } from 'vitest';
import { buildCatalog, stream } from '../index.js';
import type { ExecutionResult } from '../index.js';

const catalog = buildCatalog(`
	type Query {
		quick: String!
		alsoQuick: String!
		slow: String! @cost(value: 50)
		slower: String! @cost(value: 90)
		broken: String? @cost(value: 50)
	}
	schema { query: Query }
`);

const after = (ms: number, value: string) =>
	new Promise<string>((resolve) => setTimeout(() => resolve(value), ms));

const resolvers = {
	Query: {
		quick: () => 'here',
		alsoQuick: () => 'also here',
		slow: () => after(10, 'eventually'),
		slower: () => after(20, 'much later'),
		broken: () => {
			throw new Error('the source is down');
		},
	},
};

const collect = async (
	request: string,
	options: Record<string, unknown> = {}
): Promise<ExecutionResult[]> => {
	const seen: ExecutionResult[] = [];
	for await (const snapshot of stream({
		request,
		catalog,
		resolvers,
		deferOver: 10,
		...options,
	})) {
		seen.push(snapshot);
	}
	return seen;
};

describe('a request whose cheap part need not wait', () => {
	it('sends what is ready before what is slow', async () => {
		const seen = await collect('{ quick slow }');

		expect(seen).toHaveLength(2);
		expect(seen[0]?.data).toEqual({ quick: 'here' });
		expect(seen[1]?.data).toEqual({ quick: 'here', slow: 'eventually' });
	});

	it('carries everything known so far in each one', async () => {
		const seen = await collect('{ quick slow slower }');

		// A reader replaces rather than merges: the last one is the whole
		// answer, which is what a client would have waited for anyway.
		expect(seen.at(-1)?.data).toEqual({
			quick: 'here',
			slow: 'eventually',
			slower: 'much later',
		});
	});

	it('sends one for each slow field, as it lands', async () => {
		const seen = await collect('{ quick slow slower }');

		expect(seen).toHaveLength(3);
		expect(Object.keys(seen[1]?.data ?? {})).toEqual(['quick', 'slow']);
	});

	it('sends the cheapest first even when it was asked for last', async () => {
		const seen = await collect('{ slow quick }');

		expect(seen[0]?.data).toEqual({ quick: 'here' });
	});

	it('sends the nearer of two slow fields first', async () => {
		// Written slowest first, so the order they arrive in is the order the
		// catalog prices them at rather than the order they were typed.
		const seen = await collect('{ quick slower slow }');

		expect(Object.keys(seen[1]?.data ?? {})).toEqual(['quick', 'slow']);
		expect(Object.keys(seen[2]?.data ?? {}).sort()).toEqual([
			'quick',
			'slow',
			'slower',
		]);
	});

	it('keeps a variable only the slow part uses', async () => {
		const withVariable = buildCatalog(`
			type Query { quick: String! slow(pad: Int!): String! @cost(value: 50) }
			schema { query: Query }
		`);

		const seen: ExecutionResult[] = [];
		for await (const snapshot of stream({
			request: 'query P($pad: Int!) { quick slow(pad: $pad) }',
			catalog: withVariable,
			deferOver: 10,
			variables: { pad: 2 },
			resolvers: {
				Query: {
					quick: () => 'here',
					slow: (_source, args) => `padded ${String(args.pad)}`,
				},
			},
		})) {
			seen.push(snapshot);
		}

		// The part without the slow field declares a variable it does not use,
		// which is only a problem if each part is held to the whole request's
		// rules rather than the request being checked once.
		expect(seen[0]?.errors).toBeUndefined();
		expect(seen.at(-1)?.data).toEqual({ quick: 'here', slow: 'padded 2' });
	});

	it('sends one snapshot when nothing is slow', async () => {
		const seen = await collect('{ quick alsoQuick }');

		expect(seen).toHaveLength(1);
		expect(seen[0]?.data).toEqual({ quick: 'here', alsoQuick: 'also here' });
	});

	it('sends one snapshot when nothing was said about waiting', async () => {
		const seen = await collect('{ quick slow }', { deferOver: undefined });

		// Without a threshold this is an ordinary run, and the shape of the
		// response is the shape it has always been.
		expect(seen).toHaveLength(1);
		expect(seen[0]?.data).toEqual({ quick: 'here', slow: 'eventually' });
	});

	it('leaves a field out until it has it, rather than saying null', async () => {
		const seen = await collect('{ quick slow }');

		// A key that is not there yet is honest; a null would be a claim.
		expect(seen[0]?.data).not.toHaveProperty('slow');
	});
});

describe('a slow field that failed', () => {
	it('reports it in the snapshot it belonged to', async () => {
		const seen = await collect('{ quick broken }');

		expect(seen[0]?.errors).toBeUndefined();
		expect(seen.at(-1)?.errors?.[0]?.message).toMatch(/the source is down/);
	});

	it('leaves what already arrived alone', async () => {
		const seen = await collect('{ quick broken }');

		expect(seen.at(-1)?.data).toMatchObject({ quick: 'here' });
	});
});

describe('a request that is not a query', () => {
	it('answers a change once, whatever it costs', async () => {
		const changing = buildCatalog(`
			type Query { quick: String! }
			type Mutation { first: String! @cost(value: 50) second: String! }
			schema { query: Query, mutation: Mutation }
		`);

		const order: string[] = [];
		const seen: ExecutionResult[] = [];
		for await (const snapshot of stream({
			request: 'mutation { first second }',
			catalog: changing,
			deferOver: 10,
			resolvers: {
				Mutation: {
					first: async () => {
						await after(10, '');
						order.push('first');
						return 'one';
					},
					second: () => {
						order.push('second');
						return 'two';
					},
				},
			},
		})) {
			seen.push(snapshot);
		}

		// A change runs its fields in the order they were written, so taking
		// them apart would reorder what a caller asked to happen.
		expect(seen).toHaveLength(1);
		expect(order).toEqual(['first', 'second']);
	});
});

describe('a cheap part that failed', () => {
	it('stops rather than sending the rest of a broken answer', async () => {
		const failing = buildCatalog(`
			type Query { quick: String! slow: String! @cost(value: 50) }
			schema { query: Query }
		`);

		const asked = vi.fn(() => 'eventually');
		const seen: ExecutionResult[] = [];
		for await (const snapshot of stream({
			request: '{ quick slow }',
			catalog: failing,
			deferOver: 10,
			resolvers: {
				Query: {
					quick: () => {
						throw new Error('the source is down');
					},
					slow: asked,
				},
			},
		})) {
			seen.push(snapshot);
		}

		// quick is non-null, so nothing of the answer survives - and filling
		// in the rest of an answer that has already failed helps nobody.
		expect(seen).toHaveLength(1);
		expect(seen[0]?.data).toBeNull();
		expect(asked).not.toHaveBeenCalled();
	});
});

describe('a request that cannot run', () => {
	it('says so once rather than in pieces', async () => {
		const seen = await collect('{ nope }');

		expect(seen).toHaveLength(1);
		expect(seen[0]?.errors?.[0]?.message).toMatch(/Cannot query field "nope"/);
	});
});

describe('a reader that stopped', () => {
	it('is not waited on', async () => {
		const asked = vi.fn(() => after(20, 'much later'));

		const snapshots = stream({
			request: '{ quick slow slower }',
			catalog,
			deferOver: 10,
			resolvers: { ...resolvers, Query: { ...resolvers.Query, slower: asked } },
		});

		const first = await snapshots.next();
		await snapshots.return(undefined as never);

		expect(first.value?.data).toEqual({ quick: 'here' });
		expect(asked).not.toHaveBeenCalled();
	});
});
