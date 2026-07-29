/**
 * MIT License
 *
 * Copyright (c) 2025 Chris M. Perez
 */

import { describe, it, expect, afterEach } from 'vitest';
import { createSSRRuntime } from '../../ssr/runtime.js';
import { renderToString } from '../../ssr/render.js';
import { createServerApp } from '../../ssr/server-app.js';
import { createHandler } from '../../ssr/handler.js';
import { clearGlobalLayerContext } from '../../layers/context.js';
import { clearGlobalTracing } from '../../layers/tracing/index.js';
import { CreateElementNode, CreateTextNode } from '../../render/node.js';
import { EFFUSE_NODE } from '../../constants.js';
import type { AssetManifest } from '../../ssr/types.js';

afterEach(() => {
	clearGlobalLayerContext();
	clearGlobalTracing();
});

const TEMPLATE = [
	'<!doctype html><html><head><title>t</title></head>',
	'<body><div id="app"></div>',
	'<script type="module" src="/assets/entry.js"></script>',
	'</body></html>',
].join('');

const MANIFEST: AssetManifest = {
	'src/main.ts': {
		file: 'assets/index-CJjGpYuu.js',
		src: 'src/main.ts',
		isEntry: true,
		css: ['assets/index-C0iI6PGx.css'],
	},
};

const root = () =>
	CreateElementNode({
		[EFFUSE_NODE]: true,
		tag: 'h1',
		props: {},
		children: [CreateTextNode({ [EFFUSE_NODE]: true, text: 'Docs' })],
	});

const readStream = async (
	stream: ReadableStream<Uint8Array>
): Promise<string> => {
	const reader = stream.getReader();
	const decoder = new TextDecoder();
	let html = '';
	for (;;) {
		const { done, value } = await reader.read();
		if (done) break;
		html += decoder.decode(value, { stream: true });
	}
	return html + decoder.decode();
};

describe('client entry emission (issue #431)', () => {
	describe('renderToString', () => {
		it('preserves the template client entry script', async () => {
			const runtime = await createSSRRuntime([]);
			const result = runtime.run(() =>
				renderToString(root() as never, '/docs', runtime, {
					template: TEMPLATE,
				})
			);
			await runtime.dispose();

			expect(result.html).toContain(
				'<script type="module" src="/assets/entry.js"></script>'
			);
			expect(result.html).toContain('<div id="app"><h1>Docs</h1></div>');
			expect(result.html).toContain('__EFFUSE_DATA__');
		});

		it('emits an executing module script for the manifest entry', async () => {
			const runtime = await createSSRRuntime([]);
			const result = runtime.run(() =>
				renderToString(root() as never, '/docs', runtime, {
					manifest: MANIFEST,
				})
			);
			await runtime.dispose();

			expect(result.html).toContain(
				'<script type="module" crossorigin src="/assets/index-CJjGpYuu.js"></script>'
			);
			expect(result.html).toContain(
				'<link rel="modulepreload" crossorigin href="/assets/index-CJjGpYuu.js">'
			);
			expect(result.html).toContain(
				'<link rel="stylesheet" href="/assets/index-C0iI6PGx.css">'
			);
		});

		it('emits an explicit client entry when no manifest exists', async () => {
			const runtime = await createSSRRuntime([]);
			const result = runtime.run(() =>
				renderToString(root() as never, '/docs', runtime, {
					clientEntry: '/src/main.ts',
				})
			);
			await runtime.dispose();

			expect(result.html).toContain(
				'<script type="module" crossorigin src="/src/main.ts"></script>'
			);
		});

		it('does not duplicate the entry script already present in the template', async () => {
			const runtime = await createSSRRuntime([]);
			const result = runtime.run(() =>
				renderToString(root() as never, '/docs', runtime, {
					template: TEMPLATE,
					clientEntry: '/assets/entry.js',
				})
			);
			await runtime.dispose();

			const matches = result.html.match(/\/assets\/entry\.js/g) ?? [];
			expect(matches).toHaveLength(1);
		});

		it('does not duplicate a manifest entry already present in the template', async () => {
			const template = TEMPLATE.replace(
				'/assets/entry.js',
				'/assets/index-CJjGpYuu.js'
			);
			const runtime = await createSSRRuntime([]);
			const result = runtime.run(() =>
				renderToString(root() as never, '/docs', runtime, {
					template,
					manifest: MANIFEST,
				})
			);
			await runtime.dispose();

			const matches =
				result.html.match(/\/assets\/index-CJjGpYuu\.js[^"']*/g) ?? [];
			// One preload plus one executing template script; no generated duplicate.
			expect(matches).toHaveLength(2);
			expect(result.html.match(/<script[^>]+index-CJjGpYuu\.js/g)).toHaveLength(
				1
			);
		});

		it('keeps the hydration payload after the entry script', async () => {
			const runtime = await createSSRRuntime([]);
			const result = runtime.run(() =>
				renderToString(root() as never, '/docs', runtime, {
					manifest: MANIFEST,
				})
			);
			await runtime.dispose();

			expect(result.html.indexOf('index-CJjGpYuu.js"></script>')).toBeLessThan(
				result.html.indexOf('__EFFUSE_DATA__')
			);
		});
	});

	describe('createHandler', () => {
		it('serves a document that executes the client bundle', async () => {
			const handler = createHandler({
				root: root() as never,
				layers: [],
				options: { template: TEMPLATE },
			});

			const response = await handler(
				new Request('http://localhost/docs/layers')
			);
			const html = await response.text();

			expect(html).toContain(
				'<script type="module" src="/assets/entry.js"></script>'
			);
			expect(html).toContain('<h1>Docs</h1>');
		});

		it('serves a manifest-driven document that executes the entry chunk', async () => {
			const handler = createHandler({
				root: root() as never,
				layers: [],
				options: { manifest: MANIFEST },
			});

			const response = await handler(new Request('http://localhost/docs'));
			const html = await response.text();

			expect(html).toContain(
				'<script type="module" crossorigin src="/assets/index-CJjGpYuu.js"></script>'
			);
		});
	});

	describe('renderToStream', () => {
		it('streams a document that executes the client bundle', async () => {
			const app = createServerApp(root() as never).configure({
				manifest: MANIFEST,
			});

			const html = await readStream(await app.renderToStream('/docs'));

			expect(html).toContain(
				'<script type="module" crossorigin src="/assets/index-CJjGpYuu.js"></script>'
			);
			expect(html).toContain('<h1>Docs</h1>');
			expect(html).toContain('__EFFUSE_DATA__');
		});

		it('streams into a template, preserving its entry script', async () => {
			const app = createServerApp(root() as never).configure({
				template: TEMPLATE,
			});

			const html = await readStream(await app.renderToStream('/docs'));

			expect(html).toContain(
				'<script type="module" src="/assets/entry.js"></script>'
			);
			expect(html).toContain('<div id="app"><h1>Docs</h1></div>');
			expect(html.indexOf('<h1>Docs</h1>')).toBeLessThan(
				html.indexOf('__EFFUSE_DATA__')
			);
		});
	});
});
