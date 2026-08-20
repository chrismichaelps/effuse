/**
 * MIT License
 *
 * Copyright (c) 2025 Chris M. Perez
 */

import { describe, expect, it } from 'vitest';
import {
	buildCatalog,
	createMetrics,
	execute,
	type FieldTrace,
} from '../index.js';

const catalog = buildCatalog(`
	type Author { name: String! }
	type Post { id: ID! title: String! author: Author! }
	type Query { posts: [Post!]! slow: String! broken: String? }
	schema { query: Query }
`);

const resolvers = {
	Query: {
		posts: () => [
			{ id: '1', title: 'first' },
			{ id: '2', title: 'second' },
		],
		slow: async () => {
			await new Promise((resolve) => setTimeout(resolve, 5));
			return 'eventually';
		},
		broken: () => {
			throw new Error('the source is down');
		},
	},
	Post: { author: () => ({ name: 'Ada' }) },
};

const run = (request: string, onField: (trace: FieldTrace) => void) =>
	execute({
		request,
		catalog,
		resolvers,
		instrumentation: { onField },
	});

describe('what each field cost', () => {
	it('reports a field that had a resolver', async () => {
		const seen: FieldTrace[] = [];
		await run('{ posts { title } }', (trace) => seen.push(trace));

		expect(seen.map((one) => one.fieldName)).toContain('posts');
	});

	it('says nothing about a field that only read a property', async () => {
		const seen: FieldTrace[] = [];
		await run('{ posts { title } }', (trace) => seen.push(trace));

		// A property read is free, and reporting each one would swamp both the
		// trace and the run producing it.
		expect(seen.map((one) => one.fieldName)).not.toContain('title');
	});

	it('reports one for every row a resolver ran on', async () => {
		const seen: FieldTrace[] = [];
		await run('{ posts { author { name } } }', (trace) => seen.push(trace));

		const authors = seen.filter((one) => one.fieldName === 'author');
		expect(authors).toHaveLength(2);
	});

	it('says where in the response it was', async () => {
		const seen: FieldTrace[] = [];
		await run('{ posts { author { name } } }', (trace) => seen.push(trace));

		const [first] = seen.filter((one) => one.fieldName === 'author');
		expect(first?.path).toEqual(['posts', 0, 'author']);
		expect(first?.parentTypeName).toBe('Post');
	});

	it('says how long it took', async () => {
		const seen: FieldTrace[] = [];
		await run('{ slow }', (trace) => seen.push(trace));

		expect(seen[0]?.durationMs).toBeGreaterThan(1);
	});

	it('says which run it belongs to', async () => {
		const seen: FieldTrace[] = [];
		const result = await execute({
			request: '{ posts { title } }',
			catalog,
			resolvers,
			traceId: 'the-run',
			instrumentation: { onField: (trace) => seen.push(trace) },
		});

		expect(result.extensions.traceId).toBe('the-run');
		expect(seen[0]?.traceId).toBe('the-run');
	});

	it('reports a field that failed, and says it failed', async () => {
		const seen: FieldTrace[] = [];
		await run('{ broken }', (trace) => seen.push(trace));

		expect(seen[0]?.fieldName).toBe('broken');
		expect(seen[0]?.failed).toBe(true);
	});

	it('says a field that worked did not fail', async () => {
		const seen: FieldTrace[] = [];
		await run('{ posts { title } }', (trace) => seen.push(trace));

		expect(seen[0]?.failed).toBe(false);
	});

	it('never lets a watcher break the run it watches', async () => {
		const result = await run('{ posts { title } }', () => {
			throw new Error('the sink is down');
		});

		expect(result.errors).toBeUndefined();
		expect(result.data).toBeDefined();
	});

	it('costs nothing when nobody is watching', async () => {
		const result = await execute({
			request: '{ posts { title } }',
			catalog,
			resolvers,
		});

		expect(result.errors).toBeUndefined();
	});
});

