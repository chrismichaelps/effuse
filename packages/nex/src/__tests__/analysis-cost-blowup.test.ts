/**
 * MIT License
 *
 * Copyright (c) 2025 Chris M. Perez
 */

import { describe, expect, it } from 'vitest';
import { analyzeRequest, buildCatalog, validateRequest } from '../index.js';

const catalog = buildCatalog(`
	type Row { id: ID! kids: [Row!]! @connection }
	type Query { rows: [Row!]! @connection }
	schema { query: Query }
`);

/**
 * A request that names one fragment twice at each level.
 *
 * Small to write and enormous to walk: each level doubles how many times the
 * one below it is reached, so a few hundred bytes describe millions of paths.
 */
const doubling = (levels: number): string => {
	let source = 'fragment F0 on Row { id }';
	for (let level = 1; level <= levels; level += 1) {
		source += `\nfragment F${String(level)} on Row {
			a: kids | page first: 2 { ...F${String(level - 1)} }
			b: kids | page first: 2 { ...F${String(level - 1)} }
		}`;
	}
	return `${source}\n{ rows | page first: 2 { ...F${String(levels)} } }`;
};

describe('a request that is small to write and enormous to walk', () => {
	it('is priced without walking every path', () => {
		const started = performance.now();
		analyzeRequest(doubling(18), catalog);
		const took = performance.now() - started;

		// Walking each spread where it appears took seconds at this size and
		// grew fourfold every two levels, which is a request of a few hundred
		// bytes holding a server for as long as it likes - and it happens
		// while working out the cost, before any limit on cost can refuse it.
		expect(took).toBeLessThan(500);
	});

	it('still prices it as the enormous thing it is', () => {
		// The point is not to make it cheap, it is to find out that it is
		// expensive without paying for it.
		expect(analyzeRequest(doubling(20), catalog).cost).toBeGreaterThan(
			1_000_000_000
		);
	});

	it('is checked without walking every path either', () => {
		const started = performance.now();
		validateRequest(doubling(18), catalog);
		const took = performance.now() - started;

		expect(took).toBeLessThan(500);
	});

	it('holds a fragment to the limit wherever it is read', () => {
		// The same fragment read twice: once where what it adds still fits,
		// and once further down where it does not. Remembering the first
		// answer under the fragment's name alone would let the second past a
		// limit it does not meet.
		const shallow = `fragment One on __Type { fields { name } }
			{ near: __type(name: "Row") { ...One } }`;

		const both = `fragment One on __Type { fields { name } }
			{
				near: __type(name: "Row") { ...One }
				far: __type(name: "Row") { fields { type { fields { type { ...One } } } } }
			}`;

		// On its own the fragment is well within the limit, so what is
		// remembered about it is "fine". Further down it is not, and reading
		// the earlier answer back would let it through.
		expect(validateRequest(shallow, catalog)).toEqual([]);
		expect(validateRequest(both, catalog).length).toBeGreaterThan(0);
	});

	it('prices a small one exactly as before', () => {
		expect(analyzeRequest('{ rows | page first: 10 { id } }', catalog)).toEqual(
			{ cost: 11, depth: 2 }
		);
	});

	it('prices one fragment used twice as twice', () => {
		const once = analyzeRequest(
			'fragment F on Row { id } { rows | page first: 2 { ...F } }',
			catalog
		).cost;
		const twice = analyzeRequest(
			'fragment F on Row { id } { rows | page first: 2 { a: kids | page first: 2 { ...F } b: kids | page first: 2 { ...F } } }',
			catalog
		).cost;

		expect(twice).toBeGreaterThan(once);
	});

	it('says how deep it goes', () => {
		expect(analyzeRequest(doubling(6), catalog).depth).toBeGreaterThan(6);
	});

	it('says how deep it goes when the deepest use is not the first', () => {
		// The fragment is met at the top first, so that is what gets
		// remembered - and the use that actually reaches furthest comes
		// later, through the remembered answer rather than a fresh walk.
		const shallowFirst = analyzeRequest(
			`fragment F on Row { kids | page first: 2 { id } }
			{
				near: rows | page first: 2 { ...F }
				far: rows | page first: 2 { kids | page first: 2 { kids | page first: 2 { ...F } } }
			}`,
			catalog
		);

		const withoutIt = analyzeRequest(
			`{ rows | page first: 2 { kids | page first: 2 { kids | page first: 2 { id } } } }`,
			catalog
		);

		expect(shallowFirst.depth).toBeGreaterThan(withoutIt.depth);
	});
});
