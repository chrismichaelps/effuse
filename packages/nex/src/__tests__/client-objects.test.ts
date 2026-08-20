/**
 * MIT License
 *
 * Copyright (c) 2025 Chris M. Perez
 */

import { describe, expect, it } from 'vitest';
import { createNexClient, refFor } from '../index.js';

const ada = refFor('Person', '1');
const grace = refFor('Person', '2');

/** A server that answers whatever it is told to, and counts what it was asked. */
const server = (answers: Record<string, unknown>) => {
	const asked: string[] = [];

	const fetchImpl = (async (_url: string, init: RequestInit) => {
		const body = JSON.parse(String(init.body)) as { query: string };
		asked.push(body.query);

		return new Response(
			JSON.stringify({
				data: answers[body.query] ?? null,
				extensions: { cost: 1 },
			}),
			{ headers: { 'content-type': 'application/json' } }
		);
	}) as unknown as typeof fetch;

	return { asked, fetchImpl };
};

const PEOPLE = '{ people { __ref name } }';
const ONE = '{ person { __ref name age } }';

const answers = {
	[PEOPLE]: {
		people: [
			{ __ref: ada, name: 'Ada' },
			{ __ref: grace, name: 'Grace' },
		],
	},
	[ONE]: { person: { __ref: ada, age: 36 } },
};

describe('what a client knows about an object', () => {
	it('reads back an object an answer carried', async () => {
		const { fetchImpl } = server(answers);
		const nex = createNexClient({ endpoint: '/nex', fetch: fetchImpl });

		await nex.request(PEOPLE);

		expect(nex.readObject(ada)).toEqual({ __ref: ada, name: 'Ada' });
	});

	it('knows nothing about an object it has not seen', async () => {
		const { fetchImpl } = server(answers);
		const nex = createNexClient({ endpoint: '/nex', fetch: fetchImpl });

		expect(nex.readObject(ada)).toBeUndefined();
	});

	it('joins what two answers said about one object', async () => {
		const { fetchImpl } = server(answers);
		const nex = createNexClient({ endpoint: '/nex', fetch: fetchImpl });

		await nex.request(PEOPLE);
		await nex.request(ONE);

		// Neither answer alone carries both fields.
		expect(nex.readObject(ada)).toEqual({
			__ref: ada,
			name: 'Ada',
			age: 36,
		});
	});

	it('finds an object however deep in the answer it was', async () => {
		const { fetchImpl } = server({
			'{ team { lead { __ref name } } }': {
				team: { lead: { __ref: ada, name: 'Ada' } },
			},
		});
		const nex = createNexClient({ endpoint: '/nex', fetch: fetchImpl });

		await nex.request('{ team { lead { __ref name } } }');

		expect(nex.readObject(ada)).toMatchObject({ name: 'Ada' });
	});
});

describe('forgetting one object', () => {
	it('drops every answer that carried it', async () => {
		const { asked, fetchImpl } = server(answers);
		const nex = createNexClient({ endpoint: '/nex', fetch: fetchImpl });

		await nex.request(PEOPLE);
		await nex.request(ONE);
		expect(asked).toHaveLength(2);

		nex.evict(ada);

		await nex.request(PEOPLE);
		await nex.request(ONE);

		// Both held Ada, so both are asked again.
		expect(asked).toHaveLength(4);
	});

	it('keeps the answers that did not carry it', async () => {
		const { asked, fetchImpl } = server(answers);
		const nex = createNexClient({ endpoint: '/nex', fetch: fetchImpl });

		await nex.request(PEOPLE);
		await nex.request(ONE);

		nex.evict(grace);

		await nex.request(ONE);

		// Only the list held Grace; the single answer is still good.
		expect(asked).toHaveLength(2);
	});

	it('forgets what it knew about the object itself', async () => {
		const { fetchImpl } = server(answers);
		const nex = createNexClient({ endpoint: '/nex', fetch: fetchImpl });

		await nex.request(PEOPLE);
		nex.evict(ada);

		expect(nex.readObject(ada)).toBeUndefined();
	});

	it('stops counting a dropped answer as holding anything', async () => {
		const asked: string[] = [];
		let carriesGrace = true;

		const fetchImpl = (async (_url: string, init: RequestInit) => {
			const body = JSON.parse(String(init.body)) as { query: string };
			asked.push(body.query);

			const people = carriesGrace
				? [
						{ __ref: ada, name: 'Ada' },
						{ __ref: grace, name: 'Grace' },
					]
				: [{ __ref: ada, name: 'Ada' }];

			return new Response(
				JSON.stringify({ data: { people }, extensions: { cost: 1 } }),
				{ headers: { 'content-type': 'application/json' } }
			);
		}) as unknown as typeof fetch;

		const nex = createNexClient({ endpoint: '/nex', fetch: fetchImpl });

		await nex.request(PEOPLE);
		nex.evict(ada);

		// The answer that held Grace is gone; the one that replaces it does not.
		carriesGrace = false;
		await nex.request(PEOPLE);
		asked.length = 0;

		nex.evict(grace);
		await nex.request(PEOPLE);

		expect(asked).toEqual([]);
	});

	it('does nothing about an object it never saw', async () => {
		const { asked, fetchImpl } = server(answers);
		const nex = createNexClient({ endpoint: '/nex', fetch: fetchImpl });

		await nex.request(PEOPLE);
		nex.evict(refFor('Person', '404'));
		await nex.request(PEOPLE);

		expect(asked).toHaveLength(1);
	});

	it('forgets objects when everything is forgotten', async () => {
		const { fetchImpl } = server(answers);
		const nex = createNexClient({ endpoint: '/nex', fetch: fetchImpl });

		await nex.request(PEOPLE);
		nex.clear();

		expect(nex.readObject(ada)).toBeUndefined();
	});
});

describe('objects across a render and the browser', () => {
	it('knows what the render saw', async () => {
		const { fetchImpl } = server(answers);
		const rendering = createNexClient({ endpoint: '/nex', fetch: fetchImpl });
		await rendering.prefetch(PEOPLE);

		const browser = createNexClient({ endpoint: '/nex', fetch: fetchImpl });
		browser.hydrate(rendering.dehydrate());

		expect(browser.readObject(ada)).toMatchObject({ name: 'Ada' });
	});

	it('can forget one of them without asking again for the rest', async () => {
		const { asked, fetchImpl } = server(answers);
		const rendering = createNexClient({ endpoint: '/nex', fetch: fetchImpl });
		await rendering.prefetch(PEOPLE);
		await rendering.prefetch(ONE);

		const browser = createNexClient({ endpoint: '/nex', fetch: fetchImpl });
		browser.hydrate(rendering.dehydrate());
		asked.length = 0;

		browser.evict(grace);
		await browser.request(ONE);
		await browser.request(PEOPLE);

		expect(asked).toEqual([PEOPLE]);
	});
});

describe('a client that keeps nothing', () => {
	it('holds no objects either', async () => {
		const { fetchImpl } = server(answers);
		const nex = createNexClient({
			endpoint: '/nex',
			fetch: fetchImpl,
			cache: false,
		});

		await nex.request(PEOPLE);

		expect(nex.readObject(ada)).toBeUndefined();
	});
});
