/**
 * MIT License
 *
 * Copyright (c) 2025 Chris M. Perez
 */

import { describe, expect, it } from 'vitest';
import type {
	CoreQueryFunction,
	QueryConfig,
	QueryFunction,
	QueryKey,
	QueryOptions,
} from '@effuse/query';
import {
	buildCatalog,
	createNexClient,
	nexMutation,
	nexQuery,
	nexQueryKey,
} from '../index.js';

const catalog = buildCatalog(`
	type Query { hello: String! }
	type Mutation { touch: Boolean! }
	schema { query: Query, mutation: Mutation }
`);

const nex = createNexClient({
	endpoint: '/nex',
	cache: false,
	fetch: (async () =>
		new Response(
			JSON.stringify({ data: { hello: 'world' }, extensions: { cost: 1 } }),
			{ headers: { 'content-type': 'application/json' } }
		)) as unknown as typeof fetch,
});

void catalog;

describe('what the query package is handed', () => {
	it('is the shape it configures a query with', () => {
		const binding = nexQuery(nex, '{ hello }');

		// The real type, not a copy of it: a binding that stopped fitting what
		// the query package takes would otherwise still pass here, which is
		// the whole reason this file exists.
		const config: QueryConfig<Record<string, unknown>> = binding;

		expect(typeof config.queryFn).toBe('function');
	});

	it('names a request the way a key is named', () => {
		const key: QueryKey = nexQueryKey('{ hello }');

		expect(key[0]).toBe('nex');
	});

	it('is what the hook a component calls takes', () => {
		// useQuery takes QueryOptions, whose queryFn is called with nothing.
		// This is the one that actually matters to anyone writing a component.
		const options: QueryOptions<Record<string, unknown>> = nexQuery(
			nex,
			'{ hello }'
		);

		expect(options.queryKey).toEqual(nexQueryKey('{ hello }'));
	});

	it('runs when it is called with nothing', async () => {
		const { queryFn } = nexQuery(nex, '{ hello }');
		const run: QueryFunction<Record<string, unknown>> = queryFn;

		await expect(run()).resolves.toEqual({ hello: 'world' });
	});

	it('runs when it is handed a way to call it off', async () => {
		const { queryFn } = nexQuery(nex, '{ hello }');
		const run: CoreQueryFunction<Record<string, unknown>> = queryFn;

		await expect(
			run({ signal: new AbortController().signal })
		).resolves.toEqual({ hello: 'world' });
	});

	it('is the shape a change is run with', () => {
		const { mutationFn } = nexMutation<
			Record<string, unknown>,
			Record<string, unknown>
		>(nex, 'mutation { touch }');

		// What useMutation takes, declared where it is declared.
		const taken: {
			readonly mutationFn: (
				variables: Record<string, unknown>
			) => Promise<Record<string, unknown>>;
		} = {
			mutationFn,
		};

		expect(typeof taken.mutationFn).toBe('function');
	});
});
