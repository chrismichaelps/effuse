/**
 * MIT License
 *
 * Copyright (c) 2025 Chris M. Perez
 */

import { describe, expect, it, vi } from 'vitest';
import {
	NexErrorCode,
	buildCatalog,
	createNexHandler,
	execute,
	subscribe,
} from '../index.js';

const catalog = buildCatalog(`
	schema { query: Query live: Live }
	type Query { slow: String! quick: String! nested: Branch! }
	type Branch { deeper: String! }
	type Live { ticks: Int! }
`);

const never = () => new Promise<string>(() => undefined);

describe('a run the caller walked away from', () => {
	it('is refused outright when the signal was already spent', async () => {
		const resolver = vi.fn(() => 'quick');
		const result = await execute({
			request: '{ quick }',
			catalog,
			resolvers: { Query: { quick: resolver } },
			signal: AbortSignal.abort(),
		});

		expect(result.data).toBeNull();
		expect(result.errors?.[0]?.code).toBe(NexErrorCode.ABORTED);
		expect(resolver).not.toHaveBeenCalled();
	});

	it('stops resolving fields it has not reached', async () => {
		const controller = new AbortController();
		const deeper = vi.fn(() => 'deeper');

		const result = await execute({
			request: '{ nested { deeper } }',
			catalog,
			resolvers: {
				Query: {
					nested: () => {
						controller.abort();
						return {};
					},
				},
				Branch: { deeper },
			},
			signal: controller.signal,
		});

		expect(deeper).not.toHaveBeenCalled();
		expect(result.data).toBeNull();
		expect(result.errors?.[0]?.code).toBe(NexErrorCode.ABORTED);
	});

	it('carries the reason the caller gave', async () => {
		const controller = new AbortController();
		controller.abort(new Error('the client went away'));

		const result = await execute({
			request: '{ quick }',
			catalog,
			resolvers: { Query: { quick: () => 'quick' } },
			signal: controller.signal,
		});

		expect(result.errors?.[0]?.message).toContain('the client went away');
	});

	it('leaves a run with no signal alone', async () => {
		const result = await execute({
			request: '{ quick }',
			catalog,
			resolvers: { Query: { quick: () => 'quick' } },
		});

		expect(result.data).toEqual({ quick: 'quick' });
	});

	it('leaves a run whose caller stayed alone', async () => {
		const controller = new AbortController();
		const result = await execute({
			request: '{ quick }',
			catalog,
			resolvers: { Query: { quick: () => 'quick' } },
			signal: controller.signal,
		});

		expect(result.data).toEqual({ quick: 'quick' });
		expect(result.errors).toBeUndefined();
	});
});

describe('a live operation the caller walked away from', () => {
	it('closes its source', async () => {
		const controller = new AbortController();
		let closed = false;

		const stream = subscribe({
			request: 'live L { ticks }',
			catalog,
			signal: controller.signal,
			sources: {
				Live: {
					ticks: async function* () {
						try {
							for (let tick = 1; ; tick += 1) {
								await new Promise((resolve) => setTimeout(resolve, 1));
								yield tick;
							}
						} finally {
							closed = true;
						}
					},
				},
			},
		});

		const seen: unknown[] = [];
		for await (const snapshot of stream) {
			seen.push(snapshot.data);
			controller.abort();
		}

		expect(seen.length).toBeGreaterThan(0);
		expect(closed).toBe(true);
	});

	it('never opens a source for a caller already gone', async () => {
		const source = vi.fn(async function* () {
			yield 1;
		});
		const seen: unknown[] = [];

		for await (const snapshot of subscribe({
			request: 'live L { ticks }',
			catalog,
			signal: AbortSignal.abort(),
			sources: { Live: { ticks: source } },
		})) {
			seen.push(snapshot);
		}

		expect(source).not.toHaveBeenCalled();
		expect(seen).toHaveLength(1);
		expect((seen[0] as { errors?: { code: string }[] }).errors?.[0]?.code).toBe(
			NexErrorCode.ABORTED
		);
	});
});

describe('a request abandoned over the wire', () => {
	it('stops the run when the connection goes', async () => {
		const slow = vi.fn(never);
		const handler = createNexHandler({
			catalog,
			resolvers: { Query: { slow } },
		});

		const controller = new AbortController();
		controller.abort();

		const response = await handler(
			new Request('https://example.com/nex', {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({ query: '{ slow }' }),
				signal: controller.signal,
			})
		);
		const body = (await response.json()) as {
			errors?: { message: string }[];
		};

		expect(slow).not.toHaveBeenCalled();
		expect(body.errors?.[0]?.message).toMatch(/called off/i);
	});
});
