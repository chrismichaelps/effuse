/**
 * MIT License
 *
 * Copyright (c) 2025 Chris M. Perez
 */

import { describe, expect, it } from 'vitest';
// `paginate` is reached through a field pipeline in every other test; here it
// is called directly, which is the only way to hand it a cursor that is not
// even a string.
import { paginate } from '../execution/index.js';
import {
	NexErrorCode,
	buildCatalog,
	buildCatalogSafe,
	execute,
	handleHttpRequest,
	parseSafe,
	validateRequest,
} from '../index.js';

const catalog = buildCatalog(`
	type Query { posts: [Post!]! @connection hello: String! maybe: String }
	type Post { id: ID! title: String! }
`);

describe('every error says what kind it is', () => {
	it('marks a syntax error', () => {
		const result = parseSafe('{ user(');
		if (result.success) return expect.unreachable();

		expect(result.error.code).toBe(NexErrorCode.SYNTAX);
	});

	it('marks a catalog error', () => {
		const result = buildCatalogSafe('type Query { a: Missing }');

		expect(result.success).toBe(false);
		expect(
			result.success ? [] : result.errors.map((error) => error.code)
		).toEqual([NexErrorCode.CATALOG]);
	});

	it('marks a validation error', () => {
		expect(validateRequest('{ nope }', catalog)[0]?.code).toBe(
			NexErrorCode.VALIDATION
		);
	});

	it('marks the limits apart from other validation problems', () => {
		expect(
			validateRequest('{ posts | page first: 50 { title } }', catalog, {
				maxCost: 5,
			})[0]?.code
		).toBe(NexErrorCode.COST_LIMIT);
		expect(
			validateRequest('{ posts | page first: 1 { title } }', catalog, {
				maxDepth: 1,
			})[0]?.code
		).toBe(NexErrorCode.DEPTH_LIMIT);
	});
});

describe('errors raised while running', () => {
	it('marks a resolver that threw', async () => {
		const result = await execute({
			request: '{ maybe }',
			catalog,
			resolvers: {
				Query: {
					maybe: () => {
						throw new Error('lookup failed');
					},
				},
			},
		});

		expect(result.errors?.[0]?.code).toBe(NexErrorCode.RESOLVER);
	});

	it('marks a non-null field that produced null', async () => {
		const result = await execute({
			request: '{ hello }',
			catalog,
			resolvers: { Query: { hello: () => null } },
		});

		expect(result.errors?.[0]?.code).toBe(NexErrorCode.NON_NULL);
	});

	it('marks a cursor it did not hand out', async () => {
		const result = await execute({
			request: '{ posts | page first: 1 after: "nonsense" { id } }',
			catalog,
			resolvers: { Query: { posts: () => [] } },
		});

		expect(result.errors?.[0]?.code).toBe(NexErrorCode.CURSOR);
	});

	it('marks a cursor that is not a cursor at all', () => {
		expect(() =>
			paginate(
				[],
				{
					kind: 'PageStage',
					arguments: [
						{
							kind: 'Argument',
							name: { kind: 'Name', value: 'after' },
							value: { kind: 'IntValue', value: '5' },
						},
					],
				},
				{},
				['posts']
			)
		).toThrowError(
			expect.objectContaining({ code: NexErrorCode.CURSOR }) as Error
		);
	});

	it('marks a variable that does not fit', async () => {
		const result = await execute({
			request: 'query A($n: Int!) { posts | take $n { id } }',
			catalog,
			resolvers: { Query: { posts: () => [] } },
			variables: { n: 'not a number' },
		});

		expect(result.errors?.[0]?.code).toBe(NexErrorCode.VARIABLE);
	});

	it('marks a required variable that was not supplied', async () => {
		const result = await execute({
			request: 'query A($n: Int!) { posts | take $n { id } }',
			catalog,
			resolvers: { Query: { posts: () => [] } },
		});

		expect(result.errors?.[0]?.code).toBe(NexErrorCode.VARIABLE);
	});
});

describe('what a client sees on the wire', () => {
	it('carries the code in the response', async () => {
		const result = await execute({
			request: '{ maybe }',
			catalog,
			resolvers: {
				Query: {
					maybe: () => {
						throw new Error('lookup failed');
					},
				},
			},
		});

		expect(JSON.parse(JSON.stringify(result.errors?.[0]))).toMatchObject({
			message: 'lookup failed',
			path: ['maybe'],
			extensions: { code: NexErrorCode.RESOLVER },
		});
	});

	it('carries it through the HTTP handler', async () => {
		const response = await handleHttpRequest(
			{
				method: 'POST',
				url: '/nex',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({ query: '{ nope }' }),
			},
			{ catalog }
		);

		expect(JSON.parse(response.body ?? '')).toMatchObject({
			errors: [{ extensions: { code: NexErrorCode.VALIDATION } }],
		});
	});

	it('lets a server keep its own extensions alongside the code', async () => {
		const result = await execute({
			request: '{ maybe }',
			catalog,
			resolvers: {
				Query: {
					maybe: () => {
						throw new Error('leaky');
					},
				},
			},
			formatError: (error) =>
				Object.assign(error, {
					extensions: { ...error.extensions, safe: true },
				}),
		});

		expect(JSON.parse(JSON.stringify(result.errors?.[0])).extensions).toEqual({
			code: NexErrorCode.RESOLVER,
			safe: true,
		});
	});
});
