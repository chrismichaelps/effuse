/**
 * MIT License
 *
 * Copyright (c) 2025 Chris M. Perez
 */

import { describe, it, expect } from 'vitest';
import {
	collectEntryAssets,
	renderEntryAssetTags,
	injectIntoTemplate,
	SSR_OUTLET_COMMENT,
} from '../../ssr/document.js';
import { RenderError } from '../../ssr/errors.js';
import type { AssetManifest } from '../../ssr/types.js';

const manifest: AssetManifest = {
	'src/main.ts': {
		file: 'assets/index-CJjGpYuu.js',
		src: 'src/main.ts',
		isEntry: true,
		imports: ['_shared.js'],
		css: ['assets/index-C0iI6PGx.css'],
	},
	'_shared.js': {
		file: 'assets/shared-B2.js',
		css: ['assets/shared-B2.css'],
	},
	'src/lazy.ts': {
		file: 'assets/lazy-D1.js',
		src: 'src/lazy.ts',
		isDynamicEntry: true,
	},
};

describe('SSR document assembly', () => {
	describe('collectEntryAssets', () => {
		it('collects entry scripts, styles and preloads from a Vite manifest', () => {
			const assets = collectEntryAssets(manifest);

			expect(assets.scripts).toEqual(['/assets/index-CJjGpYuu.js']);
			expect(assets.styles).toEqual([
				'/assets/index-C0iI6PGx.css',
				'/assets/shared-B2.css',
			]);
			expect(assets.preloads).toEqual([
				'/assets/index-CJjGpYuu.js',
				'/assets/shared-B2.js',
			]);
		});

		it('ignores non-entry chunks', () => {
			const assets = collectEntryAssets(manifest);
			expect(assets.scripts).not.toContain('/assets/lazy-D1.js');
		});

		it('preloads transitive entry imports without executing them as entries', () => {
			const nestedManifest: AssetManifest = {
				...manifest,
				'_shared.js': {
					file: 'assets/shared-B2.js',
					imports: ['_vendor.js'],
				},
				'_vendor.js': { file: 'assets/vendor-C3.js' },
			};
			const assets = collectEntryAssets(nestedManifest);

			expect(assets.preloads).toContain('/assets/vendor-C3.js');
			expect(assets.scripts).not.toContain('/assets/vendor-C3.js');
		});

		it('honors an explicit client entry', () => {
			const assets = collectEntryAssets(undefined, '/src/main.ts');
			expect(assets.scripts).toEqual(['/src/main.ts']);
			expect(assets.preloads).toEqual([]);
		});

		it('does not duplicate an explicit entry already present in the manifest', () => {
			const assets = collectEntryAssets(manifest, '/assets/index-CJjGpYuu.js');
			expect(assets.scripts).toEqual(['/assets/index-CJjGpYuu.js']);
		});

		it('returns empty asset lists when nothing is configured', () => {
			const assets = collectEntryAssets(undefined, undefined);
			expect(assets).toEqual({ scripts: [], styles: [], preloads: [] });
		});
	});

	describe('renderEntryAssetTags', () => {
		it('emits an executing module script for the entry chunk', () => {
			const tags = renderEntryAssetTags(collectEntryAssets(manifest));

			expect(tags).toContain(
				'<script type="module" crossorigin src="/assets/index-CJjGpYuu.js"></script>'
			);
		});

		it('emits stylesheet and modulepreload links', () => {
			const tags = renderEntryAssetTags(collectEntryAssets(manifest));

			expect(tags).toContain(
				'<link rel="stylesheet" href="/assets/index-C0iI6PGx.css">'
			);
			expect(tags).toContain(
				'<link rel="modulepreload" crossorigin href="/assets/index-CJjGpYuu.js">'
			);
		});

		it('escapes asset urls', () => {
			const tags = renderEntryAssetTags({
				scripts: ['/assets/"onload="alert(1)'],
				styles: [],
				preloads: [],
			});

			expect(tags).not.toContain('"onload="');
		});
	});

	describe('injectIntoTemplate', () => {
		const template = [
			'<!doctype html><html><head><title>t</title></head>',
			'<body><div id="app"></div>',
			'<script type="module" src="/assets/entry.js"></script>',
			'</body></html>',
		].join('');

		it('preserves the client entry script from the template', () => {
			const html = injectIntoTemplate(template, {
				appHtml: '<h1>Hydrated</h1>',
				headHtml: '',
				bodyTailHtml: '',
			});

			expect(html).toContain(
				'<script type="module" src="/assets/entry.js"></script>'
			);
		});

		it('renders the app markup into the container', () => {
			const html = injectIntoTemplate(template, {
				appHtml: '<h1>Hydrated</h1>',
				headHtml: '',
				bodyTailHtml: '',
			});

			expect(html).toContain('<div id="app"><h1>Hydrated</h1></div>');
		});

		it('injects head html before </head>', () => {
			const html = injectIntoTemplate(template, {
				appHtml: '',
				headHtml: '<meta name="description" content="x">',
				bodyTailHtml: '',
			});

			expect(html).toContain('<meta name="description" content="x"></head>');
		});

		it('replaces the template title when the render produced one', () => {
			const html = injectIntoTemplate(template, {
				appHtml: '',
				headHtml: '<title>Rendered</title>',
				bodyTailHtml: '',
			});

			expect(html).toContain('<title>Rendered</title>');
			expect(html).not.toContain('<title>t</title>');
			expect(html.match(/<title>/g)).toHaveLength(1);
		});

		it('injects the body tail (hydration payload) before </body>', () => {
			const html = injectIntoTemplate(template, {
				appHtml: '',
				headHtml: '',
				bodyTailHtml: '<script id="__EFFUSE_DATA__"></script>',
			});

			const tailIndex = html.indexOf('__EFFUSE_DATA__');
			expect(tailIndex).toBeGreaterThan(-1);
			expect(tailIndex).toBeLessThan(html.indexOf('</body>'));
			expect(html.indexOf('/assets/entry.js')).toBeLessThan(tailIndex);
		});

		it('supports an explicit outlet comment', () => {
			const html = injectIntoTemplate(
				`<html><body><main>${SSR_OUTLET_COMMENT}</main></body></html>`,
				{ appHtml: '<p>hi</p>', headHtml: '', bodyTailHtml: '' }
			);

			expect(html).toContain('<main><p>hi</p></main>');
		});

		it('supports a container with a custom id', () => {
			const html = injectIntoTemplate(
				'<html><body><div id="root"></div></body></html>',
				{
					appHtml: '<p>hi</p>',
					headHtml: '',
					bodyTailHtml: '',
					containerId: 'root',
				}
			);

			expect(html).toContain('<div id="root"><p>hi</p></div>');
		});

		it('replaces placeholder content already inside the container', () => {
			const html = injectIntoTemplate(
				'<html><body><div id="app">Loading…</div></body></html>',
				{ appHtml: '<p>hi</p>', headHtml: '', bodyTailHtml: '' }
			);

			expect(html).toContain('<div id="app"><p>hi</p></div>');
			expect(html).not.toContain('Loading…');
		});

		it('throws a RenderError when the template has no outlet', () => {
			expect(() =>
				injectIntoTemplate('<html><body></body></html>', {
					appHtml: '<p>hi</p>',
					headHtml: '',
					bodyTailHtml: '',
				})
			).toThrow(RenderError);
		});

		it('appends the body tail when the template has no </body>', () => {
			const html = injectIntoTemplate(`<div id="app"></div>`, {
				appHtml: '<p>hi</p>',
				headHtml: '',
				bodyTailHtml: '<script id="tail"></script>',
			});

			expect(html).toContain('<script id="tail"></script>');
		});
	});
});
