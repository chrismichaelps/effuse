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
	type SelectedField,
} from '../index.js';

const catalog = buildCatalog(`
	type Comment { id: ID! body: String! }
	type Post { id: ID! rank: Int! comments: [Comment!]! @connection }
	type Query { posts: [Post!]! @connection }
	schema { query: Query }
`);

describe('what a resolver is told about a pipeline', () => {
	it('says the stages written on the field itself', async () => {
		let seen: readonly string[] = [];

		await execute({
			request: '{ posts | sort rank asc | page first: 2 { id } }',
			catalog,
			resolvers: {
				Query: {
					posts: (_s, _a, _c, info) => {
						seen = info.pipeline;
						return [];
					},
				},
			},
		});

		expect(seen).toEqual(['sort rank asc', 'page first: 2']);
	});

	it('says nothing for a field with no pipeline', async () => {
		let seen: readonly string[] | undefined;

		await execute({
			request: '{ posts { id } }',
			catalog,
			resolvers: {
				Query: {
					posts: (_s, _a, _c, info) => {
						seen = info.pipeline;
						return [];
					},
				},
			},
		});

		expect(seen).toEqual([]);
	});

	it('says the stages written below it too', async () => {
		let seen: readonly SelectedField[] = [];

		await execute({
			request: '{ posts { comments | take 3 { body } } }',
			catalog,
			resolvers: {
				Query: {
					posts: (_s, _a, _c, info) => {
						seen = info.selection();
						return [];
					},
				},
			},
		});

		expect(seen[0]?.name).toBe('comments');
		expect(seen[0]?.pipeline).toEqual(['take 3']);
	});
});

describe('a pipeline that crossed a service boundary', () => {
	const forwarding = (data: Record<string, unknown>) => {
		const sent: string[] = [];
		const service = {
			catalog,
			request: async (payload: { query: string }): Promise<ExecutionResult> => {
				sent.push(payload.query);
				return { data, extensions: { cost: 1 } };
			},
		};
		return { service, sent };
	};

	it('is asked of the service that owns the field', async () => {
		const { service, sent } = forwarding({ posts: [] });
		const composed = composeServices({ blog: service });

		await execute({
			request: '{ posts | sort rank asc | page first: 2 { id } }',
			catalog: composed.catalog,
			resolvers: composed.resolvers,
		});

		expect(sent[0]).toBe(
			'query { posts | sort rank asc | page first: 2 { id } }'
		);
	});

	it('carries a pipeline written below it', async () => {
		const { service, sent } = forwarding({ posts: [] });
		const composed = composeServices({ blog: service });

		await execute({
			request: '{ posts { comments | take 3 { body } } }',
			catalog: composed.catalog,
			resolvers: composed.resolvers,
		});

		expect(sent[0]).toBe('query { posts { comments | take 3 { body } } }');
	});

	it('asks plainly when nothing narrows it', async () => {
		const { service, sent } = forwarding({ posts: [] });
		const composed = composeServices({ blog: service });

		await execute({
			request: '{ posts { id } }',
			catalog: composed.catalog,
			resolvers: composed.resolvers,
		});

		expect(sent[0]).toBe('query { posts { id } }');
	});

	it('answers with what the service already narrowed', async () => {
		const { service } = forwarding({
			posts: {
				items: [{ id: '1' }, { id: '2' }],
				pageInfo: {
					hasNextPage: false,
					hasPreviousPage: false,
					startCursor: null,
					endCursor: null,
				},
				totalCount: 2,
			},
		});
		const composed = composeServices({ blog: service });

		const result = await execute({
			request: '{ posts | page first: 2 { id } }',
			catalog: composed.catalog,
			resolvers: composed.resolvers,
		});

		// The service applied the pipeline, so what came back is already the
		// page: applying it again here would page a page.
		expect(result.errors).toBeUndefined();
		expect(result.data).toEqual({
			posts: {
				items: [{ id: '1' }, { id: '2' }],
				pageInfo: {
					hasNextPage: false,
					hasPreviousPage: false,
					startCursor: null,
					endCursor: null,
				},
				totalCount: 2,
			},
		});
	});
});
