import { describe, it, expect, afterEach } from 'vitest';
import { renderToString, renderToFragment } from '../../ssr/render.js';
import { createSSRRuntime } from '../../ssr/runtime.js';
import { defineLayer } from '../../layers/api/defineLayer.js';
import { clearGlobalLayerContext } from '../../layers/context.js';
import { clearGlobalTracing } from '../../layers/tracing/index.js';
import { CreateElementNode, CreateTextNode, CreateFragmentNode } from '../../render/node.js';
import { EFFUSE_NODE } from '../../constants.js';

afterEach(() => {
	clearGlobalLayerContext();
	clearGlobalTracing();
});

describe('SSR render', () => {
	describe('renderToString', () => {
		it('should render a text node to full HTML', async () => {
			const runtime = await createSSRRuntime([]);

			const node = CreateTextNode({
				[EFFUSE_NODE]: true,
				text: 'Hello World',
			});

			const result = renderToString(node, '/', runtime);

			expect(result.html).toContain('Hello World');
			expect(result.html).toContain('<!DOCTYPE html>');
			expect(result.html).toContain('<html lang="en">');
			expect(result.html).toContain('<div id="app">');
			expect(result.html).toContain('__EFFUSE_DATA__');
			expect(result.timing).toBeGreaterThanOrEqual(0);

			await runtime.dispose();
		});

		it('should render an element node with attributes', async () => {
			const runtime = await createSSRRuntime([]);

			const node = CreateElementNode({
				[EFFUSE_NODE]: true,
				tag: 'div',
				props: { className: 'container', id: 'root' },
				children: [
					CreateTextNode({ [EFFUSE_NODE]: true, text: 'Content' }),
				],
			});

			const result = renderToString(node, '/', runtime);

			expect(result.html).toContain('<div class="container" id="root">Content</div>');

			await runtime.dispose();
		});

		it('should render self-closing elements correctly', async () => {
			const runtime = await createSSRRuntime([]);

			const node = CreateElementNode({
				[EFFUSE_NODE]: true,
				tag: 'img',
				props: { src: '/logo.png', alt: 'Logo' },
				children: [],
			});

			const result = renderToString(node, '/', runtime);

			expect(result.html).toContain('<img src="/logo.png" alt="Logo">');
			expect(result.html).not.toContain('</img>');

			await runtime.dispose();
		});

		it('should render fragments', async () => {
			const runtime = await createSSRRuntime([]);

			const node = CreateFragmentNode({
				[EFFUSE_NODE]: true,
				children: [
					CreateTextNode({ [EFFUSE_NODE]: true, text: 'A' }),
					CreateTextNode({ [EFFUSE_NODE]: true, text: 'B' }),
				],
			});

			const result = renderToString(node, '/', runtime);

			expect(result.html).toContain('AB');

			await runtime.dispose();
		});

		it('should escape HTML in text nodes', async () => {
			const runtime = await createSSRRuntime([]);

			const node = CreateTextNode({
				[EFFUSE_NODE]: true,
				text: '<script>alert("xss")</script>',
			});

			const result = renderToString(node, '/', runtime);

			expect(result.html).toContain('&lt;script&gt;alert("xss")&lt;/script&gt;');
			expect(result.html).not.toContain('<script>alert');

			await runtime.dispose();
		});

		it('should collect head props from layers into the HTML', async () => {
			const TestLayer = defineLayer({
				name: 'headed',
				head: {
					title: 'My App',
					description: 'App description',
				},
			});

			const runtime = await createSSRRuntime([TestLayer]);

			const node = CreateTextNode({ [EFFUSE_NODE]: true, text: 'body' });
			const result = renderToString(node, '/', runtime);

			expect(result.html).toContain('<title>My App</title>');
			expect(result.html).toContain('content="App description"');
			expect(result.head.title).toBe('My App');

			await runtime.dispose();
		});

		it('should embed hydration data in the output', async () => {
			const runtime = await createSSRRuntime([]);

			const node = CreateTextNode({ [EFFUSE_NODE]: true, text: 'test' });
			const result = renderToString(node, '/page', runtime);

			expect(result.html).toContain('__EFFUSE_DATA__');
			expect(result.html).toContain('"url":"/page"');
			expect(result.html).toContain('"timestamp"');
			expect(result.state).toEqual({});

			await runtime.dispose();
		});

		it('should render nested element trees', async () => {
			const runtime = await createSSRRuntime([]);

			const node = CreateElementNode({
				[EFFUSE_NODE]: true,
				tag: 'div',
				props: { className: 'outer' },
				children: [
					CreateElementNode({
						[EFFUSE_NODE]: true,
						tag: 'span',
						props: { className: 'inner' },
						children: [
							CreateTextNode({ [EFFUSE_NODE]: true, text: 'Nested' }),
						],
					}),
				],
			});

			const result = renderToString(node, '/', runtime);

			expect(result.html).toContain(
				'<div class="outer"><span class="inner">Nested</span></div>'
			);

			await runtime.dispose();
		});

		it('should skip event handler props', async () => {
			const runtime = await createSSRRuntime([]);

			const node = CreateElementNode({
				[EFFUSE_NODE]: true,
				tag: 'button',
				props: { onClick: () => { }, className: 'btn' },
				children: [
					CreateTextNode({ [EFFUSE_NODE]: true, text: 'Click' }),
				],
			});

			const result = renderToString(node, '/', runtime);

			expect(result.html).toContain('class="btn"');
			expect(result.html).not.toContain('onClick');
			expect(result.html).not.toContain('on-click');

			await runtime.dispose();
		});
	});

	describe('renderToFragment', () => {
		it('should render body fragment without full HTML shell', async () => {
			const runtime = await createSSRRuntime([]);

			const node = CreateElementNode({
				[EFFUSE_NODE]: true,
				tag: 'p',
				props: {},
				children: [
					CreateTextNode({ [EFFUSE_NODE]: true, text: 'Fragment content' }),
				],
			});

			const html = renderToFragment(node, runtime);

			expect(html).toBe('<p>Fragment content</p>');
			expect(html).not.toContain('<!DOCTYPE');
			expect(html).not.toContain('<html');

			await runtime.dispose();
		});
	});
});
