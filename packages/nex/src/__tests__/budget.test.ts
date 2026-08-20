/**
 * MIT License
 *
 * Copyright (c) 2025 Chris M. Perez
 */

import { describe, expect, it, vi } from 'vitest';
import {
	NexErrorCode,
	buildCatalog,
	createCostBudget,
	createNexHandler,
} from '../index.js';

const catalog = buildCatalog(`
	type Query { cheap: String! costly: String! @cost(value: 50) }
	schema { query: Query }
`);

const resolvers = { Query: { cheap: () => 'ok', costly: () => 'ok' } };

const ask = (handler: ReturnType<typeof createNexHandler>, query: string) =>
	handler(
		new Request('https://example.com/nex', {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({ query }),
		})
	);

describe('spending a budget', () => {
	it('lets a request through while there is room', () => {
		const budget = createCostBudget({ capacity: 100, refillPerSecond: 0 });

		expect(budget.take('caller', 40)).toMatchObject({ allowed: true });
		expect(budget.take('caller', 40)).toMatchObject({ allowed: true });
	});

	it('refuses a request there is no room for', () => {
		const budget = createCostBudget({ capacity: 100, refillPerSecond: 0 });

		budget.take('caller', 80);
		const refused = budget.take('caller', 40);

		expect(refused.allowed).toBe(false);
		expect(refused.remaining).toBe(20);
		expect(refused.retryAfterSeconds).toBeUndefined();
	});

	it('says how long until there is room again', () => {
		const budget = createCostBudget({ capacity: 100, refillPerSecond: 10 });

		budget.take('caller', 100);
		const refused = budget.take('caller', 50);

		expect(refused.allowed).toBe(false);
		expect(refused.retryAfterSeconds).toBeGreaterThan(0);
		expect(refused.retryAfterSeconds).toBeLessThanOrEqual(5);
	});

	it('fills back up as time passes', () => {
		let now = 0;
		const budget = createCostBudget({
			capacity: 100,
			refillPerSecond: 50,
			now: () => now,
		});

		budget.take('caller', 100);
		expect(budget.take('caller', 50).allowed).toBe(false);

		now = 2000;
		expect(budget.take('caller', 50)).toMatchObject({ allowed: true });
	});

	it('never fills past what it holds', () => {
		let now = 0;
		const budget = createCostBudget({
			capacity: 100,
			refillPerSecond: 50,
			now: () => now,
		});

		budget.take('caller', 100);
		now = 60_000;

		expect(budget.take('caller', 100)).toMatchObject({ allowed: true });
		expect(budget.take('caller', 1).allowed).toBe(false);
	});

	it('keeps one caller apart from another', () => {
		const budget = createCostBudget({ capacity: 100, refillPerSecond: 0 });

		budget.take('first', 100);

		expect(budget.take('second', 100)).toMatchObject({ allowed: true });
	});

	it('forgets a caller when told to', () => {
		const budget = createCostBudget({ capacity: 100, refillPerSecond: 0 });

		budget.take('caller', 100);
		budget.clear('caller');

		expect(budget.take('caller', 100)).toMatchObject({ allowed: true });
	});
});

describe('a server that spends on a caller’s behalf', () => {
	it('refuses a request the caller cannot afford', async () => {
		const budget = createCostBudget({ capacity: 40, refillPerSecond: 0 });
		const handler = createNexHandler({
			catalog,
			resolvers,
			budget: { budget, callerFor: () => 'caller' },
		});

		const first = await ask(handler, '{ costly }');
		const body = (await first.json()) as {
			errors?: { extensions?: { code?: string } }[];
		};

		expect(first.status).toBe(429);
		expect(body.errors?.[0]?.extensions?.code).toBe(NexErrorCode.OVER_BUDGET);
	});

	it('says when to come back', async () => {
		const budget = createCostBudget({ capacity: 10, refillPerSecond: 5 });
		const handler = createNexHandler({
			catalog,
			resolvers,
			budget: { budget, callerFor: () => 'caller' },
		});

		const refused = await ask(handler, '{ costly }');

		expect(refused.headers.get('retry-after')).toMatch(/^\d+$/);
	});

	it('lets an affordable request through', async () => {
		const budget = createCostBudget({ capacity: 100, refillPerSecond: 0 });
		const handler = createNexHandler({
			catalog,
			resolvers,
			budget: { budget, callerFor: () => 'caller' },
		});

		const response = await ask(handler, '{ cheap }');

		expect(response.status).toBe(200);
		expect(await response.json()).toMatchObject({ data: { cheap: 'ok' } });
	});

	it('charges what the request actually costs', async () => {
		const budget = createCostBudget({ capacity: 60, refillPerSecond: 0 });
		const handler = createNexHandler({
			catalog,
			resolvers,
			budget: { budget, callerFor: () => 'caller' },
		});

		// 51 for the costly field, leaving room for a cheap one but not another.
		expect((await ask(handler, '{ costly }')).status).toBe(200);
		expect((await ask(handler, '{ cheap }')).status).toBe(200);
		expect((await ask(handler, '{ costly }')).status).toBe(429);
	});

	it('tells one caller apart from another', async () => {
		const budget = createCostBudget({ capacity: 60, refillPerSecond: 0 });
		const callers = ['first', 'second'];
		let index = 0;
		const handler = createNexHandler({
			catalog,
			resolvers,
			budget: { budget, callerFor: () => callers[index] ?? 'first' },
		});

		expect((await ask(handler, '{ costly }')).status).toBe(200);
		index = 1;
		expect((await ask(handler, '{ costly }')).status).toBe(200);
	});

	it('reads the caller from the request', async () => {
		const callerFor = vi.fn(() => 'caller');
		const handler = createNexHandler({
			catalog,
			resolvers,
			budget: {
				budget: createCostBudget({ capacity: 1000, refillPerSecond: 0 }),
				callerFor,
			},
		});

		await ask(handler, '{ cheap }');

		expect(callerFor).toHaveBeenCalledTimes(1);
		expect(callerFor.mock.calls[0]?.[0]).toBeInstanceOf(Request);
	});

	it('charges nothing when no budget was given', async () => {
		const handler = createNexHandler({ catalog, resolvers });

		expect((await ask(handler, '{ costly }')).status).toBe(200);
	});
});
