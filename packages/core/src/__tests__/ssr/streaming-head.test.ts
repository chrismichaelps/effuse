import { describe, it, expect, afterEach } from 'vitest';
import { createServerApp } from '../../ssr/server-app.js';
import { renderToString } from '../../ssr/render.js';
import { createSSRRuntime } from '../../ssr/runtime.js';
import { defineLayer } from '../../layers/api/defineLayer.js';
import { clearGlobalLayerContext } from '../../layers/context.js';
import { clearGlobalTracing } from '../../layers/tracing/index.js';
import { useHead } from '../../ssr/use-head.js';
import { CreateElementNode, CreateTextNode, EFFUSE_NODE } from '../../render/node.js';
import { define } from '../../blueprint/define.js';

afterEach(() => {
	clearGlobalLayerContext();
	clearGlobalTracing();
});

const text = (value: string) =>
	CreateTextNode({ [EFFUSE_NODE]: true, text: value });

const element = (tag: string, props: Record<string, unknown>, children: unknown[]) =>
	CreateElementNode({
		[EFFUSE_NODE]: true,
		tag,
		props,
		children: children as never,
	});

const blueprint = (view: () => unknown) =>
	define({
		props: {},
		script: () => ({}),
		template: view as never,
	});

const drain = async (
	stream: ReadableStream<Uint8Array>
): Promise<{ chunks: string[]; html: string }> => {
	const reader = stream.getReader();
	const decoder = new TextDecoder();
	const chunks: string[] = [];
	for (;;) {
		const { done, value } = await reader.read();
		if (done) break;
		chunks.push(decoder.decode(value, { stream: true }));
	}
	chunks.push(decoder.decode());
	return { chunks: chunks.filter((chunk) => chunk !== ''), html: chunks.join('') };
};

describe('deferred-head streaming', () => {
	it('flushes the shell before the body is present in the first chunk', async () => {
		const bigBody = blueprint(() =>
			element(
				'ul',
				{},
				Array.from({ length: 50 }, (_, index) =>
					element('li', {}, [text(`item-${String(index)}`)])
				)
			)
		);

		const app = createServerApp(bigBody as never);
		const stream = await app.renderToStream('/');
		const { chunks, html } = await drain(stream);

		// The first chunk is the document shell up to the app container, and it
		// must not already contain the rendered body.
		expect(chunks[0]).toContain('<div id="app">');
		expect(chunks[0]).not.toContain('item-0');
		expect(chunks.length).toBeGreaterThan(1);
		// The full document still contains the body and closes correctly.
		expect(html).toContain('item-49');
		expect(html).toContain('</html>');
	});

	it('puts static layer head in the shell before render', async () => {
		const app = createServerApp(blueprint(() => text('hi')) as never).useLayers([
			defineLayer({ name: 'seo', head: { title: 'Catalog', lang: 'en' } }),
		]);

		const stream = await app.renderToStream('/');
		const { chunks } = await drain(stream);

		expect(chunks[0]).toContain('<title>Catalog</title>');
		expect(chunks[0]).toContain('lang="en"');
	});

	it('carries late useHead content in the hydration payload for the client to apply', async () => {
		const dynamic = blueprint(() => {
			useHead({ title: 'Product 42', description: 'A great product' });
			return text('body');
		});

		const app = createServerApp(dynamic as never);
		const stream = await app.renderToStream('/');
		const { chunks, html } = await drain(stream);

		// Late head is not in the pre-render shell...
		expect(chunks[0]).not.toContain('Product 42');
		// ...but the hydration payload carries the fully merged head so the
		// client head applier reflects it after hydration.
		expect(html).toContain('__EFFUSE_DATA__');
		expect(html).toContain('Product 42');
		expect(html).toContain('A great product');
	});

	it('produces a body identical to the buffered renderer', async () => {
		const view = () =>
			element('section', { class: 'card' }, [
				element('h2', {}, [text('Title & "quoted"')]),
				element('p', {}, [text('Body <content> with & entities')]),
			]);

		const buffered = await createServerApp(blueprint(view) as never).renderToString(
			'/'
		);
		const stream = await createServerApp(blueprint(view) as never).renderToStream(
			'/'
		);
		const { html: streamed } = await drain(stream);

		// The rendered body markup is byte-identical between both renderers.
		const body = '<section class="card"><h2>Title &amp; "quoted"</h2><p>Body &lt;content&gt; with &amp; entities</p></section>';
		expect(buffered.html).toContain(body);
		expect(streamed).toContain(body);
	});

	it('keeps renderToString head behaviour unchanged for full-head SEO', async () => {
		const runtime = await createSSRRuntime([]);
		const node = blueprint(() => {
			useHead({ title: 'SEO Title' });
			return text('x');
		});

		const result = runtime.run(() => renderToString(node as never, '/', runtime));

		// Buffered rendering still embeds late head directly in <head>.
		expect(result.html).toContain('<title>SEO Title</title>');

		await runtime.dispose();
	});
});
