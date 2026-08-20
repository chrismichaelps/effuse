/**
 * MIT License
 *
 * Copyright (c) 2025 Chris M. Perez
 */

import { describe, expect, it } from 'vitest';
import { buildCatalog, execute, type SelectedField } from '../index.js';

const catalog = buildCatalog(`
	type Address { city: String! street: String! }
	type Person @identity {
		id: ID!
		name: String!
		nickname: String?
		address: Address!
	}
	type Query { person: Person! people: [Person!]! @connection }
	schema { query: Query }
`);

/** Run a request and hand back what the root resolver was told was wanted. */
const asked = async (
	request: string,
	variables?: Record<string, unknown>
): Promise<readonly SelectedField[]> => {
	let seen: readonly SelectedField[] = [];

	await execute({
		request,
		catalog,
		...(variables === undefined ? {} : { variables }),
		resolvers: {
			Query: {
				person: (_source, _args, _context, info) => {
					seen = info.selection();
					return {
						id: '1',
						name: 'Ada',
						nickname: null,
						address: { city: 'London', street: 'Regent' },
					};
				},
				people: (_source, _args, _context, info) => {
					seen = info.selection();
					return [];
				},
			},
		},
	});

	return seen;
};

const names = (fields: readonly SelectedField[]) =>
	fields.map((field) => field.name);

describe('what a resolver was asked for', () => {
	it('names the fields directly selected', async () => {
		expect(names(await asked('{ person { id name } }'))).toEqual([
			'id',
			'name',
		]);
	});

	it('leaves out what was not asked for', async () => {
		expect(names(await asked('{ person { id } }'))).not.toContain('nickname');
	});

	it('carries what was asked for below', async () => {
		const [, address] = await asked('{ person { id address { city } } }');

		expect(address?.name).toBe('address');
		expect(names(address?.fields ?? [])).toEqual(['city']);
	});

	it('says both the field and the name it answers under', async () => {
		const [first] = await asked('{ person { who: name } }');

		expect(first?.name).toBe('name');
		expect(first?.alias).toBe('who');
	});

	it('answers under its own name when there is no alias', async () => {
		const [first] = await asked('{ person { name } }');

		expect(first?.alias).toBe('name');
	});

	it('follows a fragment as if it were written inline', async () => {
		const fields = await asked(`
			fragment Details on Person { name address { city } }
			{ person { id ...Details } }
		`);

		expect(names(fields)).toEqual(['id', 'name', 'address']);
	});

	it('follows an inline fragment too', async () => {
		const fields = await asked('{ person { id ... on Person { name } } }');

		expect(names(fields)).toEqual(['id', 'name']);
	});

	it('leaves out a field the request skipped', async () => {
		const fields = await asked(
			'query P($skip: Boolean!) { person { id name @skip(if: $skip) } }',
			{ skip: true }
		);

		expect(names(fields)).toEqual(['id']);
	});

	it('keeps a field the request included', async () => {
		const fields = await asked(
			'query P($yes: Boolean!) { person { id name @include(if: $yes) } }',
			{ yes: true }
		);

		expect(names(fields)).toEqual(['id', 'name']);
	});

	it('says what a field was asked with', async () => {
		const catalogWithArgs = buildCatalog(`
			type Person { name(upper: Boolean?): String! }
			type Query { person: Person! }
			schema { query: Query }
		`);

		let seen: readonly SelectedField[] = [];
		await execute({
			request: '{ person { name(upper: true) } }',
			catalog: catalogWithArgs,
			resolvers: {
				Query: {
					person: (_s, _a, _c, info) => {
						seen = info.selection();
						return { name: 'Ada' };
					},
				},
			},
		});

		expect(seen[0]?.arguments).toEqual({ upper: true });
	});

	it('reads an argument that came from a variable', async () => {
		const catalogWithArgs = buildCatalog(`
			type Person { name(upper: Boolean?): String! }
			type Query { person: Person! }
			schema { query: Query }
		`);

		let seen: readonly SelectedField[] = [];
		await execute({
			request: 'query P($up: Boolean!) { person { name(upper: $up) } }',
			catalog: catalogWithArgs,
			variables: { up: true },
			resolvers: {
				Query: {
					person: (_s, _a, _c, info) => {
						seen = info.selection();
						return { name: 'Ada' };
					},
				},
			},
		});

		expect(seen[0]?.arguments).toEqual({ upper: true });
	});

	it('says nothing for a field with nothing below it', async () => {
		const bare = buildCatalog(`
			type Query { count: Int! }
			schema { query: Query }
		`);

		let seen: readonly SelectedField[] | undefined;
		await execute({
			request: '{ count }',
			catalog: bare,
			resolvers: {
				Query: {
					count: (_s, _a, _c, info) => {
						seen = info.selection();
						return 1;
					},
				},
			},
		});

		expect(seen).toEqual([]);
	});

	it('sees through a page to the rows it holds', async () => {
		const fields = await asked('{ people | page first: 2 { id name } }');

		// A paged field wraps its rows, and what a resolver produces is the
		// rows: it is told what was asked of a row, not of the wrapper.
		expect(names(fields)).toEqual(['id', 'name']);
	});

	it('answers the same list every time it is asked', async () => {
		let first: readonly SelectedField[] = [];
		let second: readonly SelectedField[] = [];

		await execute({
			request: '{ person { id } }',
			catalog,
			resolvers: {
				Query: {
					person: (_s, _a, _c, info) => {
						first = info.selection();
						second = info.selection();
						return { id: '1' };
					},
				},
			},
		});

		expect(first).toEqual(second);
	});
});
