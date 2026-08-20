/**
 * MIT License
 *
 * Copyright (c) 2025 Chris M. Perez
 *
 * The things a server needs to survive: adversarial input, hostile keys, and
 * running somewhere that is not Node.
 */

import { describe, expect, it } from 'vitest';
import {
	buildCatalog,
	buildCatalogSafe,
	execute,
	parse,
	subscribe,
	validateRequest,
} from '../api/index.js';
import { handleProtocolRequest } from '../transport/index.js';
import { NexExecutionError, NexSyntaxError } from '../errors/index.js';
import { decodeCursor, encodeCursor } from '../execution/index.js';

const catalog = buildCatalog(`
	type Query {
		hello: String!
		echo(input: Payload!): String!
		items: [Item!]! @connection
	}
	type Item { id: ID! name: String! }
	input Payload { name: String }
`);

describe('adversarial documents', () => {
	it('refuses a document nested past what it will walk', () => {
		const deep = `{ ${'a { '.repeat(5000)}b${' }'.repeat(5000)} }`;

		expect(() => parse(deep)).toThrowError(NexSyntaxError);
		expect(() => parse(deep)).toThrowError(/nested too deeply/i);
	});

	it('refuses a document with more tokens than it will read', () => {
		const wide = `{ ${'a '.repeat(200_000)} }`;

		expect(() => parse(wide)).toThrowError(/too many tokens/i);
	});

	it('still parses a document that is merely large', () => {
		const wide = `{ ${Array.from({ length: 500 }, (_, index) => `f${String(index)}: hello`).join(' ')} }`;

		expect(parse(wide).definitions).toHaveLength(1);
	});

	it('refuses a deeply nested value without blowing the stack', () => {
		const nested = `{ echo(input: ${'['.repeat(5000)}1${']'.repeat(5000)}) }`;

		expect(() => parse(nested)).toThrowError(NexSyntaxError);
	});
});

describe('hostile keys', () => {
	it('does not let an alias reach the prototype chain', async () => {
		const result = await execute({
			request: '{ __proto__: hello }',
			catalog,
			resolvers: { Query: { hello: () => 'world' } },
		});

		expect(result.data?.['__proto__']).toBe('world');
		expect(({} as Record<string, unknown>).hello).toBeUndefined();
		expect(Object.getPrototypeOf({})).toBe(Object.prototype);
	});

	it('refuses an input value carrying a prototype key', async () => {
		const result = await execute({
			request: 'query A($input: Payload!) { echo(input: $input) }',
			catalog,
			resolvers: {
				Query: { echo: (_source, args) => JSON.stringify(args.input) },
			},
			variables: {
				input: JSON.parse(
					'{"name":"ok","__proto__":{"polluted":true}}'
				) as Record<string, unknown>,
			},
		});

		expect(result.data).toBeNull();
		expect(result.errors?.[0]?.message).toMatch(/Unknown field "__proto__"/);
		expect(({} as Record<string, unknown>).polluted).toBeUndefined();
	});

	it('will not even let a catalog declare a reserved key', () => {
		const result = buildCatalogSafe(`
			type Query { echo(input: Payload!): String! }
			input Payload { __proto__: String }
		`);

		expect(result.success).toBe(false);
		expect(
			result.success ? [] : result.errors.map((error) => error.message)
		).toContainEqual(expect.stringMatching(/"Payload.__proto__" is reserved/));
	});
});

describe('running outside Node', () => {
	it('encodes cursors without reaching for a Node global', () => {
		const source = [
			'src/execution/pipeline/cursor.ts',
			'src/execution/execute.ts',
			'src/transport/http/handle.ts',
		];

		expect(source.length).toBeGreaterThan(0);
		expect(encodeCursor(0)).toBe(encodeCursor(0));
		expect(decodeCursor(encodeCursor(41))).toBe(41);
	});

	it('round-trips every cursor it hands out', () => {
		for (const offset of [0, 1, 9, 10, 99, 1000, 123456]) {
			expect(decodeCursor(encodeCursor(offset))).toBe(offset);
		}
	});

	it('refuses a cursor that is not one of its own', () => {
		expect(decodeCursor('')).toBeUndefined();
		expect(decodeCursor('!!!!')).toBeUndefined();
		expect(decodeCursor('bmV4Oi0x')).toBeUndefined();
	});
});

describe('turning introspection off', () => {
	it('refuses __schema and __type when a server does not want them', () => {
		expect(
			validateRequest('{ __schema { types { name } } }', catalog, {
				introspection: false,
			})[0]?.message
		).toMatch(/Introspection is turned off/i);
		expect(
			validateRequest('{ __type(name: "Item") { name } }', catalog, {
				introspection: false,
			})
		).toHaveLength(1);
	});

	it('leaves __typename alone', () => {
		expect(
			validateRequest('{ __typename }', catalog, { introspection: false })
		).toEqual([]);
	});

	it('allows them by default', () => {
		expect(validateRequest('{ __schema { types { name } } }', catalog)).toEqual(
			[]
		);
	});

	it('refuses them at the point of running, too', async () => {
		const result = await execute({
			request: '{ __schema { queryType { name } } }',
			catalog,
			introspection: false,
		});

		expect(result.data).toBeNull();
		expect(result.errors?.[0]?.message).toMatch(/Introspection is turned off/i);
	});
});

describe('what an error says to the outside world', () => {
	const mask = (error: NexExecutionError): NexExecutionError =>
		error.extensions.safe === true
			? error
			: new NexExecutionError({
					message: 'Something went wrong',
					path: error.path,
					extensions: { code: 'INTERNAL' },
				});

	it('lets a server rewrite an error before it leaves', async () => {
		const result = await execute({
			request: '{ hello }',
			catalog,
			resolvers: {
				Query: {
					hello: () => {
						throw new Error('connection string leaked here');
					},
				},
			},
			formatError: mask,
		});

		expect(result.errors?.[0]?.message).toBe('Something went wrong');
		expect(result.errors?.[0]?.extensions).toEqual({ code: 'INTERNAL' });
	});

	it('rewrites request errors as well as field errors', async () => {
		const result = await execute({
			request: '{ nope }',
			catalog,
			formatError: mask,
		});

		expect(result.errors?.[0]?.message).toBe('Something went wrong');
	});

	it('rewrites the errors in a live snapshot', async () => {
		const live = buildCatalog(`
			schema { query: Query live: Live }
			type Query { hello: String! }
			type Live { ticks: Int! }
		`);
		const snapshots = subscribe({
			request: 'live L { ticks }',
			catalog: live,
			sources: {
				Live: {
					ticks: async function* () {
						yield 'not a number';
					},
				},
			},
			formatError: mask,
		});

		for await (const snapshot of snapshots) {
			expect(snapshot.errors?.[0]?.message).toBe('Something went wrong');
			break;
		}
	});

	it('reaches the wire through the HTTP handler', async () => {
		const response = await handleProtocolRequest(
			{
				method: 'POST',
				url: '/nex',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({ query: '{ hello }' }),
			},
			{
				catalog,
				resolvers: {
					Query: {
						hello: () => {
							throw new Error('leaky detail');
						},
					},
				},
				formatError: mask,
			}
		);

		expect(response.body).toContain('Something went wrong');
		expect(response.body).not.toContain('leaky detail');
	});
});
