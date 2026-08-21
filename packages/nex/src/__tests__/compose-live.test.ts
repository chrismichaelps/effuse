/**
 * MIT License
 *
 * Copyright (c) 2025 Chris M. Perez
 */

import { describe, expect, it } from 'vitest';
import {
	buildCatalog,
	composeServices,
	subscribe,
	type ExecutionResult,
	type NexService,
} from '../index.js';

const ticksCatalog = buildCatalog(`
	type Live { beat: Int! }
	type Query { hello: String! }
	schema { query: Query, live: Live }
`);

const postsCatalog = buildCatalog(`
	type Post @identity { id: ID! title: String! }
	type Live { posted: Post! }
	type Query { posts: [Post!]! @connection }
	schema { query: Query, live: Live }
`);

const snapshot = (data: Record<string, unknown>): ExecutionResult => ({
	data,
	extensions: { cost: 1 },
});

/** A service that streams whatever it was told to, remembering what it was sent. */
const streaming = (
	catalog: NexService['catalog'],
	frames: readonly ExecutionResult[]
) => {
	const sent: string[] = [];
	let signal: AbortSignal | undefined;

	const service: NexService = {
		catalog,
		request: () => snapshot({}),
		subscribe: async function* (payload) {
			sent.push(payload.query);
			signal = payload.signal;
			for (const frame of frames) yield frame;
		},
	};

	return { service, sent, seenSignal: () => signal };
};

const firstFew = async (
	stream: AsyncGenerator<ExecutionResult>,
	count: number
): Promise<ExecutionResult[]> => {
	const out: ExecutionResult[] = [];
	for await (const one of stream) {
		out.push(one);
		if (out.length === count) break;
	}
	return out;
};

describe('a live operation across services', () => {
	it('watches the service that owns the field', async () => {
		const ticks = streaming(ticksCatalog, [
			snapshot({ beat: 1 }),
			snapshot({ beat: 2 }),
		]);
		const { catalog, resolvers, sources } = composeServices({
			ticks: ticks.service,
		});

		const seen = await firstFew(
			subscribe({ request: 'live L { beat }', catalog, resolvers, sources }),
			2
		);

		expect(seen.map((one) => one.data)).toEqual([{ beat: 1 }, { beat: 2 }]);
	});

	it('asks it for what the caller asked for', async () => {
		const posts = streaming(postsCatalog, [
			snapshot({ posted: { id: '1', title: 'first' } }),
		]);
		const { catalog, resolvers, sources } = composeServices({
			posts: posts.service,
		});

		await firstFew(
			subscribe({
				request: 'live L { posted { title } }',
				catalog,
				resolvers,
				sources,
			}),
			1
		);

		expect(posts.sent[0]).toBe('live { posted { title } }');
	});

	it('carries what the field was asked with', async () => {
		const withArgs = buildCatalog(`
			type Live { beat(every: Int!): Int! }
			type Query { hello: String! }
			schema { query: Query, live: Live }
		`);
		const ticks = streaming(withArgs, [snapshot({ beat: 1 })]);
		const { catalog, resolvers, sources } = composeServices({
			ticks: ticks.service,
		});

		await firstFew(
			subscribe({
				request: 'live L { beat(every: 5) }',
				catalog,
				resolvers,
				sources,
			}),
			1
		);

		expect(ticks.sent[0]).toBe('live { beat(every: 5) }');
	});

	it('tells the service when the watcher goes away', async () => {
		const controller = new AbortController();
		const ticks = streaming(ticksCatalog, [snapshot({ beat: 1 })]);
		const { catalog, resolvers, sources } = composeServices({
			ticks: ticks.service,
		});

		await firstFew(
			subscribe({
				request: 'live L { beat }',
				catalog,
				resolvers,
				sources,
				signal: controller.signal,
			}),
			1
		);

		expect(ticks.seenSignal()).toBe(controller.signal);
	});

	it('reports what a service said went wrong', async () => {
		const failing: NexService = {
			catalog: ticksCatalog,
			request: () => snapshot({}),
			subscribe: async function* () {
				yield {
					data: null,
					errors: [{ message: 'the stream is down' }],
					extensions: { cost: 0 },
				} as never;
			},
		};

		const { catalog, resolvers, sources } = composeServices({
			ticks: failing,
		});

		const seen = await firstFew(
			subscribe({ request: 'live L { beat }', catalog, resolvers, sources }),
			1
		);

		expect(seen[0]?.errors?.[0]?.message).toMatch(/the stream is down/);
	});
});

describe('a service that does not stream', () => {
	it('contributes no live fields rather than one that never answers', async () => {
		const { sources } = composeServices({
			ticks: { catalog: ticksCatalog, request: () => snapshot({}) },
		});

		// A resolver registered for a live field would never be reached, and
		// would look like the field was served when it was not.
		expect(sources.Live).toBeUndefined();
	});

	it('still serves the queries it owns', async () => {
		const { resolvers } = composeServices({
			ticks: { catalog: ticksCatalog, request: () => snapshot({}) },
		});

		expect(Object.keys(resolvers.Query ?? {})).toContain('hello');
	});

	it('never registers a live field as a resolver', () => {
		const ticks = streaming(ticksCatalog, []);
		const { resolvers } = composeServices({ ticks: ticks.service });

		expect(resolvers.Live).toBeUndefined();
	});
});
