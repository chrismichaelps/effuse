/**
 * MIT License
 *
 * Copyright (c) 2025 Chris M. Perez
 */

import { describe, expect, it, vi } from 'vitest';
import { buildCatalog, execute, type NexDirectives } from '../index.js';

const catalog = buildCatalog(`
	directive @upper on FIELD
	directive @exclaim on FIELD | FIELD_DEFINITION
	directive @mask on FIELD_DEFINITION
	type Person {
		name: String!
		card: String! @mask
		shouted: String! @exclaim
	}
	type Query { person: Person! }
	schema { query: Query }
`);

const directives: NexDirectives = {
	upper: {
		onField: async (next) => String(await next()).toUpperCase(),
	},
	exclaim: {
		onField: async (next) => `${String(await next())}!`,
	},
	mask: {
		onField: async (next) => String(await next()).replace(/\d(?=\d{4})/gu, '*'),
	},
};

const person = { name: 'ada', card: '4111111111111234', shouted: 'hello' };

const run = (request: string, given: NexDirectives = directives) =>
	execute({
		request,
		catalog,
		directives: given,
		resolvers: { Query: { person: () => person } },
	});

describe('a directive a caller wrote', () => {
	it('changes what that field answers with', async () => {
		const result = await run('{ person { name @upper } }');

		expect(result.errors).toBeUndefined();
		expect(result.data).toEqual({ person: { name: 'ADA' } });
	});

	it('leaves the same field alone when it was not asked for', async () => {
		const result = await run('{ person { name } }');

		expect(result.data).toEqual({ person: { name: 'ada' } });
	});

	it('applies only where it was written', async () => {
		const result = await run('{ person { a: name @upper b: name } }');

		expect(result.data).toEqual({ person: { a: 'ADA', b: 'ada' } });
	});

	it('does nothing when the server gave it no meaning', async () => {
		const result = await run('{ person { name @upper } }', {});

		expect(result.data).toEqual({ person: { name: 'ada' } });
	});

	it('is given what it was written with', async () => {
		const withArgs = buildCatalog(`
			directive @pad(to: Int!) on FIELD
			type Query { name: String! }
			schema { query: Query }
		`);

		const seen = vi.fn();
		await execute({
			request: '{ name @pad(to: 6) }',
			catalog: withArgs,
			directives: {
				pad: {
					onField: (next, context) => {
						seen(context.arguments);
						return next();
					},
				},
			},
			resolvers: { Query: { name: () => 'ada' } },
		});

		expect(seen).toHaveBeenCalledWith({ to: 6 });
	});
});

describe('what a caller cannot get around', () => {
	it('leaves the rule the schema put on a field outermost', async () => {
		const order: string[] = [];
		const watching: NexDirectives = {
			mask: {
				onField: async (next) => {
					order.push('schema in');
					const value = await next();
					order.push('schema out');
					return value;
				},
			},
			upper: {
				onField: async (next) => {
					order.push('caller in');
					const value = await next();
					order.push('caller out');
					return value;
				},
			},
		};

		await execute({
			request: '{ person { card @upper } }',
			catalog: buildCatalog(`
				directive @upper on FIELD
				directive @mask on FIELD_DEFINITION
				type Person { card: String! @mask }
				type Query { person: Person! }
				schema { query: Query }
			`),
			directives: watching,
			resolvers: { Query: { person: () => person } },
		});

		// What the schema says wraps what the caller asked for, so a rule the
		// server put on a field always sees the final value.
		expect(order).toEqual([
			'schema in',
			'caller in',
			'caller out',
			'schema out',
		]);
	});

	it('still masks a field a caller tried to change', async () => {
		const result = await run('{ person { card @upper } }');

		// The caller's directive ran, and the schema's ran around it.
		expect(result.data).toEqual({ person: { card: '************1234' } });
	});

	it('does not hand a server the directives that decide what is asked for', async () => {
		const ran = vi.fn();

		const result = await execute({
			request: '{ person { name @skip(if: false) } }',
			catalog,
			directives: {
				skip: {
					onField: (next) => {
						ran();
						return next();
					},
				},
			},
			resolvers: { Query: { person: () => person } },
		});

		// Whether the field is here at all was settled before anything
		// resolved, so a field reaching a resolver has already been said yes
		// to and handing it back would be asking twice.
		expect(result.data).toEqual({ person: { name: 'ada' } });
		expect(ran).not.toHaveBeenCalled();
	});

	it('refuses one written where the catalog does not allow it', async () => {
		const problems = await run('{ person { name @mask } }');

		// @mask is declared on FIELD_DEFINITION only, so a caller cannot ask
		// for it however the server implemented it.
		expect(problems.errors?.[0]?.message).toMatch(/@mask/);
	});

	it('refuses one the catalog never declared', async () => {
		const result = await run('{ person { name @invented } }');

		expect(result.errors?.[0]?.message).toMatch(/@invented|not defined/i);
	});
});

describe('a directive written in both places', () => {
	it('runs once for each', async () => {
		const result = await run('{ person { shouted @exclaim } }');

		// Declared on the field and asked for by the caller: both apply.
		expect(result.data).toEqual({ person: { shouted: 'hello!!' } });
	});
});
