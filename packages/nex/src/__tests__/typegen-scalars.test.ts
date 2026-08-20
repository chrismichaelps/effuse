/**
 * MIT License
 *
 * Copyright (c) 2025 Chris M. Perez
 */

import { describe, expect, it } from 'vitest';
import { buildCatalog, generateCatalogTypes, generateTypes } from '../index.js';

const catalog = buildCatalog(`
	scalar Money
	scalar Json
	input Order { total: Money! }
	type Product @identity {
		id: ID!
		price: Money!
		details: Json?
	}
	type Query {
		product: Product!
		priced(under: Money!): [Product!]! @connection
		ordered(order: Order!): Product!
	}
	schema { query: Query }
`);

describe('a scalar the caller says how to read', () => {
	it('writes the type it was told, not unknown', () => {
		const generated = generateTypes('{ product { price } }', catalog, {
			scalars: { Money: 'number' },
		});

		expect(generated).toMatch(/price: number;/);
		expect(generated).not.toMatch(/price: unknown;/);
	});

	it('writes unknown for one it was told nothing about', () => {
		const generated = generateTypes('{ product { details } }', catalog);

		expect(generated).toMatch(/details: unknown \| null;/);
	});

	it('uses it for a variable too', () => {
		const generated = generateTypes(
			'query P($under: Money!) { priced(under: $under) { id } }',
			catalog,
			{ scalars: { Money: 'number' } }
		);

		expect(generated).toMatch(/under: number;/);
	});

	it('uses it inside an input type', () => {
		const generated = generateTypes(
			'query O($order: Order!) { ordered(order: $order) { id } }',
			catalog,
			{ scalars: { Money: 'number' } }
		);

		expect(generated).toMatch(/total: number;/);
	});

	it('takes a type of any shape, not just a name', () => {
		const generated = generateTypes('{ product { details } }', catalog, {
			scalars: { Json: 'Record<string, unknown>' },
		});

		expect(generated).toMatch(/details: Record<string, unknown> \| null;/);
	});

	it('leaves the scalars the language defines alone', () => {
		const generated = generateTypes('{ product { id } }', catalog, {
			scalars: { ID: 'number' },
		});

		// A catalog cannot redefine what ID means, so neither can this.
		expect(generated).toMatch(/id: string;/);
	});

	it('writes the same types for a whole catalog', () => {
		const generated = generateCatalogTypes(catalog, {
			scalars: { Money: 'number' },
		});

		expect(generated).toMatch(/export type Money = number;/);
	});

	it('leaves a catalog scalar unknown when nothing was said', () => {
		expect(generateCatalogTypes(catalog)).toMatch(
			/export type Json = unknown;/
		);
	});
});

describe('a reference in a generated type', () => {
	it('writes the reference a request asked for', () => {
		const generated = generateTypes('{ product { __ref id } }', catalog);

		expect(generated).toMatch(/__ref: string;/);
	});

	it('writes it on every row of a list', () => {
		const generated = generateTypes(
			'{ priced(under: "1") | page first: 2 { __ref } }',
			catalog,
			{ scalars: { Money: 'number' } }
		);

		expect(generated).toMatch(/__ref: string;/);
	});
});
