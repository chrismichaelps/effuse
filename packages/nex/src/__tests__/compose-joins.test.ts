/**
 * MIT License
 *
 * Copyright (c) 2025 Chris M. Perez
 */

import { describe, expect, it, vi } from 'vitest';
import {
	buildCatalog,
	composeServices,
	execute,
	parseRef,
	refFor,
	type ExecutionResult,
	type SelectedField,
} from '../index.js';

const peopleCatalog = buildCatalog(`
	type Author @identity { id: ID! name: String! country: String! }
	type Query { author(id: ID!): Author? }
	schema { query: Query }
`);

/** Posts knows an author exists and nothing about what one is. */
const postsCatalog = buildCatalog(`
	type Author @identity { id: ID! }
	type Post @identity { id: ID! title: String! author: Author! }
	type Query { posts: [Post!]! @connection }
	schema { query: Query }
`);

const authors: Record<string, { id: string; name: string; country: string }> = {
	'7': { id: '7', name: 'Ada', country: 'England' },
	'9': { id: '9', name: 'Grace', country: 'USA' },
};

const people = () => {
	const asked = vi.fn();
	return {
		asked,
		service: {
			catalog: peopleCatalog,
			request: async (): Promise<ExecutionResult> => ({
				data: {},
				extensions: { cost: 0 },
			}),
			resolveRef: async (
				reference: string,
				selection: readonly SelectedField[]
			) => {
				asked(
					reference,
					selection.map((one) => one.name)
				);
				const read = parseRef(reference);
				if (read?.type !== 'Author') return null;
				return authors[read.id] ?? null;
			},
		},
	};
};

/** Posts answers with a reference where an author belongs. */
const posts = (
	rows = [{ id: '1', title: 'On engines', author: refFor('Author', '7') }]
) => ({
	catalog: postsCatalog,
	request: async (): Promise<ExecutionResult> => ({
		data: { posts: { items: rows, pageInfo: {}, totalCount: rows.length } },
		extensions: { cost: 1 },
	}),
});

describe('who owns what', () => {
	it('leaves a service to join its own types itself', async () => {
		const selfJoining = buildCatalog(`
			type Author @identity { id: ID! name: String! mentor: Author? }
			type Query { author(id: ID!): Author? }
			schema { query: Query }
		`);

		const asked = vi.fn();
		const { catalog, resolvers } = composeServices({
			people: {
				catalog: selfJoining,
				request: async (): Promise<ExecutionResult> => ({
					data: { author: { id: '7', name: 'Ada', mentor: { name: 'Grace' } } },
					extensions: { cost: 1 },
				}),
				resolveRef: (reference) => {
					asked(reference);
					return null;
				},
			},
		});

		const result = await execute({
			request: '{ author(id: "7") { name mentor { name } } }',
			catalog,
			resolvers,
		});

		// Both sides are held by one service, so it answered them together and
		// a round trip back to it would undo that.
		expect(result.data).toMatchObject({
			author: { name: 'Ada', mentor: { name: 'Grace' } },
		});
		expect(asked).not.toHaveBeenCalled();
	});

	it('leaves a root field to the service that declared it', async () => {
		const owner = people();
		const postsWithRoot = buildCatalog(`
			type Author @identity { id: ID! }
			type Query { featured: Author! }
			schema { query: Query }
		`);

		const { catalog, resolvers } = composeServices({
			people: owner.service,
			posts: {
				catalog: postsWithRoot,
				request: async (): Promise<ExecutionResult> => ({
					data: { featured: refFor('Author', '9') },
					extensions: { cost: 1 },
				}),
			},
		});

		const result = await execute({
			request: '{ featured { name } }',
			catalog,
			resolvers,
		});

		// The root field is posts's to answer; what it answers with is then
		// joined, rather than the field itself being taken over.
		expect(result.data).toMatchObject({ featured: { name: 'Grace' } });
	});

	it('keeps the first service that can resolve a type', async () => {
		const first = people();
		const second = people();

		const { catalog, resolvers } = composeServices({
			people: first.service,
			mirror: {
				catalog: buildCatalog(`
					type Author @identity { id: ID! name: String! country: String! }
					type Query { other: String! }
					schema { query: Query }
				`),
				request: second.service.request,
				resolveRef: second.service.resolveRef,
			},
			posts: posts(),
		});

		await execute({
			request: '{ posts | page first: 1 { author { name } } }',
			catalog,
			resolvers,
		});

		expect(first.asked).toHaveBeenCalled();
		expect(second.asked).not.toHaveBeenCalled();
	});

	it('leaves a reference alone when nobody can resolve it', async () => {
		const nullable = buildCatalog(`
			type Author @identity { id: ID! }
			type Post @identity { id: ID! author: Author? }
			type Query { post: Post! }
			schema { query: Query }
		`);

		const { catalog, resolvers } = composeServices({
			people: {
				catalog: peopleCatalog,
				request: async (): Promise<ExecutionResult> => ({
					data: {},
					extensions: { cost: 0 },
				}),
			},
			posts: {
				catalog: nullable,
				request: async (): Promise<ExecutionResult> => ({
					data: { post: { id: '1', author: refFor('Author', '7') } },
					extensions: { cost: 1 },
				}),
			},
		});

		const result = await execute({
			request: '{ post { author { id } } }',
			catalog,
			resolvers,
		});

		// Nothing was wired, so the reference reaches the field as it is and
		// fails there rather than quietly becoming nothing.
		// It fails at the field rather than quietly answering with nothing.
		expect(result.errors?.[0]?.message).toBeTruthy();
		expect(result.errors?.[0]?.path?.slice(0, 2)).toEqual(['post', 'author']);
	});
});

