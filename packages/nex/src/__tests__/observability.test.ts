/**
 * MIT License
 *
 * Copyright (c) 2025 Chris M. Perez
 */

import { describe, expect, it, vi } from 'vitest';
import { buildCatalog, execute, subscribe } from '../index.js';
import type { OperationTrace } from '../index.js';

const catalog = buildCatalog(`
	schema { query: Query live: Live }
	type Query { hello: String! slow: String! broken: String posts: [Post!]! }
	type Post { id: ID! title: String! }
	type Live { ticks: Int! }
`);

const resolvers = {
	Query: {
		hello: () => 'world',
		slow: async () => {
			await new Promise((resolve) => setTimeout(resolve, 5));
			return 'eventually';
		},
		broken: () => {
			throw new Error('resolver failed');
		},
		posts: () => [{ id: '1', title: 'first' }],
	},
};

describe('what a run reports about itself', () => {
	it('carries a trace a caller can follow', async () => {
		const result = await execute({ request: '{ hello }', catalog, resolvers });

		expect(typeof result.extensions.traceId).toBe('string');
		expect(String(result.extensions.traceId).length).toBeGreaterThan(8);
	});

	it('gives each run its own trace', async () => {
		const [first, second] = await Promise.all([
			execute({ request: '{ hello }', catalog, resolvers }),
			execute({ request: '{ hello }', catalog, resolvers }),
		]);

		expect(first.extensions.traceId).not.toBe(second.extensions.traceId);
	});

	it('carries the trace a server already had', async () => {
		const result = await execute({
			request: '{ hello }',
			catalog,
			resolvers,
			traceId: 'request-42',
		});

		expect(result.extensions.traceId).toBe('request-42');
	});
});

describe('watching a run happen', () => {
	it('says when a run started and what it cost', async () => {
		const traces: OperationTrace[] = [];

		await execute({
			request: '{ hello }',
			catalog,
			resolvers,
			instrumentation: { onOperation: (trace) => traces.push(trace) },
		});

		const [trace] = traces;
		expect(trace?.operation).toBe('query');
		expect(trace?.operationName).toBeUndefined();
		expect(trace?.cost).toBe(1);
		expect(trace?.durationMs).toBeGreaterThanOrEqual(0);
		expect(trace?.traceId).toBeDefined();
		expect(trace?.errorCount).toBe(0);
	});

	it('names the operation it ran', async () => {
		const traces: OperationTrace[] = [];

		await execute({
			request: 'query Greeting { hello }',
			catalog,
			resolvers,
			instrumentation: { onOperation: (trace) => traces.push(trace) },
		});

		expect(traces[0]?.operationName).toBe('Greeting');
	});

	it('counts the fields that failed', async () => {
		const traces: OperationTrace[] = [];

		await execute({
			request: '{ broken hello }',
			catalog,
			resolvers,
			instrumentation: { onOperation: (trace) => traces.push(trace) },
		});

		expect(traces[0]?.errorCount).toBe(1);
	});

	it('reports a request that never ran', async () => {
		const traces: OperationTrace[] = [];

		await execute({
			request: '{ nope }',
			catalog,
			resolvers,
			instrumentation: { onOperation: (trace) => traces.push(trace) },
		});

		expect(traces[0]?.errorCount).toBe(1);
		expect(traces[0]?.ran).toBe(false);
	});

	it('hands over each field that failed, with where it was', async () => {
		const failures: { path: readonly (string | number)[]; message: string }[] =
			[];

		await execute({
			request: '{ broken }',
			catalog,
			resolvers,
			instrumentation: {
				onFieldError: (error) => {
					failures.push({ path: error.path, message: error.message });
				},
			},
		});

		expect(failures).toEqual([
			{ path: ['broken'], message: 'resolver failed' },
		]);
	});

	it('reports every snapshot of a live operation', async () => {
		const traces: OperationTrace[] = [];

		for await (const _snapshot of subscribe({
			request: 'live L { ticks }',
			catalog,
			sources: {
				Live: {
					ticks: async function* () {
						yield 1;
						yield 2;
					},
				},
			},
			instrumentation: { onOperation: (trace) => traces.push(trace) },
		})) {
			// reading is enough
		}

		expect(traces).toHaveLength(2);
		expect(traces.every((trace) => trace.operation === 'live')).toBe(true);
	});

	it('never lets watching break the run it watches', async () => {
		const result = await execute({
			request: '{ hello }',
			catalog,
			resolvers,
			instrumentation: {
				onOperation: () => {
					throw new Error('the telemetry sink is down');
				},
			},
		});

		expect(result.data).toEqual({ hello: 'world' });
		expect(result.errors).toBeUndefined();
	});

	it('costs nothing when nobody is watching', async () => {
		const onOperation = vi.fn();
		await execute({ request: '{ hello }', catalog, resolvers });

		expect(onOperation).not.toHaveBeenCalled();
	});
});
