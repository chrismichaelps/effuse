/**
 * MIT License
 *
 * Copyright (c) 2025 Chris M. Perez
 */

import { describe, expect, it } from 'vitest';
import { buildCatalog, execute, validateRequest } from '../index.js';
import type { Resolvers } from '../index.js';

const catalog = buildCatalog(`
	type Query { echo(n: Int!): Int! produce: Int! }
	schema { query: Query }
`);

const resolvers = (produced: unknown = 1): Resolvers => ({
	Query: {
		echo: (_source, args) => args.n,
		produce: () => produced,
	},
});

const send = (value: unknown) =>
	execute({
		request: 'query Q($n: Int!) { echo(n: $n) }',
		catalog,
		variables: { n: value },
		resolvers: resolvers(),
	});

const BEYOND = Number.MAX_SAFE_INTEGER + 10;

describe('an integer a caller sent', () => {
	it('takes one that means what it says', async () => {
		const result = await send(Number.MAX_SAFE_INTEGER);

		expect(result.errors).toBeUndefined();
		expect(result.data).toEqual({ echo: Number.MAX_SAFE_INTEGER });
	});

	it('takes a negative one just as far', async () => {
		const result = await send(Number.MIN_SAFE_INTEGER);

		expect(result.data).toEqual({ echo: Number.MIN_SAFE_INTEGER });
	});

	it('refuses one past where a number still means what it says', async () => {
		const result = await send(BEYOND);

		// It came back as a different number than it went out as, and nothing
		// said so: the answer was wrong rather than refused.
		expect(result.data).toBeNull();
		expect(result.errors?.[0]?.message).toMatch(/whole number/i);
	});

	it('refuses one past it the other way', async () => {
		const result = await send(Number.MIN_SAFE_INTEGER - 10);

		expect(result.data).toBeNull();
	});

	it('still refuses a fraction', async () => {
		expect((await send(1.5)).data).toBeNull();
	});
});

describe('an integer written into the request', () => {
	it('is refused past where a number means what it says', () => {
		const problems = validateRequest(
			'{ echo(n: 99999999999999999999) }',
			catalog
		);

		expect(problems.map((one) => one.message)).toEqual([
			expect.stringMatching(/whole number/i),
		]);
	});

	it('is taken up to there', () => {
		expect(
			validateRequest(
				`{ echo(n: ${String(Number.MAX_SAFE_INTEGER)}) }`,
				catalog
			)
		).toEqual([]);
	});
});

describe('an integer a server produced', () => {
	it('is refused rather than sent as a different number', async () => {
		const result = await execute({
			request: '{ produce }',
			catalog,
			resolvers: resolvers(BEYOND),
		});

		expect(result.data).toBeNull();
		expect(result.errors?.[0]?.message).toMatch(/Int/);
	});

	it('is sent when it means what it says', async () => {
		const result = await execute({
			request: '{ produce }',
			catalog,
			resolvers: resolvers(Number.MAX_SAFE_INTEGER),
		});

		expect(result.data).toEqual({ produce: Number.MAX_SAFE_INTEGER });
	});
});
