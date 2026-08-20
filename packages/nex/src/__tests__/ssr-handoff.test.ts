/**
 * MIT License
 *
 * Copyright (c) 2025 Chris M. Perez
 */

import {
	afterAll,
	afterEach,
	beforeAll,
	describe,
	expect,
	it,
	vi,
} from 'vitest';
import {
	clearGlobalTracing,
	createSSRRuntime,
	CreateElementNode,
	CreateTextNode,
	define,
	EFFUSE_NODE,
	renderToString,
} from '@effuse/core';
import { createNodeServer } from '@effuse/server';
import {
	buildCatalog,
	createNexClient,
	createNexHandler,
	loadNexState,
	saveNexState,
	type NexClient,
} from '../index.js';

afterEach(() => {
	clearGlobalTracing();
});

const catalog = buildCatalog(`
	type Post @identity { id: ID! title: String! }
	type Query { posts: [Post!]! @connection }
	schema { query: Query }
`);

let served = 0;

const handler = createNexHandler({
	catalog,
	resolvers: {
		Query: {
			posts: () => {
				served += 1;
				return [
					{ id: '1', title: 'first' },
					{ id: '2', title: 'second' },
				];
			},
		},
	},
});

const FEED = '{ posts | page first: 2 { __ref title } }';

let origin = '';
let server: Awaited<ReturnType<typeof createNodeServer>> | undefined;

beforeAll(async () => {
	server = createNodeServer(handler);
	const address = await server.listen({ port: 0 });
	origin = `http://127.0.0.1:${String(address.port)}`;
});

afterAll(async () => {
	await server?.close();
});

const text = (value: string) =>
	CreateTextNode({ [EFFUSE_NODE]: true, text: value });

const element = (
	tag: string,
	props: Record<string, unknown>,
	children: unknown[]
) =>
	CreateElementNode({
		[EFFUSE_NODE]: true,
		tag,
		props,
		children: children as never,
	});

interface Feed {
	readonly posts: { readonly items: readonly { readonly title: string }[] };
}

/**
 * What a server does for one page: fetch what the page needs, render it, and
 * put what it fetched where the browser will find it.
 */
const renderPage = async (
	client: NexClient
): Promise<{
	readonly html: string;
	readonly state: Record<string, unknown>;
}> => {
	const runtime = await createSSRRuntime([]);

	const answer = await client.request<Feed>(FEED);
	saveNexState(runtime.state, client);

	const page = define({
		props: {},
		script: () => ({}),
		template: (() =>
			element(
				'ul',
				{},
				(answer.data?.posts.items ?? []).map((post) =>
					element('li', {}, [text(post.title)])
				)
			)) as never,
	});

	const rendered = runtime.run(() =>
		renderToString(page as never, '/', runtime)
	);
	await runtime.dispose();

	return { html: rendered.html, state: rendered.state };
};

/** What the browser does: take what the render already knows. */
const browserClient = (state: Record<string, unknown>): NexClient => {
	const client = createNexClient({ endpoint: `${origin}/nex` });
	loadNexState(state, client);
	return client;
};

describe('rendering a page on the server', () => {
	it('renders what the server fetched', async () => {
		served = 0;
		const client = createNexClient({ endpoint: `${origin}/nex` });

		const { html } = await renderPage(client);

		expect(html).toContain('<li>first</li>');
		expect(html).toContain('<li>second</li>');
		expect(served).toBe(1);
	});

	it('carries what it fetched in the page it rendered', async () => {
		const client = createNexClient({ endpoint: `${origin}/nex` });

		const { state } = await renderPage(client);

		expect(state).toHaveProperty('nex');
	});
});

describe('the browser taking over', () => {
	it('asks the server nothing the render already asked', async () => {
		const render = createNexClient({ endpoint: `${origin}/nex` });
		const { state } = await renderPage(render);

		served = 0;
		const browser = browserClient(state);
		const answer = await browser.request<Feed>(FEED);

		expect(answer.data?.posts.items).toHaveLength(2);
		expect(served).toBe(0);
	});

	it('knows the objects the render saw', async () => {
		const render = createNexClient({ endpoint: `${origin}/nex` });
		const { state } = await renderPage(render);

		const browser = browserClient(state);
		const answer = await browser.request<Feed>(FEED);
		const [first] = answer.data?.posts.items ?? [];
		const reference = (first as unknown as { __ref: string }).__ref;

		expect(browser.readObject(reference)).toMatchObject({ title: 'first' });
	});

	it('goes to the server for anything the render did not fetch', async () => {
		const render = createNexClient({ endpoint: `${origin}/nex` });
		const { state } = await renderPage(render);

		served = 0;
		const browser = browserClient(state);
		await browser.request('{ posts | page first: 1 { title } }');

		expect(served).toBe(1);
	});

	it('survives the trip as JSON, which is how it travels', async () => {
		const render = createNexClient({ endpoint: `${origin}/nex` });
		const { state } = await renderPage(render);

		// What a server inlines into the page and a browser parses back out.
		const travelled = JSON.parse(JSON.stringify(state)) as Record<
			string,
			unknown
		>;

		served = 0;
		const browser = browserClient(travelled);
		await browser.request<Feed>(FEED);

		expect(served).toBe(0);
	});

	it('takes nothing from a page that carried none', () => {
		const browser = createNexClient({ endpoint: `${origin}/nex` });

		expect(loadNexState({}, browser)).toBe(false);
	});

	it('takes nothing from a page whose state is not ours', () => {
		const browser = createNexClient({ endpoint: `${origin}/nex` });

		expect(loadNexState({ nex: 'nonsense' }, browser)).toBe(false);
	});

	it('takes nothing from a page whose state is the wrong shape', () => {
		const browser = createNexClient({ endpoint: `${origin}/nex` });

		// Right key, wrong contents - a page built by something else, or one
		// whose state was truncated on the way.
		expect(loadNexState({ nex: { results: 'not a list' } }, browser)).toBe(
			false
		);
		expect(loadNexState({ nex: { results: [{ key: 1 }] } }, browser)).toBe(
			false
		);
	});

	it('says when it took something', async () => {
		const render = createNexClient({ endpoint: `${origin}/nex` });
		const { state } = await renderPage(render);
		const browser = createNexClient({ endpoint: `${origin}/nex` });

		expect(loadNexState(state, browser)).toBe(true);
	});
});

describe('a render that fetched nothing', () => {
	it('leaves nothing behind rather than an empty shell', async () => {
		const runtime = await createSSRRuntime([]);
		const client = createNexClient({ endpoint: `${origin}/nex` });

		saveNexState(runtime.state, client);

		expect(runtime.state.has('nex')).toBe(false);
		await runtime.dispose();
	});
});

describe('one render never sees another', () => {
	it('gives each page its own client and its own state', async () => {
		const first = createNexClient({ endpoint: `${origin}/nex` });
		const second = createNexClient({ endpoint: `${origin}/nex` });

		await first.request(FEED);
		const runtime = await createSSRRuntime([]);
		saveNexState(runtime.state, second);

		// The second render fetched nothing, so it carries nothing - what the
		// first one fetched is not waiting in a shared place.
		expect(runtime.state.has('nex')).toBe(false);
		await runtime.dispose();
		vi.clearAllMocks();
	});
});
