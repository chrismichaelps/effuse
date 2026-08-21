/**
 * MIT License
 *
 * Copyright (c) 2025 Chris M. Perez
 */

import { describe, expect, it } from 'vitest';
import { buildCatalog, subscribe } from '../index.js';
import type { ExecutionResult, LiveSource } from '../index.js';

const catalog = buildCatalog(`
	type Query { ok: String! }
	type Live { beat: Int! }
	schema { query: Query, live: Live }
`);

const watch = async (source: LiveSource): Promise<ExecutionResult[]> => {
	const seen: ExecutionResult[] = [];
	for await (const snapshot of subscribe({
		request: 'live L { beat }',
		catalog,
		sources: { Live: { beat: source } },
	})) {
		seen.push(snapshot);
		if (seen.length >= 5) break;
	}
	return seen;
};

describe('a source that is not a stream', () => {
	it('says so rather than throwing out of the run', async () => {
		// It reached for the iterator and got undefined, which is a TypeError
		// thrown at whoever was reading rather than a problem they can act on.
		const seen = await watch((() => 42) as unknown as LiveSource);

		expect(seen).toHaveLength(1);
		expect(seen[0]?.errors?.[0]?.message).toMatch(
			/is not something that can be watched/
		);
	});

	it('says which field it was', async () => {
		const seen = await watch((() => 42) as unknown as LiveSource);

		expect(seen[0]?.errors?.[0]?.path).toEqual(['beat']);
	});

	it('says so for a promise of something that is not a stream', async () => {
		const seen = await watch((() =>
			Promise.resolve(42)) as unknown as LiveSource);

		expect(seen[0]?.errors?.[0]?.message).toMatch(/watched/);
	});

	it('says so for nothing at all', async () => {
		const seen = await watch((() => undefined) as unknown as LiveSource);

		expect(seen[0]?.errors?.[0]?.message).toMatch(/watched/);
	});

	it('takes an ordinary async generator', async () => {
		const seen = await watch(async function* () {
			yield 1;
		});

		expect(seen[0]?.data).toEqual({ beat: 1 });
	});

	it('takes one that was promised', async () => {
		const seen = await watch(() =>
			Promise.resolve(
				(async function* () {
					yield 1;
				})()
			)
		);

		expect(seen[0]?.data).toEqual({ beat: 1 });
	});

	it('takes one that happens to be callable as well', async () => {
		// A stream is whatever answers the question, and something may answer
		// it while also being a function - refusing that would be refusing on
		// the strength of what it is rather than what it does.
		const callable = Object.assign(() => undefined, {
			[Symbol.asyncIterator]: async function* () {
				yield 5;
			},
		});

		const seen = await watch(
			() => callable as unknown as AsyncIterable<unknown>
		);

		expect(seen[0]?.data).toEqual({ beat: 5 });
	});

	it('takes anything that says how to be iterated', async () => {
		// Not a generator: an object that answers the question a stream is
		// asked, which is all this ever needed.
		const seen = await watch(() => ({
			[Symbol.asyncIterator]: () => {
				let sent = false;
				return {
					next: () =>
						Promise.resolve(
							sent
								? { done: true, value: undefined }
								: ((sent = true), { done: false, value: 7 })
						),
				};
			},
		}));

		expect(seen[0]?.data).toEqual({ beat: 7 });
	});
});
