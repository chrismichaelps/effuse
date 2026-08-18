// @vitest-environment jsdom
/**
 * MIT License
 *
 * Copyright (c) 2025 Chris M. Perez
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../../app/createApp.js';
import { define } from '../../blueprint/define.js';
import { signal } from '../../reactivity/signal.js';
import {
	EFFUSE_NODE,
	CreateBlueprintNode,
	CreateElementNode,
	CreateListNode,
	type Component,
} from '../../render/node.js';
import { renderToFragment } from '../../ssr/render.js';
import { createHandler } from '../../ssr/handler.js';
import { createSSRRuntime } from '../../ssr/runtime.js';
import { serializeHydrationData } from '../../ssr/hydration.js';
import { clearGlobalLayerContext } from '../../layers/context.js';
import { clearGlobalTracing } from '../../layers/tracing/index.js';

const flushRenderer = async (): Promise<void> => {
	await Promise.resolve();
	await Promise.resolve();
	await Promise.resolve();
	await Promise.resolve();
};

const el = (
	tag: string,
	props: Record<string, unknown>,
	children: unknown[]
): ReturnType<typeof CreateElementNode> =>
	CreateElementNode({
		[EFFUSE_NODE]: true,
		tag,
		props,
		children: children as never,
	});

const use = (blueprint: unknown, props: Record<string, unknown> = {}) =>
	CreateBlueprintNode({
		[EFFUSE_NODE]: true,
		blueprint: blueprint as never,
		props,
		portals: null,
	});

/** Renders exactly what the server would put inside the app container. */
const renderServerMarkup = async (root: Component): Promise<string> => {
	const runtime = await createSSRRuntime([]);
	try {
		return runtime.run(() => renderToFragment(root, runtime));
	} finally {
		await runtime.dispose();
	}
};

const seedServerDocument = async (
	root: Component,
	{ payload = true }: { payload?: boolean } = {}
): Promise<string> => {
	const markup = await renderServerMarkup(root);
	const hydrationScript = payload
		? serializeHydrationData({ head: {}, state: {}, url: '/' })
		: '';
	document.body.innerHTML = `<div id="app">${markup}</div>${hydrationScript}`;
	return markup;
};

