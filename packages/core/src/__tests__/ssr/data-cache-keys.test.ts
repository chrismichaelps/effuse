/**
 * MIT License
 *
 * Copyright (c) 2025 Chris M. Perez
 */

import { describe, expect, it } from 'vitest';
import { createDataCache } from '../../ssr/data-cache.js';

const LIFE = { life: { stale: 60 } } as const;

/** Records the argument lists the wrapped function actually ran for. */
const countingLoader = (): {
	loader: (...args: readonly unknown[]) => Promise<string>;
	runs: () => number;
} => {
	const cache = createDataCache();
	let runs = 0;
	const loader = cache.cached(async (...args: readonly unknown[]) => {
		runs += 1;
		return JSON.stringify(args);
	}, LIFE);
	return { loader, runs: () => runs };
};

describe('data cache key stability', () => {
	it('serves one entry for identical arguments', async () => {
		const { loader, runs } = countingLoader();

		await loader('p', 'q');
		await loader('p', 'q');

		expect(runs()).toBe(1);
	});

	it('treats reordered object keys as one entry', async () => {
		const { loader, runs } = countingLoader();

		await loader({ a: 1, b: 2 });
		await loader({ b: 2, a: 1 });

		expect(runs()).toBe(1);
	});

	it('separates arguments containing the delimiter', async () => {
		const { loader, runs } = countingLoader();

		const first = await loader('a|string:b', 'c');
		const second = await loader('a', 'b|string:c');

		expect(runs()).toBe(2);
		expect(second).not.toBe(first);
	});

	it('separates object keys containing the delimiters', async () => {
		const { loader, runs } = countingLoader();

		const first = await loader({ a: 'x', b: 'y' });
		const second = await loader({ 'a:string:x,b': 'y' });

		expect(runs()).toBe(2);
		expect(second).not.toBe(first);
	});

	it('separates an array from a string that mimics its encoding', async () => {
		const { loader, runs } = countingLoader();

		await loader(['a']);
		await loader('[string:a]');

		expect(runs()).toBe(2);
	});

	it('separates values of different types', async () => {
		const { loader, runs } = countingLoader();

		await loader(5);
		await loader('5');
		await loader(null);
		await loader('null');
		await loader(undefined);
		await loader(true);
		await loader('true');

		expect(runs()).toBe(7);
	});

	/**
	 * Injectivity is the property a cache key must have, so it is asserted over
	 * generated inputs rather than over the handful of collisions found by hand.
	 */
	it('gives every distinct argument list its own entry', async () => {
		const pieces = [
			'a',
			'b',
			'|',
			',',
			':',
			'{',
			'}',
			'[',
			']',
			'string:a',
			'a|string:b',
			'a,b',
			'',
		];

		const argumentLists: unknown[][] = [];
		for (const left of pieces) {
			for (const right of pieces) {
				argumentLists.push([left, right]);
				argumentLists.push([`${left}${right}`]);
				argumentLists.push([{ [left]: right }]);
				argumentLists.push([[left, right]]);
			}
		}

		const cache = createDataCache({ maxEntries: 100_000 });
		const seen = new Map<string, unknown[]>();
		const loader = cache.cached(async (...args: readonly unknown[]) => {
			return JSON.stringify(args);
		}, LIFE);

		for (const args of argumentLists) {
			const serialised = JSON.stringify(args);
			const result = await loader(...args);

			const previous = seen.get(result);
			if (previous !== undefined) {
				expect(
					JSON.stringify(previous),
					`collision between ${JSON.stringify(previous)} and ${serialised}`
				).toBe(serialised);
			}
			seen.set(result, args);
		}

		// Every distinct list produced its own result, so none shared an entry.
		expect(seen.size).toBe(
			new Set(argumentLists.map((args) => JSON.stringify(args))).size
		);
	});
});
