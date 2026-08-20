/**
 * MIT License
 *
 * Copyright (c) 2025 Chris M. Perez
 */

import { describe, expect, it } from 'vitest';
import {
	applyPatch,
	buildCatalog,
	diffValues,
	execute,
	subscribe,
} from '../index.js';
import type { ExecutionResult, LiveSources } from '../index.js';

const catalog = buildCatalog(`
	schema { query: Query live: Live }
	type Query { board: Board! }
	type Live { board: Board! }
	type Board { name: String! score: Int! players: [Player!]! }
	type Player { id: ID! name: String! score: Int! }
`);

const boards = [
	{
		name: 'first',
		score: 1,
		players: [
			{ id: 'a', name: 'Ada', score: 1 },
			{ id: 'b', name: 'Bo', score: 2 },
		],
	},
	{
		name: 'first',
		score: 4,
		players: [
			{ id: 'a', name: 'Ada', score: 3 },
			{ id: 'b', name: 'Bo', score: 2 },
			{ id: 'c', name: 'Cy', score: 9 },
		],
	},
	{
		name: 'second',
		score: 4,
		players: [{ id: 'a', name: 'Ada', score: 3 }],
	},
];

const sources: LiveSources = {
	Live: {
		board: async function* () {
			for (const board of boards) {
				await Promise.resolve();
				yield board;
			}
		},
	},
};

const request = 'live B { board { name score players { id name score } } }';

const collect = async (
	stream: AsyncIterable<ExecutionResult>
): Promise<readonly ExecutionResult[]> => {
	const results: ExecutionResult[] = [];
	for await (const result of stream) results.push(result);
	return results;
};

describe('describing what changed', () => {
	it('says nothing when nothing changed', () => {
		expect(diffValues({ a: 1 }, { a: 1 })).toEqual([]);
	});

	it('reports a leaf that took a new value', () => {
		expect(diffValues({ a: 1 }, { a: 2 })).toEqual([
			{ op: 'set', path: ['a'], value: 2 },
		]);
	});

	it('reports a key that arrived and one that left', () => {
		expect(diffValues({ a: 1 }, { a: 1, b: 2 })).toEqual([
			{ op: 'set', path: ['b'], value: 2 },
		]);
		expect(diffValues({ a: 1, b: 2 }, { a: 1 })).toEqual([
			{ op: 'remove', path: ['b'] },
		]);
	});

	it('reaches into nested values', () => {
		expect(diffValues({ a: { b: { c: 1 } } }, { a: { b: { c: 2 } } })).toEqual([
			{ op: 'set', path: ['a', 'b', 'c'], value: 2 },
		]);
	});

	it('reports the items of a list that changed, and its new length', () => {
		expect(diffValues({ xs: [1, 2] }, { xs: [1, 3] })).toEqual([
			{ op: 'set', path: ['xs', 1], value: 3 },
		]);
		expect(diffValues({ xs: [1] }, { xs: [1, 2] })).toEqual([
			{ op: 'set', path: ['xs', 1], value: 2 },
		]);
		expect(diffValues({ xs: [1, 2] }, { xs: [1] })).toEqual([
			{ op: 'remove', path: ['xs', 1] },
		]);
	});

	it('replaces a value that changed shape', () => {
		expect(diffValues({ a: { b: 1 } }, { a: [1] })).toEqual([
			{ op: 'set', path: ['a'], value: [1] },
		]);
		expect(diffValues({ a: 1 }, { a: null })).toEqual([
			{ op: 'set', path: ['a'], value: null },
		]);
	});
});

describe('applying what changed', () => {
	it('rebuilds the value the patch was made from', () => {
		for (const [previous, next] of [
			[{ a: 1 }, { a: 2 }],
			[{ a: { b: [1, 2] } }, { a: { b: [1, 2, 3] } }],
			[{ a: [1, 2, 3] }, { a: [1] }],
			[{ a: 1, b: 2 }, { b: 2 }],
			[{ a: { b: 1 } }, { a: null }],
		] as const) {
			expect(applyPatch(previous, diffValues(previous, next))).toEqual(next);
		}
	});

	it('leaves what it was given untouched', () => {
		const previous = { a: 1 };
		applyPatch(previous, [{ op: 'set', path: ['a'], value: 2 }]);

		expect(previous).toEqual({ a: 1 });
	});

	it('leaves a list it was given untouched', () => {
		const previous = { xs: [1, 2], nested: [{ score: 1 }] };

		applyPatch(previous, [
			{ op: 'set', path: ['xs', 1], value: 3 },
			{ op: 'set', path: ['nested', 0, 'score'], value: 9 },
			{ op: 'remove', path: ['xs', 0] },
		]);

		expect(previous).toEqual({ xs: [1, 2], nested: [{ score: 1 }] });
	});
});

describe('a live operation that sends only what changed', () => {
	it('sends a full snapshot first, then patches', async () => {
		const results = await collect(
			subscribe({ request, catalog, sources, delivery: 'differential' })
		);

		expect(results).toHaveLength(3);
		expect(results[0]?.data).toMatchObject({
			board: { name: 'first', score: 1 },
		});
		expect(results[0]?.patch).toBeUndefined();
		expect(results[1]?.data).toBeUndefined();
		expect(results[1]?.patch).toEqual(
			expect.arrayContaining([
				{ op: 'set', path: ['board', 'score'], value: 4 },
				{ op: 'set', path: ['board', 'players', 0, 'score'], value: 3 },
			])
		);
	});

	it('produces the same snapshots a client would have received', async () => {
		const snapshots = await collect(subscribe({ request, catalog, sources }));
		const patched = await collect(
			subscribe({ request, catalog, sources, delivery: 'differential' })
		);

		let rebuilt = patched[0]?.data as Record<string, unknown>;
		expect(rebuilt).toEqual(snapshots[0]?.data);

		for (const result of patched.slice(1)) {
			rebuilt = applyPatch(rebuilt, result.patch ?? []) as Record<
				string,
				unknown
			>;
		}

		expect(rebuilt).toEqual(snapshots.at(-1)?.data);
	});

	it('sends a snapshot again when a snapshot could not be produced', async () => {
		const failing: LiveSources = {
			Live: {
				board: async function* () {
					yield boards[0];
					yield { name: 'broken', score: 'not a number', players: [] };
					yield boards[1];
				},
			},
		};
		const results = await collect(
			subscribe({
				request,
				catalog,
				sources: failing,
				delivery: 'differential',
			})
		);

		expect(results[1]?.data).toBeNull();
		expect(results[1]?.errors).toBeDefined();
		expect(results[2]?.data).toMatchObject({ board: { score: 4 } });
		expect(results[2]?.patch).toBeUndefined();
	});

	it('keeps sending whole snapshots by default', async () => {
		const results = await collect(subscribe({ request, catalog, sources }));

		expect(results.every((result) => result.patch === undefined)).toBe(true);
		expect(results.every((result) => result.data !== null)).toBe(true);
	});
});

describe('what a server says it can do', () => {
	it('reports the optional features through introspection', async () => {
		const result = await execute({
			request: '{ __schema { features { name supported description } } }',
			catalog,
		});
		const features = (
			result.data as {
				__schema: { features: { name: string; supported: boolean }[] };
			}
		).__schema.features;

		expect(features.map((feature) => feature.name)).toEqual([
			'costAnalysis',
			'differentialLive',
			'transactions',
			'introspection',
		]);
		expect(
			features.every((feature) => typeof feature.supported === 'boolean')
		).toBe(true);
	});
});
