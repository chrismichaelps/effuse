/**
 * MIT License
 *
 * Copyright (c) 2025 Chris M. Perez
 */

import { describe, expect, it } from 'vitest';
import { buildCatalog, execute } from '../index.js';

const catalog = buildCatalog(`
	type Query { slow: String! quick: String! }
	schema { query: Query }
`);

describe('a resolver that can be called off', () => {
	it('is given the signal the run was started with', async () => {
		const controller = new AbortController();
		let seen: AbortSignal | undefined;

		await execute({
			request: '{ quick }',
			catalog,
			signal: controller.signal,
			resolvers: {
				Query: {
					quick: (_source, _args, _context, info) => {
						seen = info.signal;
						return 'here';
					},
				},
			},
		});

		expect(seen).toBe(controller.signal);
	});

	it('is given nothing when the run cannot be called off', async () => {
		let seen: AbortSignal | undefined = new AbortController().signal;

		await execute({
			request: '{ quick }',
			catalog,
			resolvers: {
				Query: {
					quick: (_source, _args, _context, info) => {
						seen = info.signal;
						return 'here';
					},
				},
			},
		});

		expect(seen).toBeUndefined();
	});

	it('can hand it to work it starts itself', async () => {
		const controller = new AbortController();

		const result = execute({
			request: '{ slow }',
			catalog,
			signal: controller.signal,
			resolvers: {
				Query: {
					slow: (_source, _args, _context, info) =>
						new Promise<string>((resolve, reject) => {
							const timer = setTimeout(() => resolve('eventually'), 5_000);
							info.signal?.addEventListener('abort', () => {
								clearTimeout(timer);
								reject(new Error('the caller went away'));
							});
						}),
				},
			},
		});

		controller.abort();

		const answered = await result;
		expect(answered.errors?.[0]?.message).toMatch(/went away|called off/i);
	});
});
