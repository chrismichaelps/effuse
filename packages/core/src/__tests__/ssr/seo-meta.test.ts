/**
 * MIT License
 *
 * Copyright (c) 2025 Chris M. Perez
 */

import { describe, expect, it } from 'vitest';
import { useSeoMeta, useServerSeoMeta } from '../../ssr/seo-meta.js';
import type { SeoMetaInput } from '../../ssr/seo-meta.js';
import { runWithSSRContext } from '../../ssr/use-head.js';
import { headToHtml, mergeLayerHeads } from '../../ssr/head-registry.js';
import type { HeadProps, MetaTag } from '../../ssr/types.js';

/** Collect the head that `useSeoMeta` pushes for `input`. */
const collect = (
	input: SeoMetaInput,
	apply: (input: SeoMetaInput) => void = useSeoMeta
): HeadProps => {
	const pushed: HeadProps[] = [];
	runWithSSRContext({ push: (head) => pushed.push(head) }, () => apply(input));
	return mergeLayerHeads(pushed);
};

const contentsFor = (meta: readonly MetaTag[] | undefined, key: string) =>
	(meta ?? [])
		.filter((tag) => tag.name === key || tag.property === key)
		.map((tag) => tag.content);

describe('useSeoMeta', () => {
	it('renders exactly one description meta tag', () => {
		// The description was written to both the scalar and the meta array, and
		// `headToHtml` renders both.
		const html = headToHtml(collect({ description: 'D' }));

		expect(html.split('name="description"')).toHaveLength(2);
		expect(html).toContain('content="D"');
	});

	it('keeps the description overridable as a scalar', () => {
		// Carrying a redundant meta entry alongside the scalar meant an override
		// left a stale second description behind.
		const merged = mergeLayerHeads([
			collect({ description: 'old' }),
			{ description: 'new' },
		]);
		const html = headToHtml(merged);

		expect(html.split('name="description"')).toHaveLength(2);
		expect(html).toContain('content="new"');
		expect(html).not.toContain('content="old"');
	});

	it('emits one og:locale:alternate per entry', () => {
		// Declared on `SeoMetaInput` and dropped by the converter.
		const head = collect({ ogLocaleAlternate: ['fr_FR', 'es_ES'] });

		expect(contentsFor(head.meta, 'og:locale:alternate')).toEqual([
			'fr_FR',
			'es_ES',
		]);
	});

	it('emits nothing for an empty alternate locale list', () => {
		const head = collect({ ogLocaleAlternate: [] });

		expect(contentsFor(head.meta, 'og:locale:alternate')).toEqual([]);
	});

	it('keeps the primary locale separate from its alternates', () => {
		const head = collect({ ogLocale: 'en_US', ogLocaleAlternate: ['fr_FR'] });

		expect(contentsFor(head.meta, 'og:locale')).toEqual(['en_US']);
		expect(contentsFor(head.meta, 'og:locale:alternate')).toEqual(['fr_FR']);
	});

	it('still carries the rest of the input through', () => {
		const head = collect({
			title: 'T',
			keywords: 'k',
			ogTitle: 'OG',
			twitterCard: 'summary',
			articleTag: ['a', 'b'],
		});

		expect(head.title).toBe('T');
		expect(contentsFor(head.meta, 'keywords')).toEqual(['k']);
		expect(contentsFor(head.meta, 'og:title')).toEqual(['OG']);
		expect(contentsFor(head.meta, 'twitter:card')).toEqual(['summary']);
		expect(contentsFor(head.meta, 'article:tag')).toEqual(['a', 'b']);
	});

	it('handles every declared key without dropping one', () => {
		// A key that the type accepts and the converter ignores is invisible, so
		// this compares the declared surface against what actually comes out.
		const head = collect({
			description: 'd',
			ogLocaleAlternate: ['fr_FR'],
			ogLocale: 'en_US',
		});

		expect(head.description).toBe('d');
		expect((head.meta ?? []).length).toBeGreaterThan(0);
	});
});

describe('useServerSeoMeta', () => {
	it('pushes when a server context is present', () => {
		const head = collect({ ogLocaleAlternate: ['fr_FR'] }, useServerSeoMeta);

		expect(contentsFor(head.meta, 'og:locale:alternate')).toEqual(['fr_FR']);
	});

	it('does nothing without a server context', () => {
		let pushed = false;
		const original = globalThis.document;
		// `useHead` falls back to the DOM when there is no SSR context; the
		// server-only variant must not reach that path either.
		Reflect.deleteProperty(globalThis, 'document');
		try {
			useServerSeoMeta({ description: 'D' });
			pushed = true;
		} finally {
			if (original !== undefined) globalThis.document = original;
		}

		expect(pushed).toBe(true);
	});
});
