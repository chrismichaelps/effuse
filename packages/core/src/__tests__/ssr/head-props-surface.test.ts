/**
 * MIT License
 *
 * Copyright (c) 2025 Chris M. Perez
 */

import { describe, expect, it } from 'vitest';
import { headToHtml, mergeHeadProps } from '../../ssr/head-registry.js';
import type { HeadProps } from '../../ssr/types.js';

/** The keys removed from `HeadProps` because nothing ever rendered them. */
const REMOVED = {
	titleTemplate: '%s | Site',
	htmlAttrs: { dir: 'rtl' },
	bodyAttrs: { class: 'dark' },
	noscript: [{ innerHTML: 'no js' }],
	style: [{ innerHTML: 'body{}' }],
};

describe('HeadProps after removing the inert keys', () => {
	it('renders nothing for them, as before the removal', () => {
		// They were accepted by the type and rendered by nothing, so removing
		// them changes no output. This pins that, since the only way the removal
		// could bite is if one of them had turned out to be live.
		const html = headToHtml({ title: 'T', ...REMOVED } as HeadProps);

		expect(html).toContain('<title>T</title>');
		for (const key of Object.keys(REMOVED)) {
			expect(html).not.toContain(key);
		}
		expect(html).not.toContain('rtl');
		expect(html).not.toContain('no js');
	});

	it('does not throw when an old caller still passes them', () => {
		expect(() =>
			mergeHeadProps({ title: 'A' }, { title: 'B', ...REMOVED } as HeadProps)
		).not.toThrow();
	});

	it('still merges the keys that are live', () => {
		const merged = mergeHeadProps(
			{ title: 'A', lang: 'en' },
			{ title: 'B', ...REMOVED } as HeadProps
		);

		expect(merged.title).toBe('B');
		// `lang` sits beside the removed keys in the type and is genuinely read,
		// by `ssr/render.ts` and `ssr/server-app.ts`, so it stays.
		expect(merged.lang).toBe('en');
	});

	it('renders the live scalars it always did', () => {
		const html = headToHtml({
			title: 'T',
			description: 'D',
			canonical: 'https://example.com',
			themeColor: '#000',
			favicon: '/f.ico',
			robots: 'index',
			base: '/',
		});

		expect(html).toContain('<title>T</title>');
		expect(html).toContain('name="description"');
		expect(html).toContain('rel="canonical"');
		expect(html).toContain('name="theme-color"');
		expect(html).toContain('rel="icon"');
		expect(html).toContain('name="robots"');
		expect(html).toContain('<base href="/">');
	});
});
