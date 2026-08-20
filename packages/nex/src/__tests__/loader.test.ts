/**
 * MIT License
 *
 * Copyright (c) 2025 Chris M. Perez
 */

import { describe, expect, it, vi } from 'vitest';
import { buildCatalog, createLoader, execute } from '../index.js';

describe('asking for many things at once', () => {
	it('asks once for everything wanted in the same tick', async () => {
		const load = vi.fn(async (keys: readonly string[]) =>
			keys.map((key) => `value:${key}`)
		);
		const loader = createLoader({ load });

		const answers = await Promise.all([
			loader.load('a'),
			loader.load('b'),
			loader.load('c'),
		]);

		expect(load).toHaveBeenCalledTimes(1);
		expect(load.mock.calls[0]?.[0]).toEqual(['a', 'b', 'c']);
		expect(answers).toEqual(['value:a', 'value:b', 'value:c']);
	});

	it('asks once for a key wanted twice', async () => {
		const load = vi.fn(async (keys: readonly string[]) =>
			keys.map((key) => `value:${key}`)
		);
		const loader = createLoader({ load });

		const answers = await Promise.all([
			loader.load('a'),
			loader.load('a'),
			loader.load('b'),
		]);

		expect(load.mock.calls[0]?.[0]).toEqual(['a', 'b']);
		expect(answers).toEqual(['value:a', 'value:a', 'value:b']);
	});

	it('remembers what it has already been told', async () => {
		const load = vi.fn(async (keys: readonly string[]) =>
			keys.map((key) => `value:${key}`)
		);
		const loader = createLoader({ load });

		await loader.load('a');
		await loader.load('a');

		expect(load).toHaveBeenCalledTimes(1);
	});

	it('forgets when told to', async () => {
		const load = vi.fn(async (keys: readonly string[]) =>
			keys.map((key) => `value:${key}`)
		);
		const loader = createLoader({ load });

		await loader.load('a');
		loader.clear('a');
		await loader.load('a');
		loader.clear();
		await loader.load('a');

		expect(load).toHaveBeenCalledTimes(3);
	});

	it('takes many keys at once', async () => {
		const loader = createLoader({
			load: async (keys: readonly string[]) => keys.map((key) => key.length),
		});

		expect(await loader.loadMany(['a', 'bb', 'ccc'])).toEqual([1, 2, 3]);
	});

	it('says nothing for a key the source did not answer', async () => {
		const loader = createLoader({
			load: async (keys: readonly string[]) =>
				keys.map((key) => (key === 'missing' ? undefined : key)),
		});

		expect(await loader.load('missing')).toBeUndefined();
		expect(await loader.load('here')).toBe('here');
	});

	it('keeps a batch to the size it was given', async () => {
		const load = vi.fn(async (keys: readonly string[]) => keys);
		const loader = createLoader({ load, size: 2 });

		await Promise.all(['a', 'b', 'c'].map((key) => loader.load(key)));

		expect(load).toHaveBeenCalledTimes(2);
		expect(load.mock.calls[0]?.[0]).toEqual(['a', 'b']);
		expect(load.mock.calls[1]?.[0]).toEqual(['c']);
	});

	it('names a key that is not a string', async () => {
		const load = vi.fn(async (keys: readonly { id: number }[]) =>
			keys.map((key) => key.id * 2)
		);
		const loader = createLoader({
			load,
			key: (key: { id: number }) => String(key.id),
		});

		const answers = await Promise.all([
			loader.load({ id: 1 }),
			loader.load({ id: 1 }),
			loader.load({ id: 2 }),
		]);

		expect(load.mock.calls[0]?.[0]).toEqual([{ id: 1 }, { id: 2 }]);
		expect(answers).toEqual([2, 2, 4]);
	});
});

describe('when the source cannot answer', () => {
	it('tells everyone waiting on that batch', async () => {
		const loader = createLoader({
			load: async () => {
				throw new Error('the database is down');
			},
		});

		const answers = await Promise.allSettled([
			loader.load('a'),
			loader.load('b'),
		]);

		expect(answers.every((answer) => answer.status === 'rejected')).toBe(true);
		expect((answers[0] as PromiseRejectedResult).reason).toMatchObject({
			message: 'the database is down',
		});
	});

	it('remembers nothing from a batch that failed', async () => {
		let attempts = 0;
		const loader = createLoader({
			load: async (keys: readonly string[]) => {
				attempts += 1;
				if (attempts === 1) throw new Error('transient');
				return keys.map((key) => `value:${key}`);
			},
		});

		await expect(loader.load('a')).rejects.toThrow('transient');
		expect(await loader.load('a')).toBe('value:a');
	});

	it('reports a source that answered the wrong number of things', async () => {
		const loader = createLoader({
			load: async () => ['only one'],
		});

		await expect(
			Promise.all([loader.load('a'), loader.load('b')])
		).rejects.toThrow(/asked for 2 .* answered 1/i);
	});
});

describe('a loader inside a run', () => {
	it('turns a field per row into one call for the lot', async () => {
		const catalog = buildCatalog(`
			type Query { posts: [Post!]! }
			type Post { id: ID! title: String! author: User! }
			type User { id: ID! name: String! }
		`);

		const authorCalls: (readonly string[])[] = [];
		const authors = createLoader({
			load: async (ids: readonly string[]) => {
				authorCalls.push(ids);
				return ids.map((id) => ({ id, name: `author ${id}` }));
			},
		});

		const result = await execute({
			request: '{ posts { title author { name } } }',
			catalog,
			context: { authors },
			resolvers: {
				Query: {
					posts: () =>
						Array.from({ length: 50 }, (_, index) => ({
							id: String(index),
							title: `post ${index}`,
							authorId: String(index % 3),
						})),
				},
				Post: {
					author: (source, _args, context: { authors: typeof authors }) =>
						context.authors.load((source as { authorId: string }).authorId),
				},
			},
		});

		expect(result.errors).toBeUndefined();
		expect(authorCalls).toHaveLength(1);
		expect(authorCalls[0]).toEqual(['0', '1', '2']);
	});
});
