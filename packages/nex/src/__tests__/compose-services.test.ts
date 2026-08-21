/**
 * MIT License
 *
 * Copyright (c) 2025 Chris M. Perez
 */

import { describe, expect, it, vi } from 'vitest';
import {
	buildCatalog,
	composeServices,
	createNexHandler,
	execute,
	type NexServiceRequest,
} from '../index.js';

const peopleCatalog = buildCatalog(`
	type Person @identity { id: ID! name: String! }
	type Query { person(id: ID!): Person? people: [Person!]! @connection }
	schema { query: Query }
`);

const postsCatalog = buildCatalog(`
	type Post @identity { id: ID! title: String! }
	type Query { posts: [Post!]! @connection }
	type Mutation { publish(id: ID!): Post! }
	schema { query: Query, mutation: Mutation }
`);

/** A service answered by a handler in this process, counting what it was sent. */
const service = (
	catalog: ReturnType<typeof buildCatalog>,
	resolvers: Record<string, Record<string, unknown>>
) => {
	const sent: { query: string; variables?: unknown }[] = [];
	const handler = createNexHandler({ catalog, resolvers: resolvers as never });

	const request: NexServiceRequest = async (payload) => {
		sent.push({ query: payload.query });
		const response = await handler(
			new Request('https://service/nex', {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify(payload),
			})
		);
		return (await response.json()) as never;
	};

	return { catalog, request, sent };
};

const people = () =>
	service(peopleCatalog, {
		Query: {
			person: (_s: unknown, args: { id: string }) => ({
				id: args.id,
				name: `person ${args.id}`,
			}),
			people: () => [{ id: '1', name: 'Ada' }],
		},
	});

const posts = () =>
	service(postsCatalog, {
		Query: { posts: () => [{ id: '9', title: 'On engines' }] },
		Mutation: {
			publish: (_s: unknown, args: { id: string }) => ({
				id: args.id,
				title: 'published',
			}),
		},
	});

describe('a graph made of several services', () => {
	it('holds every type its services hold', () => {
		const { catalog } = composeServices({
			people: people(),
			posts: posts(),
		});

		expect(catalog.getType('Person')).toBeDefined();
		expect(catalog.getType('Post')).toBeDefined();
	});

	it('answers a field from the service that owns it', async () => {
		const first = people();
		const second = posts();
		const { catalog, resolvers } = composeServices({
			people: first,
			posts: second,
		});

		const result = await execute({
			request: '{ people | page first: 1 { name } }',
			catalog,
			resolvers,
		});

		expect(result.errors).toBeUndefined();
		expect(result.data).toMatchObject({
			people: { items: [{ name: 'Ada' }] },
		});
		expect(second.sent).toHaveLength(0);
	});

	it('answers one request from two services at once', async () => {
		const { catalog, resolvers } = composeServices({
			people: people(),
			posts: posts(),
		});

		const result = await execute({
			request:
				'{ people | page first: 1 { name } posts | page first: 1 { title } }',
			catalog,
			resolvers,
		});

		expect(result.errors).toBeUndefined();
		expect(result.data).toMatchObject({
			people: { items: [{ name: 'Ada' }] },
			posts: { items: [{ title: 'On engines' }] },
		});
	});

	it('sends only what was asked for', async () => {
		const first = people();
		const { catalog, resolvers } = composeServices({ people: first });

		await execute({
			request: '{ person(id: "7") { name } }',
			catalog,
			resolvers,
		});

		expect(first.sent).toHaveLength(1);
		// The whole of what it asks for, and nothing the caller did not want.
		expect(first.sent[0]?.query).toBe('query { person(id: "7") { name } }');
	});

	it('passes on the arguments a field was given', async () => {
		const first = people();
		const { catalog, resolvers } = composeServices({ people: first });

		const result = await execute({
			request: '{ person(id: "7") { name } }',
			catalog,
			resolvers,
		});

		expect(result.data).toEqual({ person: { name: 'person 7' } });
	});

	it('passes on an argument that came from a variable', async () => {
		const first = people();
		const { catalog, resolvers } = composeServices({ people: first });

		const result = await execute({
			request: 'query P($id: ID!) { person(id: $id) { name } }',
			catalog,
			resolvers,
			variables: { id: '3' },
		});

		expect(result.data).toEqual({ person: { name: 'person 3' } });
	});

	it('says so rather than answering one field asked for twice', async () => {
		const { catalog, resolvers } = composeServices({ people: people() });

		const result = await execute({
			request: '{ person(id: "1") { a: name b: name } }',
			catalog,
			resolvers,
		});

		expect(result.errors?.[0]?.message).toMatch(/more than once/);
	});

	it('answers under the name the caller asked for', async () => {
		const { catalog, resolvers } = composeServices({ people: people() });

		const result = await execute({
			request: '{ who: person(id: "1") { called: name } }',
			catalog,
			resolvers,
		});

		expect(result.data).toEqual({ who: { called: 'person 1' } });
	});

	it('runs a change on the service that owns it', async () => {
		const { catalog, resolvers } = composeServices({
			people: people(),
			posts: posts(),
		});

		const result = await execute({
			request: 'mutation { publish(id: "9") { title } }',
			catalog,
			resolvers,
		});

		expect(result.data).toEqual({ publish: { title: 'published' } });
	});
});

