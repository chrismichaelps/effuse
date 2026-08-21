/**
 * MIT License
 *
 * Copyright (c) 2025 Chris M. Perez
 */

import { describe, expect, it } from 'vitest';
import {
	buildCatalog,
	execute,
	generateTypes,
	validateRequest,
} from '../index.js';

const catalog = buildCatalog(`
	type Cat { id: ID! lives: Int! name: String! }
	type Dog { id: ID! good: Boolean! name: String! }
	union Pet = Cat | Dog
	type Query { pet: Pet! }
	schema { query: Query }
`);

const run = (request: string) =>
	execute({
		request,
		catalog,
		resolvers: {
			Query: {
				pet: () => ({ __typename: 'Dog', id: '1', good: true, name: 'Rex' }),
			},
		},
	});

describe('a type written for a request with branches', () => {
	it('says how to tell them apart only when the request can', () => {
		const generated = generateTypes(
			'{ pet { __typename ... on Cat { lives } ... on Dog { good } } }',
			catalog
		);

		expect(generated).toContain("__typename: 'Cat';");
		expect(generated).toContain("__typename: 'Dog';");
	});

	it('does not promise a discriminant the response will not carry', () => {
		const generated = generateTypes(
			'{ pet { ... on Cat { lives } ... on Dog { good } } }',
			catalog
		);

		// The request never asked for it, so the response has none, and a
		// type saying otherwise is a type that lies.
		expect(generated).not.toContain('__typename');
	});

	it('carries the discriminant when it was asked for', async () => {
		const result = await run('{ pet { __typename ... on Dog { good } } }');

		expect(result.data).toEqual({ pet: { __typename: 'Dog', good: true } });
	});

	it('carries nothing extra when it was not', async () => {
		const result = await run('{ pet { ... on Dog { good } } }');

		expect(result.data).toEqual({ pet: { good: true } });
	});
});

describe('one name answering with different kinds of value', () => {
	it('is refused when nothing in the request can tell them apart', () => {
		const problems = validateRequest('{ pet { x: lives } }', catalog);

		// Selecting a field of one member directly on the union is its own
		// problem; this is the shape that matters.
		expect(problems.length).toBeGreaterThan(0);
	});

	it('is refused across branches without a discriminant', () => {
		const problems = validateRequest(
			'{ pet { ... on Cat { x: lives } ... on Dog { x: good } } }',
			catalog
		);

		expect(problems.map((one) => one.message)).toEqual([
			expect.stringMatching(/"x" answers with .* select "__typename"/),
		]);
	});

	it('is allowed when the request asks how to tell them apart', () => {
		const problems = validateRequest(
			'{ pet { __typename ... on Cat { x: lives } ... on Dog { x: good } } }',
			catalog
		);

		// Given a discriminant, a caller can read the answer, and the types
		// written for it are a union they can narrow.
		expect(problems).toEqual([]);
	});

	it('is allowed when the branches agree on the shape', () => {
		const problems = validateRequest(
			'{ pet { ... on Cat { x: name } ... on Dog { x: name } } }',
			catalog
		);

		expect(problems).toEqual([]);
	});

	it('writes a union a caller can narrow when it is allowed', () => {
		const generated = generateTypes(
			'{ pet { __typename ... on Cat { x: lives } ... on Dog { x: good } } }',
			catalog
		);

		expect(generated).toContain("__typename: 'Cat';");
		expect(generated).toMatch(/x: number;/);
		expect(generated).toMatch(/x: boolean;/);
	});
});
