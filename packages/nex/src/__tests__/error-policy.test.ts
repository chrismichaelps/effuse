/**
 * MIT License
 *
 * Copyright (c) 2025 Chris M. Perez
 */

import { describe, expect, it } from 'vitest';
import { buildCatalog, ErrorPolicy, execute, subscribe } from '../index.js';
import type { ExecutionResult, Resolvers } from '../index.js';

const catalog = buildCatalog(`
	type Query { ok: String! broken: String? alsoBroken: String? }
	type Live { beat: Int! }
	schema { query: Query, live: Live }
`);

const resolvers: Resolvers = {
	Query: {
		ok: () => 'fine',
		broken: () => {
			throw new Error('the source is down');
		},
		alsoBroken: () => {
			throw new Error('so is the other one');
		},
	},
};

const run = (policy: unknown) =>
	execute({
		request: '{ ok broken alsoBroken }',
		catalog,
		resolvers,
		errorPolicy: policy as ErrorPolicy,
	});

describe('what a run does with a field that failed', () => {
	it('keeps what worked and says what did not', async () => {
		const result = await run(ErrorPolicy.PARTIAL);

		expect(result.data).toMatchObject({ ok: 'fine', broken: null });
		expect(result.errors).toHaveLength(2);
	});

	it('stops at the first when told to', async () => {
		const result = await run(ErrorPolicy.FAIL_FAST);

		expect(result.data).toBeNull();
		expect(result.errors).toHaveLength(1);
	});

	it('says nothing about them when told to', async () => {
		const result = await run(ErrorPolicy.IGNORE);

		// This is what the policy is for: the fields are null and the reasons
		// never leave the server.
		expect(result.data).toMatchObject({ ok: 'fine', broken: null });
		expect(result.errors).toBeUndefined();
	});
});

describe('a policy nobody defined', () => {
	it('is refused rather than quietly taken as the default', async () => {
		const result = await run('nonsense');

		// Falling back would hand a server that asked to say nothing the
		// policy that says everything, which is the one thing it asked not to
		// happen.
		expect(result.data).toBeNull();
		expect(result.errors?.[0]?.message).toMatch(/"nonsense" is not a way of/);
	});

	it('names the ones there are', async () => {
		const result = await run('nonsense');

		expect(result.errors?.[0]?.message).toMatch(/partial/);
		expect(result.errors?.[0]?.message).toMatch(/ignore/);
	});

	it('takes the default when nothing was asked for', async () => {
		const result = await execute({
			request: '{ ok broken }',
			catalog,
			resolvers,
		});

		expect(result.data).toMatchObject({ ok: 'fine' });
		expect(result.errors).toHaveLength(1);
	});

	it('is refused for a live operation too', async () => {
		const seen: ExecutionResult[] = [];
		for await (const snapshot of subscribe({
			request: 'live L { beat }',
			catalog,
			errorPolicy: 'nonsense' as ErrorPolicy,
			sources: {
				Live: {
					beat: async function* () {
						yield 1;
					},
				},
			},
		})) {
			seen.push(snapshot);
		}

		expect(seen[0]?.errors?.[0]?.message).toMatch(/"nonsense" is not a way of/);
	});
});