describe('a field one service owns on a type another does', () => {
	it('is answered by whoever owns the type', async () => {
		const owner = people();
		const { catalog, resolvers } = composeServices({
			people: owner.service,
			posts: posts(),
		});

		const result = await execute({
			request: '{ posts | page first: 1 { title author { name } } }',
			catalog,
			resolvers,
		});

		expect(result.errors).toBeUndefined();
		expect(result.data).toMatchObject({
			posts: { items: [{ title: 'On engines', author: { name: 'Ada' } }] },
		});
	});

	it('asks for what the request wanted of it', async () => {
		const owner = people();
		const { catalog, resolvers } = composeServices({
			people: owner.service,
			posts: posts(),
		});

		await execute({
			request: '{ posts | page first: 1 { author { name country } } }',
			catalog,
			resolvers,
		});

		expect(owner.asked).toHaveBeenCalledWith(refFor('Author', '7'), [
			'name',
			'country',
		]);
	});

	it('answers each row from the reference that row carried', async () => {
		const owner = people();
		const { catalog, resolvers } = composeServices({
			people: owner.service,
			posts: posts([
				{ id: '1', title: 'first', author: refFor('Author', '7') },
				{ id: '2', title: 'second', author: refFor('Author', '9') },
			]),
		});

		const result = await execute({
			request: '{ posts | page first: 2 { author { name } } }',
			catalog,
			resolvers,
		});

		expect(result.data).toMatchObject({
			posts: {
				items: [{ author: { name: 'Ada' } }, { author: { name: 'Grace' } }],
			},
		});
	});

	it('leaves a value that is already an object alone', async () => {
		const owner = people();
		const { catalog, resolvers } = composeServices({
			people: owner.service,
			posts: {
				catalog: postsCatalog,
				request: async (): Promise<ExecutionResult> => ({
					data: {
						posts: {
							items: [{ id: '1', title: 'x', author: { id: '7' } }],
							pageInfo: {},
							totalCount: 1,
						},
					},
					extensions: { cost: 1 },
				}),
			},
		});

		const result = await execute({
			request: '{ posts | page first: 1 { author { id } } }',
			catalog,
			resolvers,
		});

		// A service that answered with the object itself has already done the
		// work, and asking again would undo that.
		expect(result.data).toMatchObject({
			posts: { items: [{ author: { id: '7' } }] },
		});
		expect(owner.asked).not.toHaveBeenCalled();
	});

	it('says so when the reference points at nothing', async () => {
		const owner = people();
		const { catalog, resolvers } = composeServices({
			people: owner.service,
			posts: posts([
				{ id: '1', title: 'first', author: refFor('Author', '404') },
			]),
		});

		const result = await execute({
			request: '{ posts | page first: 1 { author { name } } }',
			catalog,
			resolvers,
		});

		// The field is non-null, so nothing to answer with is a failure rather
		// than a quiet null.
		expect(result.errors?.[0]?.message).toMatch(/non-null|null/i);
	});

	it('is left alone when the owner cannot resolve a reference', async () => {
		const { catalog, resolvers } = composeServices({
			people: {
				catalog: peopleCatalog,
				request: async (): Promise<ExecutionResult> => ({
					data: {},
					extensions: { cost: 0 },
				}),
			},
			posts: posts(),
		});

		const result = await execute({
			request: '{ posts | page first: 1 { author { name } } }',
			catalog,
			resolvers,
		});

		// Nothing was wired, so the reference reaches the field as it is and
		// fails there rather than being silently dropped.
		expect(result.errors).toBeDefined();
	});
});