describe('what a server has seen so far', () => {
	it('counts the runs it watched', async () => {
		const metrics = createMetrics();

		await execute({
			request: '{ posts { title } }',
			catalog,
			resolvers,
			instrumentation: metrics.instrumentation,
		});
		await execute({
			request: '{ posts { title } }',
			catalog,
			resolvers,
			instrumentation: metrics.instrumentation,
		});

		expect(metrics.snapshot().operations.total).toBe(2);
	});

	it('counts the ones that carried problems', async () => {
		const metrics = createMetrics();

		await execute({
			request: '{ broken }',
			catalog,
			resolvers,
			instrumentation: metrics.instrumentation,
		});
		await execute({
			request: '{ posts { title } }',
			catalog,
			resolvers,
			instrumentation: metrics.instrumentation,
		});

		expect(metrics.snapshot().operations.failed).toBe(1);
	});

	it('adds up what the requests cost', async () => {
		const metrics = createMetrics();

		await execute({
			request: '{ posts { title } }',
			catalog,
			resolvers,
			instrumentation: metrics.instrumentation,
		});

		expect(metrics.snapshot().operations.totalCost).toBeGreaterThan(0);
	});

	it('keeps each operation apart by name', async () => {
		const metrics = createMetrics();

		await execute({
			request: 'query Feed { posts { title } }',
			catalog,
			resolvers,
			instrumentation: metrics.instrumentation,
		});
		await execute({
			request: 'query One { posts { id } }',
			catalog,
			resolvers,
			instrumentation: metrics.instrumentation,
		});

		const byName = metrics.snapshot().operations.byName;
		expect(byName.Feed?.total).toBe(1);
		expect(byName.One?.total).toBe(1);
	});

	it('names the slowest field it has seen', async () => {
		const metrics = createMetrics();

		await execute({
			request: '{ slow posts { title } }',
			catalog,
			resolvers,
			instrumentation: metrics.instrumentation,
		});

		const fields = metrics.snapshot().fields;
		expect(fields['Query.slow']?.total).toBe(1);
		expect(fields['Query.slow']?.slowestMs).toBeGreaterThan(1);
	});

	it('counts the fields that failed', async () => {
		const metrics = createMetrics();

		await execute({
			request: '{ broken }',
			catalog,
			resolvers,
			instrumentation: metrics.instrumentation,
		});

		expect(metrics.snapshot().fields['Query.broken']?.failed).toBe(1);
	});

	it('hands back a reading that does not change under it', async () => {
		const metrics = createMetrics();
		await execute({
			request: '{ posts { title } }',
			catalog,
			resolvers,
			instrumentation: metrics.instrumentation,
		});

		const before = metrics.snapshot();
		await execute({
			request: '{ posts { title } }',
			catalog,
			resolvers,
			instrumentation: metrics.instrumentation,
		});

		expect(before.operations.total).toBe(1);
		expect(metrics.snapshot().operations.total).toBe(2);
	});

	it('forgets everything when asked', async () => {
		const metrics = createMetrics();
		await execute({
			request: 'query Feed { posts { title } }',
			catalog,
			resolvers,
			instrumentation: metrics.instrumentation,
		});

		metrics.reset();

		expect(metrics.snapshot().operations.total).toBe(0);
		expect(metrics.snapshot().operations.totalCost).toBe(0);
		expect(metrics.snapshot().operations.byName).toEqual({});
		expect(metrics.snapshot().fields).toEqual({});
	});

	it('holds no more names than it was told to', async () => {
		const metrics = createMetrics({ maxNames: 2 });

		for (const name of ['A', 'B', 'C', 'D']) {
			await execute({
				request: `query ${name} { posts { title } }`,
				catalog,
				resolvers,
				instrumentation: metrics.instrumentation,
			});
		}

		// A name per caller-chosen operation is a way to run a server out of
		// memory, so what is kept is bounded.
		expect(Object.keys(metrics.snapshot().operations.byName)).toHaveLength(2);
		expect(metrics.snapshot().operations.total).toBe(4);
	});
});
