/**
 * MIT License
 *
 * Copyright (c) 2025 Chris M. Perez
 */

import { describe, expect, it } from 'vitest';
import {
	buildCatalog,
	execute,
	parse,
	print,
	validateRequest,
} from '../index.js';
import type { Resolvers } from '../index.js';

const catalog = buildCatalog(`
	type Person {
		id: ID!
		name(upper: Boolean?): String!
		greeting(with: String!): String!
	}
	type Query { person: Person! other: Person! }
	schema { query: Query }
`);

const resolvers: Resolvers = {
	Query: {
		person: () => ({ id: '1' }),
		other: () => ({ id: '2' }),
	},
	Person: {
		name: (_source, args) => (args.upper === true ? 'ADA' : 'ada'),
		greeting: (_source, args) => `hello ${String(args.with)}`,
	},
};

const run = (request: string, variables?: Record<string, unknown>) =>
	execute({
		request,
		catalog,
		resolvers,
		...(variables === undefined ? {} : { variables }),
	});

describe('a fragment that takes what it needs', () => {
	it('parses arguments on the definition and the spread', () => {
		const document = parse(`
			fragment Named($up: Boolean!) on Person { name(upper: $up) }
			{ person { ...Named(up: true) } }
		`);

		expect(document.definitions).toHaveLength(2);
	});

	it('uses what it was given', async () => {
		const result = await run(`
			fragment Named($up: Boolean!) on Person { name(upper: $up) }
			{ person { ...Named(up: true) } }
		`);

		expect(result.errors).toBeUndefined();
		expect(result.data).toEqual({ person: { name: 'ADA' } });
	});

	it('can be used twice with different values', async () => {
		const result = await run(`
			fragment Named($up: Boolean!) on Person { name(upper: $up) }
			{ person { ...Named(up: true) } other { ...Named(up: false) } }
		`);

		// The point of the whole thing: one fragment, two answers.
		expect(result.data).toEqual({
			person: { name: 'ADA' },
			other: { name: 'ada' },
		});
	});

	it('takes a value from a variable of the operation', async () => {
		const result = await run(
			`
			fragment Named($up: Boolean!) on Person { name(upper: $up) }
			query P($shout: Boolean!) { person { ...Named(up: $shout) } }
			`,
			{ shout: true }
		);

		expect(result.data).toEqual({ person: { name: 'ADA' } });
	});

	it('falls back to what the fragment said by default', async () => {
		const result = await run(`
			fragment Named($up: Boolean! = true) on Person { name(upper: $up) }
			{ person { ...Named } }
		`);

		expect(result.data).toEqual({ person: { name: 'ADA' } });
	});

	it('prints back what was written', () => {
		const source = `fragment Named($up: Boolean!) on Person {
  name(upper: $up)
}

{
  person {
    ...Named(up: true)
  }
}`;

		expect(print(parse(source))).toBe(source);
	});
});

describe('what a fragment argument may not do', () => {
	it('is refused when the spread does not give it', () => {
		const problems = validateRequest(
			`
			fragment Named($up: Boolean!) on Person { name(upper: $up) }
			{ person { ...Named } }
			`,
			catalog
		);

		expect(problems.map((one) => one.message)).toEqual([
			expect.stringMatching(/"Named" needs "up"/),
		]);
	});

	it('is refused when the spread gives one it does not take', () => {
		const problems = validateRequest(
			`
			fragment Named($up: Boolean!) on Person { name(upper: $up) }
			{ person { ...Named(up: true, loud: false) } }
			`,
			catalog
		);

		expect(problems.map((one) => one.message)).toEqual([
			expect.stringMatching(/"Named" does not take "loud"/),
		]);
	});

	it('is refused when it is never used', () => {
		const problems = validateRequest(
			`
			fragment Named($up: Boolean!) on Person { id }
			{ person { ...Named(up: true) } }
			`,
			catalog
		);

		// The same rule an operation's variables are held to: something
		// declared and never used is something nobody meant to write.
		expect(problems.map((one) => one.message)).toEqual([
			expect.stringMatching(/"\$up" is never used/),
		]);
	});

	it('is refused when the value is of the wrong type', () => {
		const problems = validateRequest(
			`
			fragment Named($up: Boolean!) on Person { name(upper: $up) }
			{ person { ...Named(up: "yes") } }
			`,
			catalog
		);

		expect(problems.length).toBeGreaterThan(0);
	});
});

describe('what a fragment argument keeps to itself', () => {
	it("answers for its own name rather than the operation's", async () => {
		const result = await execute({
			request: `
				fragment Named($up: Boolean!) on Person { name(upper: $up) }
				query P($up: Boolean!) { person { ...Named(up: true) } other { name(upper: $up) } }
			`,
			catalog,
			resolvers,
			variables: { up: false },
		});

		// One name, two meanings: inside the fragment it is what the spread
		// gave, and outside it is what the operation was called with.
		expect(result.errors).toBeUndefined();
		expect(result.data).toEqual({
			person: { name: 'ADA' },
			other: { name: 'ada' },
		});
	});

	it('still lets a fragment read a variable of the operation', () => {
		// A fragment that takes nothing reads what is around it, the way it
		// always has: arguments are something a fragment may say, not
		// something every fragment must.
		const problems = validateRequest(
			`
			fragment Plain on Person { name(upper: $shout) }
			query P($shout: Boolean!) { person { ...Plain } }
			`,
			catalog
		);

		expect(problems).toEqual([]);
	});
});
