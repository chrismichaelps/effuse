/**
 * MIT License
 *
 * Copyright (c) 2025 Chris M. Perez
 */

import { describe, expect, it, vi } from 'vitest';
import { NexErrorCode, buildCatalog, execute, subscribe } from '../index.js';
import type { AuthorizeRequest, ExecutionResult } from '../index.js';

const catalog = buildCatalog(`
	schema { query: Query mutation: Mutation live: Live }
	type Query {
		open: String!
		secret: String @auth(requires: "member")
		account: Account @auth(requires: "member")
	}
	type Mutation { erase: Boolean! @auth(requires: "admin") }
	type Live { pulse: Int! @auth(requires: "member") }
	type Account { id: ID! balance: Int! @auth(requires: "owner") }
`);

const resolvers = {
	Query: {
		open: () => 'anyone',
		secret: () => 'members only',
		account: () => ({ id: 'a1', balance: 42 }),
	},
	Mutation: { erase: () => true },
};

const run = (request: string, options: Record<string, unknown> = {}) =>
	execute({ request, catalog, resolvers, ...options });

describe('a field the catalog guards', () => {
	it('is refused when the server said nothing about who may see it', async () => {
		const result = await run('{ secret }');

		expect(result.data).toEqual({ secret: null });
		expect(result.errors?.[0]?.code).toBe(NexErrorCode.FORBIDDEN);
		expect(result.errors?.[0]?.message).toMatch(/no authorizer/i);
	});

	it('is resolved when the authorizer says yes', async () => {
		const result = await run('{ secret }', { authorize: () => true });

		expect(result.data).toEqual({ secret: 'members only' });
		expect(result.errors).toBeUndefined();
	});

	it('is refused when the authorizer says no', async () => {
		const result = await run('{ secret open }', { authorize: () => false });

		expect(result.data).toEqual({ secret: null, open: 'anyone' });
		expect(result.errors?.[0]?.code).toBe(NexErrorCode.FORBIDDEN);
		expect(result.errors?.[0]?.path).toEqual(['secret']);
	});

	it('is asked about with what the catalog requires and where it sits', async () => {
		const authorize = vi.fn(() => true);
		await run('{ account { balance } }', {
			authorize,
			context: { user: 'ada' },
		});

		expect(authorize).toHaveBeenCalledTimes(2);
		expect(authorize.mock.calls[0]?.[0]).toMatchObject({
			requires: 'member',
			coordinate: 'Query.account',
			path: ['account'],
			context: { user: 'ada' },
		});
		expect(authorize.mock.calls[1]?.[0]).toMatchObject({
			requires: 'owner',
			coordinate: 'Account.balance',
			path: ['account', 'balance'],
		});
	});

	it('may be answered asynchronously', async () => {
		const result = await run('{ secret }', {
			authorize: async () => Promise.resolve(true),
		});

		expect(result.data).toEqual({ secret: 'members only' });
	});

	it('never runs the resolver it was refused for', async () => {
		const secret = vi.fn(() => 'members only');
		const result = await execute({
			request: '{ secret }',
			catalog,
			resolvers: { Query: { ...resolvers.Query, secret } },
			authorize: () => false,
		});

		expect(secret).not.toHaveBeenCalled();
		expect(result.data).toEqual({ secret: null });
	});

	it('nulls the nearest nullable parent when the field cannot be null', async () => {
		const result = await run('mutation { erase }', { authorize: () => false });

		expect(result.data).toBeNull();
		expect(result.errors?.[0]?.code).toBe(NexErrorCode.FORBIDDEN);
	});

	it('leaves an unguarded field alone', async () => {
		const authorize = vi.fn(() => true);
		const result = await run('{ open }', { authorize });

		expect(result.data).toEqual({ open: 'anyone' });
		expect(authorize).not.toHaveBeenCalled();
	});
});

describe('a live operation the catalog guards', () => {
	it('is refused before the source is opened', async () => {
		const source = vi.fn(async function* () {
			yield 1;
		});
		const results: ExecutionResult[] = [];

		for await (const snapshot of subscribe({
			request: 'live L { pulse }',
			catalog,
			sources: { Live: { pulse: source } },
			authorize: () => false,
		})) {
			results.push(snapshot);
		}

		expect(results[0]?.errors?.[0]?.code).toBe(NexErrorCode.FORBIDDEN);
		expect(source).not.toHaveBeenCalled();
	});

	it('is refused when the server said nothing about who may watch it', async () => {
		const source = vi.fn(async function* () {
			yield 1;
		});
		const results: ExecutionResult[] = [];

		for await (const snapshot of subscribe({
			request: 'live L { pulse }',
			catalog,
			sources: { Live: { pulse: source } },
		})) {
			results.push(snapshot);
		}

		expect(results[0]?.errors?.[0]?.code).toBe(NexErrorCode.FORBIDDEN);
		expect(results[0]?.errors?.[0]?.message).toMatch(/no authorizer/i);
		expect(source).not.toHaveBeenCalled();
	});

	it('runs when the authorizer says yes', async () => {
		const results: ExecutionResult[] = [];

		for await (const snapshot of subscribe({
			request: 'live L { pulse }',
			catalog,
			sources: {
				Live: {
					pulse: async function* () {
						yield 7;
					},
				},
			},
			authorize: () => true,
		})) {
			results.push(snapshot);
		}

		expect(results[0]?.data).toEqual({ pulse: 7 });
	});
});

describe('what an authorizer is', () => {
	it('is handed everything it needs to decide', async () => {
		const seen: AuthorizeRequest[] = [];
		await run('{ secret }', {
			authorize: (request: AuthorizeRequest) => {
				seen.push(request);
				return true;
			},
			context: { roles: ['member'] },
		});

		const [request] = seen;
		expect(request?.requires).toBe('member');
		expect(request?.fieldName).toBe('secret');
		expect(request?.parentTypeName).toBe('Query');
		expect(request?.context).toEqual({ roles: ['member'] });
	});
});
