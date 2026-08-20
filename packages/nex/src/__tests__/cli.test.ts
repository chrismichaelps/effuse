/**
 * MIT License
 *
 * Copyright (c) 2025 Chris M. Perez
 */

import { describe, expect, it } from 'vitest';
import { runNexCommand, type NexCommandIO } from '../index.js';

const GOOD = `
	type Person @identity { id: ID! name: String! }
	type Query { people: [Person!]! @connection }
	schema { query: Query }
`;

const BROKEN = `
	type Query { person: Nowhere! }
	schema { query: Query }
`;

const RELATIONAL = `
	type Author @identity { id: ID! }
	type Post @identity { id: ID! authorId: ID! }
	type Query { posts: [Post!]! }
	schema { query: Query }
`;

/** A world of files held in memory, and everything the command said. */
const world = (files: Record<string, string>) => {
	const out: string[] = [];
	const errs: string[] = [];
	const written = new Map<string, string>();

	const io: NexCommandIO = {
		read: (path) => {
			const held = files[path];
			if (held === undefined) throw new Error(`no such file: ${path}`);
			return held;
		},
		write: (path, contents) => {
			written.set(path, contents);
		},
		out: (line) => out.push(line),
		error: (line) => errs.push(line),
	};

	return { io, out, errs, written };
};

const run = (argv: readonly string[], files: Record<string, string>) => {
	const w = world(files);
	const code = runNexCommand(argv, w.io);
	return { ...w, code, said: w.out.join('\n'), complained: w.errs.join('\n') };
};

describe('checking a catalog', () => {
	it('says nothing and succeeds for one that holds together', () => {
		const result = run(['check', 'schema.nex'], { 'schema.nex': GOOD });

		expect(result.code).toBe(0);
		expect(result.said).toMatch(/holds together/);
	});

	it('reports every problem and fails for one that does not', () => {
		const result = run(['check', 'schema.nex'], { 'schema.nex': BROKEN });

		expect(result.code).toBe(1);
		expect(result.complained).toMatch(/Nowhere/);
	});

	it('fails when the file is not there', () => {
		const result = run(['check', 'missing.nex'], {});

		expect(result.code).toBe(1);
		expect(result.complained).toMatch(/no such file/);
	});
});

describe('reviewing a catalog', () => {
	it('succeeds and says so when there is nothing to say', () => {
		const result = run(['review', 'schema.nex'], { 'schema.nex': GOOD });

		expect(result.code).toBe(0);
		expect(result.said).toMatch(/nothing to say/i);
	});

	it('names what it found, by coordinate', () => {
		const result = run(['review', 'schema.nex'], { 'schema.nex': RELATIONAL });

		expect(result.code).toBe(1);
		expect(result.said).toMatch(/Post\.authorId/);
		expect(result.said).toMatch(/FOREIGN_KEY/);
	});

	it('leaves names alone when told to', () => {
		const named = `
			type person @identity { id: ID! }
			type Query { getPerson: person! }
			schema { query: Query }
		`;

		const strict = run(['review', 'schema.nex'], { 'schema.nex': named });
		const relaxed = run(['review', 'schema.nex', '--no-naming'], {
			'schema.nex': named,
		});

		expect(strict.code).toBe(1);
		expect(relaxed.code).toBe(0);
	});
});

describe('comparing two catalogs', () => {
	const before = `
		type Query { a: String! b: String! }
		schema { query: Query }
	`;

	it('succeeds when nothing a client leans on changed', () => {
		const after = `
			type Query { a: String! b: String! c: String! }
			schema { query: Query }
		`;
		const result = run(['diff', 'before.nex', 'after.nex'], {
			'before.nex': before,
			'after.nex': after,
		});

		expect(result.code).toBe(0);
	});

	it('fails on a change that breaks a client', () => {
		const after = `
			type Query { a: String! }
			schema { query: Query }
		`;
		const result = run(['diff', 'before.nex', 'after.nex'], {
			'before.nex': before,
			'after.nex': after,
		});

		expect(result.code).toBe(1);
		expect(result.said).toMatch(/Query\.b/);
	});

	it('says what changed even when nothing broke', () => {
		const after = `
			type Query { a: String! b: String! c: String! }
			schema { query: Query }
		`;
		const result = run(['diff', 'before.nex', 'after.nex'], {
			'before.nex': before,
			'after.nex': after,
		});

		expect(result.said).toMatch(/Query\.c/);
	});
});

describe('writing types', () => {
	it('writes the catalog types where it was told', () => {
		const result = run(['typegen', 'schema.nex', '--out', 'catalog.ts'], {
			'schema.nex': GOOD,
		});

		expect(result.code).toBe(0);
		expect(result.written.get('catalog.ts')).toMatch(/export type Person = {/);
	});

	it('says the types rather than writing them when told nowhere', () => {
		const result = run(['typegen', 'schema.nex'], { 'schema.nex': GOOD });

		expect(result.said).toMatch(/export type Person = {/);
	});

	it('writes the types of a request when given one', () => {
		const result = run(['typegen', 'schema.nex', '--request', 'feed.nex'], {
			'schema.nex': GOOD,
			'feed.nex': 'query Feed { people | page first: 2 { name } }',
		});

		expect(result.said).toMatch(/export type FeedData = {/);
	});

	it('says what a scalar reads as when told', () => {
		const withScalar = `
			scalar Money
			type Query { price: Money! }
			schema { query: Query }
		`;
		const result = run(['typegen', 'schema.nex', '--scalar', 'Money=number'], {
			'schema.nex': withScalar,
		});

		expect(result.said).toMatch(/export type Money = number;/);
	});
});

describe('a command nobody asked for', () => {
	it('says what it does understand', () => {
		const result = run(['fly'], {});

		expect(result.code).toBe(1);
		expect(result.complained).toMatch(/check/);
		expect(result.complained).toMatch(/review/);
	});

	it('says the same when told nothing at all', () => {
		expect(run([], {}).code).toBe(1);
	});

	it('says what it does when asked', () => {
		const result = run(['--help'], {});

		expect(result.code).toBe(0);
		expect(result.said).toMatch(/typegen/);
	});

	it('needs a catalog to work on', () => {
		const result = run(['check'], {});

		expect(result.code).toBe(1);
		expect(result.complained).toMatch(/catalog/i);
	});
});