describe('client hydration (issue #432)', () => {
	let mounted: { unmount: () => Promise<void> } | null = null;

	beforeEach(() => {
		document.body.innerHTML = '<div id="app"></div>';
		mounted = null;
	});

	afterEach(async () => {
		if (mounted) {
			await mounted.unmount();
		}
		mounted = null;
		document.body.innerHTML = '';
		clearGlobalLayerContext();
		clearGlobalTracing();
	});

	const Counter = define({
		script: () => {
			const count = signal(0);
			return {
				count,
				increment: () => {
					count.value += 1;
				},
			};
		},
		template: ({ count, increment }) =>
			el('button', { 'data-testid': 'count', onClick: increment }, [
				count.value,
			]),
	});

	const Page = define({
		script: () => ({}),
		template: () =>
			el('div', { class: 'docs-layout' }, [
				el('h1', {}, ['Hooks']),
				use(Counter),
			]),
	});

	describe('adopting server markup', () => {
		it('renders a single copy of the app instead of a second tree', async () => {
			await seedServerDocument(Page as Component);

			mounted = await createApp(Page as Component).mount('#app', {
				hydrate: true,
			});
			await flushRenderer();

			expect(document.querySelectorAll('.docs-layout')).toHaveLength(1);
			expect(document.querySelectorAll('h1')).toHaveLength(1);
			expect(document.querySelectorAll('[data-testid="count"]')).toHaveLength(
				1
			);
		});

		it('reuses the server-rendered DOM nodes', async () => {
			await seedServerDocument(Page as Component);
			const serverLayout = document.querySelector('.docs-layout');
			const serverHeading = document.querySelector('h1');
			const serverText = serverHeading?.firstChild;

			mounted = await createApp(Page as Component).mount('#app', {
				hydrate: true,
			});
			await flushRenderer();

			expect(document.querySelector('.docs-layout')).toBe(serverLayout);
			expect(document.querySelector('h1')).toBe(serverHeading);
			expect(document.querySelector('h1')?.firstChild).toBe(serverText);
		});

		it('binds event handlers to the adopted nodes', async () => {
			await seedServerDocument(Page as Component);
			const serverButton = document.querySelector('[data-testid="count"]');

			mounted = await createApp(Page as Component).mount('#app', {
				hydrate: true,
			});
			await flushRenderer();

			expect(serverButton?.textContent).toBe('0');
			(serverButton as HTMLButtonElement).click();
			await flushRenderer();

			expect(serverButton?.textContent).toBe('1');
			expect(document.querySelectorAll('[data-testid="count"]')).toHaveLength(
				1
			);
		});

		it('keeps reactive updates working on adopted nodes', async () => {
			const title = signal('Hooks');
			const Reactive = define({
				script: () => ({ title }),
				template: ({ title }) =>
					el('h1', { 'data-testid': 'title' }, [title.value]),
			});

			await seedServerDocument(Reactive as Component);
			const heading = document.querySelector('[data-testid="title"]');

			mounted = await createApp(Reactive as Component).mount('#app', {
				hydrate: true,
			});
			await flushRenderer();

			title.value = 'Layers';
			await flushRenderer();

			expect(heading?.textContent).toBe('Layers');
			expect(document.querySelectorAll('h1')).toHaveLength(1);
		});

		it('exposes a dedicated hydrate() entry point', async () => {
			await seedServerDocument(Page as Component);
			const serverHeading = document.querySelector('h1');

			mounted = await createApp(Page as Component).hydrate('#app');
			await flushRenderer();

			expect(document.querySelector('h1')).toBe(serverHeading);
			expect(document.querySelectorAll('h1')).toHaveLength(1);
		});

		it('hydrates lists without duplicating items', async () => {
			const List = define({
				script: () => ({ items: ['a', 'b', 'c'] }),
				template: ({ items }) =>
					el(
						'ul',
						{},
						(items as string[]).map((item) => el('li', {}, [item]))
					),
			});

			await seedServerDocument(List as Component);
			const serverItems = [...document.querySelectorAll('li')];

			mounted = await createApp(List as Component).mount('#app', {
				hydrate: true,
			});
			await flushRenderer();

			const items = [...document.querySelectorAll('li')];
			expect(items).toHaveLength(3);
			expect(items).toEqual(serverItems);
			expect(items.map((item) => item.textContent)).toEqual(['a', 'b', 'c']);
		});

		it('claims adjacent text produced as a single server text node', async () => {
			const Greeting = define({
				script: () => ({ name: 'Effuse' }),
				template: ({ name }) =>
					el('p', { 'data-testid': 'greeting' }, ['Hello, ', name, '!']),
			});

			await seedServerDocument(Greeting as Component);
			const paragraph = document.querySelector('[data-testid="greeting"]');
			expect(paragraph?.childNodes).toHaveLength(1);

			mounted = await createApp(Greeting as Component).mount('#app', {
				hydrate: true,
			});
			await flushRenderer();

			expect(document.querySelector('[data-testid="greeting"]')).toBe(
				paragraph
			);
			expect(paragraph?.textContent).toBe('Hello, Effuse!');
			expect(document.querySelectorAll('p')).toHaveLength(1);
		});
	});

	describe('auto-detection', () => {
		it('hydrates automatically when the container holds server markup', async () => {
			await seedServerDocument(Page as Component);
			const serverHeading = document.querySelector('h1');

			mounted = await createApp(Page as Component).mount('#app');
			await flushRenderer();

			expect(document.querySelector('h1')).toBe(serverHeading);
			expect(document.querySelectorAll('h1')).toHaveLength(1);
		});

		it('does not hydrate when no hydration payload was emitted', async () => {
			await seedServerDocument(Page as Component, { payload: false });
			const serverHeading = document.querySelector('h1');

			mounted = await createApp(Page as Component).mount('#app');
			await flushRenderer();

			expect(document.querySelector('h1')).not.toBe(serverHeading);
			expect(document.querySelectorAll('h1')).toHaveLength(1);
		});

		it('replaces server markup when hydration is explicitly disabled', async () => {
			await seedServerDocument(Page as Component);
			const serverHeading = document.querySelector('h1');

			mounted = await createApp(Page as Component).mount('#app', {
				hydrate: false,
			});
			await flushRenderer();

			expect(document.querySelector('h1')).not.toBe(serverHeading);
			expect(document.querySelectorAll('h1')).toHaveLength(1);
		});

		it('never leaves a stale copy behind on a plain client mount', async () => {
			document.body.innerHTML = '<div id="app"><p>stale</p></div>';

			mounted = await createApp(Page as Component).mount('#app', {
				hydrate: false,
			});
			await flushRenderer();

			expect(document.body.textContent).not.toContain('stale');
			expect(document.querySelectorAll('.docs-layout')).toHaveLength(1);
		});
	});

	describe('mismatch recovery', () => {
		it('repairs mismatched text without duplicating the tree', async () => {
			document.body.innerHTML = `<div id="app"><div class="docs-layout"><h1>Stale</h1><button data-testid="count">7</button></div></div>${serializeHydrationData(
				{ head: {}, state: {}, url: '/' }
			)}`;
			const serverHeading = document.querySelector('h1');

			mounted = await createApp(Page as Component).mount('#app', {
				hydrate: true,
			});
			await flushRenderer();

			expect(document.querySelector('h1')).toBe(serverHeading);
			expect(document.querySelector('h1')?.textContent).toBe('Hooks');
			expect(document.querySelector('[data-testid="count"]')?.textContent).toBe(
				'0'
			);
			expect(document.querySelectorAll('h1')).toHaveLength(1);
		});

		it('repairs a mismatched element structure', async () => {
			document.body.innerHTML = `<div id="app"><section><span>Nope</span></section></div>${serializeHydrationData(
				{ head: {}, state: {}, url: '/' }
			)}`;

			mounted = await createApp(Page as Component).mount('#app', {
				hydrate: true,
			});
			await flushRenderer();

			expect(document.querySelectorAll('.docs-layout')).toHaveLength(1);
			expect(document.querySelector('h1')?.textContent).toBe('Hooks');
			expect(document.querySelectorAll('section')).toHaveLength(0);
			expect(document.body.textContent).not.toContain('Nope');
		});

		it('drops server nodes the client render does not produce', async () => {
			document.body.innerHTML = `<div id="app"><div class="docs-layout"><h1>Hooks</h1><button data-testid="count">0</button></div><aside>extra</aside></div>${serializeHydrationData(
				{ head: {}, state: {}, url: '/' }
			)}`;

			mounted = await createApp(Page as Component).mount('#app', {
				hydrate: true,
			});
			await flushRenderer();

			expect(document.querySelectorAll('aside')).toHaveLength(0);
			expect(document.querySelectorAll('.docs-layout')).toHaveLength(1);
		});
	});

	describe('end to end with the SSR handler', () => {
		it('serves a document that hydrates into a single interactive tree', async () => {
			const handler = createHandler({
				root: Page as never,
				layers: [],
				options: {
					template:
						'<!doctype html><html><head><title>t</title></head>' +
						'<body><div id="app"></div>' +
						'<script type="module" src="/assets/entry.js"></script>' +
						'</body></html>',
				},
			});

			const html = await (
				await handler(new Request('http://localhost/docs'))
			).text();

			// Running the client entry must adopt the served markup, not duplicate it.
			document.documentElement.innerHTML = html
				.replace(/^[\s\S]*?<html[^>]*>/i, '')
				.replace(/<\/html>[\s\S]*$/i, '');

			expect(document.querySelectorAll('.docs-layout')).toHaveLength(1);
			const serverLayout = document.querySelector('.docs-layout');
			const serverButton = document.querySelector('[data-testid="count"]');

			mounted = await createApp(Page as Component).mount('#app');
			await flushRenderer();

			expect(document.querySelectorAll('.docs-layout')).toHaveLength(1);
			expect(document.querySelector('.docs-layout')).toBe(serverLayout);
			expect(document.querySelectorAll('h1')).toHaveLength(1);

			(serverButton as HTMLButtonElement).click();
			await flushRenderer();
			expect(serverButton?.textContent).toBe('1');
		});
	});

	describe('unmount', () => {
		it('tears the hydrated tree down completely', async () => {
			await seedServerDocument(Page as Component);

			mounted = await createApp(Page as Component).mount('#app', {
				hydrate: true,
			});
			await flushRenderer();
			await mounted.unmount();
			mounted = null;

			expect(document.querySelector('#app')?.innerHTML).toBe('');
		});

		it('removes hydrated root list items as well as its client anchor', async () => {
			const RootList = define({
				script: () => ({}),
				template: () =>
					CreateListNode({
						[EFFUSE_NODE]: true,
						children: [el('p', {}, ['one']), el('p', {}, ['two'])],
					}),
			});

			await seedServerDocument(RootList as Component);
			mounted = await createApp(RootList as Component).hydrate('#app');
			await flushRenderer();
			expect(document.querySelectorAll('#app p')).toHaveLength(2);

			await mounted.unmount();
			mounted = null;
			expect(document.querySelector('#app')?.childNodes).toHaveLength(0);
		});
	});
});
