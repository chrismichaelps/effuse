/**
 * MIT License
 *
 * Copyright (c) 2025 Chris M. Perez
 */

import { describe, expect, it, vi } from 'vitest';
import { buildCatalog, execute, type NexDirectives } from '../index.js';

const catalog = buildCatalog(`
	directive @upper on FIELD_DEFINITION
	directive @fallback(to: String!) on FIELD_DEFINITION
	directive @mask(keep: Int!) on FIELD_DEFINITION
	type Person {
		name: String! @upper
		nickname: String? @fallback(to: "none")
		card: String! @mask(keep: 4)
		plain: String!
	}
	type Query { person: Person! people: [Person!]! @connection }
	schema { query: Query }
`);

const directives: NexDirectives = {
	upper: {
		onField: async (next) => {
			const value = await next();
			return typeof value === 'string' ? value.toUpperCase() : value;
		},
	},
	fallback: {
		onField: async (next, { arguments: args }) => {
			const value = await next();
			return value ?? args.to;
		},
	},
	mask: {
		onField: async (next, { arguments: args }) => {
			const value = await next();
			if (typeof value !== 'string') return value;
			const keep = Number(args.keep);
			return `${'*'.repeat(Math.max(value.length - keep, 0))}${value.slice(-keep)}`;
		},
	},
};

const person = {
	name: 'ada',
	nickname: null,
	card: '4111111111111234',
	plain: 'as written',
};

const run = (request: string, given: NexDirectives = directives) =>
	execute({
		request,
		catalog,
		directives: given,
		resolvers: {
			Query: { person: () => person, people: () => [person, person] },
		},
	});

describe('a directive a server gave meaning to', () => {
	it('changes what the field answers with', async () => {
		const result = await run('{ person { name } }');

		expect(result.errors).toBeUndefined();
		expect(result.data).toEqual({ person: { name: 'ADA' } });
	});

	it('leaves a field without one alone', async () => {
		const result = await run('{ person { plain } }');

		expect(result.data).toEqual({ person: { plain: 'as written' } });
	});

	it('is given what the directive was written with', async () => {
		const result = await run('{ person { card } }');

		expect(result.data).toEqual({ person: { card: '************1234' } });
	});

	it('can answer in place of a value that was not there', async () => {
		const result = await run('{ person { nickname } }');

		expect(result.data).toEqual({ person: { nickname: 'none' } });
	});

	it('runs for every row of a list', async () => {
		const result = await run('{ people | page first: 2 { name } }');

		expect(result.data).toMatchObject({
			people: { items: [{ name: 'ADA' }, { name: 'ADA' }] },
		});
	});

	it('does nothing when the server gave it no meaning', async () => {
		const result = await run('{ person { name } }', {});

		// The catalog may declare a directive the server says nothing about,
		// and a field carrying it still answers.
		expect(result.data).toEqual({ person: { name: 'ada' } });
	});

	it('is told which field it is wrapping', async () => {
		const seen = vi.fn();
		await run('{ person { name } }', {
			upper: {
				onField: (next, context) => {
					seen(context.info.parentTypeName, context.info.fieldName);
					return next();
				},
			},
		});

		expect(seen).toHaveBeenCalledWith('Person', 'name');
	});

	it('sees the value the field was resolved from', async () => {
		const seen = vi.fn();
		await run('{ person { name } }', {
			upper: {
				onField: (next, context) => {
					seen(context.source);
					return next();
				},
			},
		});

		expect(seen).toHaveBeenCalledWith(person);
	});

	it('reports a directive that failed as the field failing', async () => {
		const result = await run('{ person { name } }', {
			upper: {
				onField: () => {
					throw new Error('the transform is broken');
				},
			},
		});

		expect(result.data).toBeNull();
		expect(result.errors?.[0]?.message).toMatch(/the transform is broken/);
		expect(result.errors?.[0]?.path).toEqual(['person', 'name']);
	});

	it('never runs the field when the directive did not ask for it', async () => {
		const resolver = vi.fn(() => 'ada');

		await execute({
			request: '{ person { name } }',
			catalog,
			directives: { upper: { onField: () => 'instead' } },
			resolvers: {
				Query: { person: () => ({}) },
				Person: { name: resolver },
			},
		});

		expect(resolver).not.toHaveBeenCalled();
	});

	it('runs several on one field, outermost first', async () => {
		const order: string[] = [];
		const twice = buildCatalog(`
			directive @outer on FIELD_DEFINITION
			directive @inner on FIELD_DEFINITION
			type Person { name: String! @outer @inner }
			type Query { person: Person! }
			schema { query: Query }
		`);

		await execute({
			request: '{ person { name } }',
			catalog: twice,
			directives: {
				outer: {
					onField: async (next) => {
						order.push('outer in');
						const value = await next();
						order.push('outer out');
						return value;
					},
				},
				inner: {
					onField: async (next) => {
						order.push('inner in');
						const value = await next();
						order.push('inner out');
						return value;
					},
				},
			},
			resolvers: { Query: { person: () => ({ name: 'ada' }) } },
		});

		expect(order).toEqual(['outer in', 'inner in', 'inner out', 'outer out']);
	});

	it('costs nothing on a field carrying none', async () => {
		const result = await execute({
			request: '{ person { plain } }',
			catalog,
			directives,
			resolvers: { Query: { person: () => person } },
		});

		expect(result.data).toEqual({ person: { plain: 'as written' } });
	});
});
