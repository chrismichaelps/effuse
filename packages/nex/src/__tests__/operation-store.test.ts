/**
 * MIT License
 *
 * Copyright (c) 2025 Chris M. Perez
 */

import { describe, expect, it } from 'vitest';
import {
	NexErrorCode,
	buildCatalog,
	createOperationStore,
	normalizeRequest,
	requestKey,
} from '../index.js';
import { handleProtocolRequest } from '../transport/index.js';

const catalog = buildCatalog(`
	type Query { hello: String! echo(text: String!): String! }
	type Mutation { touch: Boolean! }
	schema { query: Query mutation: Mutation }
`);

const resolvers = {
	Query: {
		hello: () => 'world',
		echo: (_s: unknown, args: Record<string, unknown>) => String(args.text),
	},
	Mutation: { touch: () => true },
};

const post = (body: unknown, options: Record<string, unknown> = {}) =>
	handleProtocolRequest(
		{
			method: 'POST',
			url: '/nex',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify(body),
		},
		{ catalog, resolvers, ...options }
	);

const jsonOf = (body: string | undefined): Record<string, unknown> =>
	JSON.parse(body ?? '{}') as Record<string, unknown>;

/** The messages a response carried, whatever else it holds. */
const messagesOf = (body: string | undefined): readonly string[] =>
	((jsonOf(body).errors ?? []) as { message: string }[]).map(
		(error) => error.message
	);

describe('holding the operations a server will run', () => {
	it('names each operation by what it does', async () => {
		const store = createOperationStore();
		const id = await store.register('{ hello }');

		expect(id).toBe(await requestKey('{ hello }'));
		expect(store.has(id)).toBe(true);
		expect(store.size).toBe(1);
	});

	it('gives the same name to the same operation written differently', async () => {
		const store = createOperationStore();

		expect(await store.register('{ hello }')).toBe(
			await store.register('{\n\thello\n}')
		);
		expect(store.size).toBe(1);
	});

	it('holds each operation in one canonical form', async () => {
		const store = createOperationStore();
		const id = await store.register('query  A   {   hello }');

		expect(store.get(id)).toBe(normalizeRequest('query A { hello }'));
	});

	it('is built from what a client shipped', async () => {
		const store = await createOperationStore.from([
			'{ hello }',
			'query Echo($text: String!) { echo(text: $text) }',
		]);

		expect(store.size).toBe(2);
		expect(store.get(await requestKey('{ hello }'))).toContain('hello');
	});

	it('has nothing to say about a name it does not hold', () => {
		expect(createOperationStore().get('nope')).toBeUndefined();
	});
});

describe('running an operation by name', () => {
	it('runs what the name points at', async () => {
		const store = createOperationStore();
		const id = await store.register('{ hello }');

		const response = await post({ id }, { operations: store });

		expect(response.status).toBe(200);
		expect(jsonOf(response.body)).toMatchObject({ data: { hello: 'world' } });
	});

	it('takes variables alongside the name', async () => {
		const store = createOperationStore();
		const id = await store.register(
			'query Echo($text: String!) { echo(text: $text) }'
		);

		const response = await post(
			{ id, variables: { text: 'named' } },
			{ operations: store }
		);

		expect(jsonOf(response.body)).toMatchObject({ data: { echo: 'named' } });
	});

	it('refuses a name the store does not hold', async () => {
		const response = await post(
			{ id: 'unknown' },
			{ operations: createOperationStore() }
		);

		expect(response.status).toBe(400);
		expect(jsonOf(response.body)).toMatchObject({
			errors: [{ extensions: { code: NexErrorCode.VALIDATION } }],
		});
	});

	it('refuses a name when the server holds no store at all', async () => {
		const response = await post({ id: 'anything' });

		expect(response.status).toBe(400);
		expect(messagesOf(response.body)[0]).toMatch(
			/No operation is registered under "anything"/
		);
	});

	it('still runs a request sent whole', async () => {
		const store = createOperationStore();
		const response = await post({ query: '{ hello }' }, { operations: store });

		expect(jsonOf(response.body)).toMatchObject({ data: { hello: 'world' } });
	});
});

describe('accepting only the operations a server knows', () => {
	it('refuses a request sent whole', async () => {
		const store = createOperationStore();
		await store.register('{ hello }');

		const response = await post(
			{ query: '{ hello }' },
			{ operations: store, persistedOnly: true }
		);

		expect(response.status).toBe(400);
		expect(messagesOf(response.body)[0]).toMatch(
			/only runs operations it knows/i
		);
	});

	it('runs one it knows by name', async () => {
		const store = createOperationStore();
		const id = await store.register('{ hello }');

		const response = await post(
			{ id },
			{ operations: store, persistedOnly: true }
		);

		expect(response.status).toBe(200);
	});

	it('batches by name as well', async () => {
		const store = createOperationStore();
		const first = await store.register('{ hello }');
		const second = await store.register(
			'query Echo($text: String!) { echo(text: $text) }'
		);

		const response = await post(
			[{ id: first }, { id: second, variables: { text: 'two' } }],
			{ operations: store, persistedOnly: true }
		);

		expect(JSON.parse(response.body ?? '[]')).toMatchObject([
			{ data: { hello: 'world' } },
			{ data: { echo: 'two' } },
		]);
	});
});
