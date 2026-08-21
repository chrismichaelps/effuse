/**
 * MIT License
 *
 * Copyright (c) 2025 Chris M. Perez
 */

import { describe, expect, it, vi } from 'vitest';
import {
	analyzeRequest,
	buildCatalog,
	composeServices,
	createCostBudget,
	createNexHandler,
	execute,
	type AuthorizeRequest,
	type ExecutionResult,
} from '../index.js';

const guarded = buildCatalog(`
	type Secret { value: String! }
	type Query {
		secret: Secret! @auth(requires: "member")
		costly: String! @cost(value: 40)
		plain: String!
	}
	schema { query: Query }
`);

const serviceThatCounts = () => {
	const asked = vi.fn();
	const service = {
		catalog: guarded,
		request: async (payload: { query: string }): Promise<ExecutionResult> => {
			asked(payload.query);
			return {
				data: { secret: { value: 'the secret' }, costly: 'ok', plain: 'ok' },
				extensions: { cost: 1 },
			};
		},
	};
	return { service, asked };
};

describe('a guarded field a service owns', () => {
	it('is refused before the service is asked, with no authorizer', async () => {
		const { service, asked } = serviceThatCounts();
		const { catalog, resolvers } = composeServices({ s: service });

		const result = await execute({
			request: '{ secret { value } }',
			catalog,
			resolvers,
		});

		// A guard the graph never checks would be no guard at all, and the
		// service behind it would answer to anyone who could reach the graph.
		expect(result.data).toBeNull();
		expect(result.errors?.[0]?.message).toMatch(/@auth/);
		expect(asked).not.toHaveBeenCalled();
	});

	it('is refused before the service is asked, when the answer is no', async () => {
		const { service, asked } = serviceThatCounts();
		const { catalog, resolvers } = composeServices({ s: service });

		const result = await execute({
			request: '{ secret { value } }',
			catalog,
			resolvers,
			authorize: () => false,
		});

		expect(result.data).toBeNull();
		expect(asked).not.toHaveBeenCalled();
	});

	it('is asked for when the answer is yes', async () => {
		const { service, asked } = serviceThatCounts();
		const { catalog, resolvers } = composeServices({ s: service });

		const result = await execute({
			request: '{ secret { value } }',
			catalog,
			resolvers,
			authorize: () => true,
		});

		expect(result.errors).toBeUndefined();
		expect(asked).toHaveBeenCalledTimes(1);
	});

	it('says what the field requires', async () => {
		const { service } = serviceThatCounts();
		const { catalog, resolvers } = composeServices({ s: service });
		const authorize = vi.fn((_request: AuthorizeRequest) => true);

		await execute({
			request: '{ secret { value } }',
			catalog,
			resolvers,
			authorize,
		});

		expect(authorize.mock.calls[0]?.[0]).toMatchObject({ requires: 'member' });
	});
});

describe('what a field a service owns costs', () => {
	it('is priced by what the service declared', () => {
		const { service } = serviceThatCounts();
		const other = buildCatalog(`
			type Query { elsewhere: String! @cost(value: 7) }
			schema { query: Query }
		`);

		// Two services, so the roots are actually merged: a cost that did not
		// survive that merge would price everything behind it at one.
		const { catalog } = composeServices({
			s: service,
			other: {
				catalog: other,
				request: async (): Promise<ExecutionResult> => ({
					data: { elsewhere: 'ok' },
					extensions: { cost: 1 },
				}),
			},
		});

		expect(analyzeRequest('{ elsewhere }', catalog).cost).toBe(7);

		// The cost travels with the field definition through the merge, or a
		// graph would price everything behind it at one.
		expect(analyzeRequest('{ costly }', catalog).cost).toBe(40);
		expect(analyzeRequest('{ plain }', catalog).cost).toBe(1);
	});

	it('is charged to the caller by the graph in front of it', async () => {
		const { service, asked } = serviceThatCounts();
		const { catalog, resolvers } = composeServices({ s: service });

		const handler = createNexHandler({
			catalog,
			resolvers,
			budget: {
				budget: createCostBudget({ capacity: 60, refillPerSecond: 0 }),
				callerFor: () => 'caller',
			},
		});

		const ask = () =>
			handler(
				new Request('https://example.com/nex', {
					method: 'POST',
					headers: { 'content-type': 'application/json' },
					body: JSON.stringify({ query: '{ costly }' }),
				})
			);

		expect((await ask()).status).toBe(200);
		expect((await ask()).status).toBe(429);
		expect(asked).toHaveBeenCalledTimes(1);
	});
});
