/**
 * MIT License
 *
 * Copyright (c) 2025 Chris M. Perez
 */

import { describe, expect, it } from 'vitest';
import { buildCatalog, execute, validateRequest } from '../index.js';

const catalog = buildCatalog(`
	type Row { id: ID! }
	type Query { rows: [Row!]! @connection }
	schema { query: Query }
`);

const rows = Array.from({ length: 5 }, (_, index) => ({ id: String(index) }));

const problems = (request: string): readonly string[] =>
	validateRequest(request, catalog).map((one) => one.message);

const run = (request: string, variables?: Record<string, unknown>) =>
	execute({
		request,
		catalog,
		...(variables === undefined ? {} : { variables }),
		resolvers: { Query: { rows: () => rows } },
	});

describe('a count that cannot mean anything', () => {
	it('refuses a negative take, which took all but the last', () => {
		expect(problems('{ rows | take -1 { id } }')).toEqual([
			expect.stringMatching(/"\| take" needs a count of none or more/),
		]);
	});

	it('refuses a negative skip, which kept only the last', () => {
		expect(problems('{ rows | skip -1 { id } }')).toEqual([
			expect.stringMatching(/"\| skip" needs a count of none or more/),
		]);
	});

	it('refuses a negative page size, which answered with everything', () => {
		// The dangerous one: a caller asking for fewer than none got the whole
		// list, whatever the server had set as a limit.
		expect(problems('{ rows | page first: -1 { id } }')).toEqual([
			expect.stringMatching(/needs a count of none or more/),
		]);
	});

	it('refuses a negative last as well', () => {
		expect(problems('{ rows | page last: -1 { id } }')).toEqual([
			expect.stringMatching(/needs a count of none or more/),
		]);
	});

	it('still takes none', async () => {
		const result = await run('{ rows | take 0 { id } }');

		expect(result.errors).toBeUndefined();
		expect(result.data).toEqual({ rows: [] });
	});

	it('still takes some', async () => {
		const result = await run('{ rows | take 2 { id } }');

		expect(result.data).toEqual({ rows: [{ id: '0' }, { id: '1' }] });
	});

	it('still pages', async () => {
		const result = await run('{ rows | page first: 2 { id } }');

		expect((result.data?.rows as { items: unknown[] }).items).toHaveLength(2);
	});
});

describe('a count that arrives in a variable', () => {
	it('is refused at the same place', async () => {
		const result = await run('query P($n: Int!) { rows | take $n { id } }', {
			n: -1,
		});

		// A literal is caught before anything runs; one that arrives later has
		// to be caught where it arrives, or the same nonsense gets through by
		// being written somewhere else.
		// Named by the stage that was actually given it.
		expect(result.errors?.[0]?.message).toMatch(/"\| take" needs a count/);
	});

	it('is refused for a page size too, which is the dangerous one', async () => {
		const result = await run(
			'query P($n: Int!) { rows | page first: $n { id } }',
			{ n: -1 }
		);

		// This is how a caller would have got the whole list past whatever
		// the server allows: ask for fewer than none.
		expect(result.errors?.[0]?.message).toMatch(/none or more/);
	});

	it('is refused for a page taken from the end', async () => {
		const result = await run(
			'query P($n: Int!) { rows | page last: $n { id } }',
			{ n: -1 }
		);

		expect(result.errors?.[0]?.message).toMatch(/none or more/);
	});

	it('is taken when it means something', async () => {
		const result = await run('query P($n: Int!) { rows | take $n { id } }', {
			n: 2,
		});

		expect(result.data).toEqual({ rows: [{ id: '0' }, { id: '1' }] });
	});
});