describe('a service that could not answer', () => {
	it('reports what it said went wrong', async () => {
		const failing: NexServiceRequest = () =>
			Promise.resolve({
				data: null,
				errors: [{ message: 'the source is down', path: ['people'] }],
				extensions: { cost: 0 },
			} as never);

		const { catalog, resolvers } = composeServices({
			people: { catalog: peopleCatalog, request: failing },
		});

		const result = await execute({
			request: '{ people | page first: 1 { name } }',
			catalog,
			resolvers,
		});

		expect(result.errors?.[0]?.message).toMatch(/the source is down/);
	});

	it('reports a service that could not be reached at all', async () => {
		const unreachable: NexServiceRequest = () => {
			throw new Error('connect ECONNREFUSED');
		};

		const { catalog, resolvers } = composeServices({
			people: { catalog: peopleCatalog, request: unreachable },
		});

		const result = await execute({
			request: '{ people | page first: 1 { name } }',
			catalog,
			resolvers,
		});

		expect(result.errors?.[0]?.message).toMatch(/ECONNREFUSED/);
	});
});

describe('what composing refuses', () => {
	it('refuses services that disagree about a type', () => {
		// Object types compose - a service may describe the part it serves -
		// so a clash is a field two of them declare differently.
		const clashing = buildCatalog(`
			type Person @identity { id: ID! name: Int! }
			type Query { other: Person! }
			schema { query: Query }
		`);

		expect(() =>
			composeServices({
				people: people(),
				clashing: { catalog: clashing, request: vi.fn() },
			})
		).toThrow(/declared differently/);
	});

	it('refuses composing nothing', () => {
		expect(() => composeServices({})).toThrow(/at least one service/i);
	});

	it('refuses two services that both answer one field', () => {
		const alsoPeople = buildCatalog(`
			type Person @identity { id: ID! name: String! }
			type Query { person(id: ID!): Person? }
			schema { query: Query }
		`);

		expect(() =>
			composeServices({
				people: people(),
				mirror: { catalog: alsoPeople, request: vi.fn() },
			})
		).toThrow(/More than one service answers "Query\.person"/);
	});
});

describe('a service that does not answer', () => {
	const slowService = (delayMs: number) => {
		const request: NexServiceRequest = async () => {
			await new Promise((resolve) => setTimeout(resolve, delayMs));
			return {
				data: { people: { items: [], pageInfo: {}, totalCount: 0 } },
				extensions: { cost: 0 },
			} as never;
		};
		return { catalog: peopleCatalog, request };
	};

	it('gives up on one that takes longer than it was given', async () => {
		const { catalog, resolvers } = composeServices({
			people: { ...slowService(5_000), timeoutMs: 20 },
		});

		const result = await execute({
			request: '{ people | page first: 1 { name } }',
			catalog,
			resolvers,
		});

		expect(result.errors?.[0]?.message).toMatch(/did not answer within/);
	});

	it('waits when it was given no deadline', async () => {
		const { catalog, resolvers } = composeServices({
			people: slowService(10),
		});

		const result = await execute({
			request: '{ people | page first: 1 { name } }',
			catalog,
			resolvers,
		});

		expect(result.errors).toBeUndefined();
	});

	it('tells a service the run was called off', async () => {
		const controller = new AbortController();
		let seen: AbortSignal | undefined;

		const request: NexServiceRequest = async (payload) => {
			seen = payload.signal;
			return { data: { person: null }, extensions: { cost: 0 } } as never;
		};

		const { catalog, resolvers } = composeServices({
			people: { catalog: peopleCatalog, request },
		});

		await execute({
			request: '{ person(id: "1") { name } }',
			catalog,
			resolvers,
			signal: controller.signal,
		});

		expect(seen).toBe(controller.signal);
	});

	it('calls a service off when its own deadline passes', async () => {
		let aborted = false;

		const request: NexServiceRequest = (payload) =>
			new Promise((_resolve, reject) => {
				payload.signal?.addEventListener('abort', () => {
					aborted = true;
					reject(new Error('called off'));
				});
			});

		const { catalog, resolvers } = composeServices({
			people: { catalog: peopleCatalog, request, timeoutMs: 20 },
		});

		await execute({
			request: '{ person(id: "1") { name } }',
			catalog,
			resolvers,
		});

		// Giving up on the answer is not the same as stopping the work: a
		// service left running is a request nobody will ever read.
		expect(aborted).toBe(true);
	});
});
