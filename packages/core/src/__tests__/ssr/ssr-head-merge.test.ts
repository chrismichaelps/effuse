/**
 * MIT License
 *
 * Copyright (c) 2025 Chris M. Perez
 */

import { describe, expect, it } from 'vitest';
import { createServerApp } from '../../ssr/server-app.js';
import { define } from '../../blueprint/define.js';
import { useHead } from '../../ssr/use-head.js';
import type { HeadProps, MetaTag } from '../../ssr/types.js';
import {
	CreateElementNode,
	EFFUSE_NODE,
	type Component,
} from '../../render/node.js';

const rootCalling = (heads: HeadProps[]): Component =>
	define({
		script: () => {
			for (const head of heads) useHead(head);
			return {};
		},
		template: () =>
			CreateElementNode({
				[EFFUSE_NODE]: true,
				tag: 'div',
				props: {},
				children: ['x'] as never,
			}),
	}) as unknown as Component;

/** Layer heads land on the stack first; component `useHead` calls follow. */
const HEADS: HeadProps[] = [
	{
		title: 'A',
		meta: [
			{ name: 'description', content: 'D' },
			{ property: 'og:title', content: 'OG' },
		],
	},
	{ meta: [{ name: 'keywords', content: 'K' }] },
	{ og: { image: '/a.png' } as never },
	{ og: { url: '/u' } as never },
];

const contents = (meta: readonly MetaTag[] | undefined, key: string) =>
	(meta ?? [])
		.filter((tag) => tag.name === key || tag.property === key)
		.map((tag) => tag.content);

describe('SSR head merging', () => {
	it('keeps meta from every contributor', async () => {
		// A spread replaced the whole array, so each call deleted what the
		// earlier ones added.
		const result = await createServerApp(rootCalling(HEADS)).renderToString('/');

		expect(contents(result.head.meta, 'description')).toEqual(['D']);
		expect(contents(result.head.meta, 'og:title')).toEqual(['OG']);
		expect(contents(result.head.meta, 'keywords')).toEqual(['K']);
	});

	it('renders every one of them into the document head', async () => {
		const result = await createServerApp(rootCalling(HEADS)).renderToString('/');
		const head = result.html.slice(0, result.html.indexOf('</head>'));

		expect(head).toContain('name="description"');
		expect(head).toContain('property="og:title"');
		expect(head).toContain('name="keywords"');
	});

	it('merges og key by key instead of replacing it', async () => {
		const result = await createServerApp(rootCalling(HEADS)).renderToString('/');

		expect(result.head.og).toEqual({ image: '/a.png', url: '/u' });
	});

	it('still lets a later scalar override an earlier one', async () => {
		const result = await createServerApp(
			rootCalling([{ title: 'first' }, { title: 'second' }])
		).renderToString('/');

		expect(result.head.title).toBe('second');
	});

	it('applies the dedupe rules from #643', async () => {
		const result = await createServerApp(
			rootCalling([
				{
					meta: [
						{ httpEquiv: 'cache-control', content: 'no-cache' },
						{ property: 'article:tag', content: 'a' },
					],
				},
				{
					meta: [
						{ httpEquiv: 'pragma', content: 'no-cache' },
						{ property: 'article:tag', content: 'b' },
					],
				},
			])
		).renderToString('/');

		const equivs = (result.head.meta ?? []).map((tag) => tag.httpEquiv);
		expect(equivs).toContain('cache-control');
		expect(equivs).toContain('pragma');
		expect(contents(result.head.meta, 'article:tag')).toEqual(['a', 'b']);
	});

	it('carries the full merged head in the streaming hydration payload', async () => {
		// The streaming shell flushes before the render, so head discovered via
		// `useHead` during it cannot be in `<head>` — by design. It ships in the
		// hydration payload instead, and that payload must still be merged, not
		// spread.
		const app = createServerApp(rootCalling(HEADS));
		const stream = await app.renderToStream('/');
		const reader = (
			stream as unknown as ReadableStream<Uint8Array>
		).getReader();
		const decoder = new TextDecoder();
		let html = '';
		for (;;) {
			const { done, value } = await reader.read();
			if (done) break;
			html += typeof value === 'string' ? value : decoder.decode(value);
		}

		const payload = /id="__EFFUSE_DATA__"[^>]*>([\s\S]*?)<\/script>/.exec(
			html
		)?.[1] as string;
		const head = (
			JSON.parse(payload.replace(/\\u003c/g, '<')) as { head: HeadProps }
		).head;

		expect(contents(head.meta, 'description')).toEqual(['D']);
		expect(contents(head.meta, 'og:title')).toEqual(['OG']);
		expect(contents(head.meta, 'keywords')).toEqual(['K']);
		expect(head.og).toEqual({ image: '/a.png', url: '/u' });
	});

	it('merges layer heads into the streamed shell', async () => {
		// Heads present before the render do reach `<head>`, so the shell's own
		// merge has to be the shared one too.
		const app = createServerApp(rootCalling([])).useLayers([
			{ name: 'l1', head: { meta: [{ name: 'description', content: 'D' }] } },
			{ name: 'l2', head: { meta: [{ name: 'keywords', content: 'K' }] } },
		] as never);
		const stream = await app.renderToStream('/');
		const reader = (
			stream as unknown as ReadableStream<Uint8Array>
		).getReader();
		const decoder = new TextDecoder();
		let html = '';
		for (;;) {
			const { done, value } = await reader.read();
			if (done) break;
			html += typeof value === 'string' ? value : decoder.decode(value);
		}
		const head = html.slice(0, html.indexOf('</head>'));

		expect(head).toContain('name="description"');
		expect(head).toContain('name="keywords"');
	});
});
