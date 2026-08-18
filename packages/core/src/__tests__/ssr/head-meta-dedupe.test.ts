/**
 * MIT License
 *
 * Copyright (c) 2025 Chris M. Perez
 */

import { describe, expect, it } from 'vitest';
import { headToHtml, mergeHeadProps } from '../../ssr/head-registry.js';
import type { HeadProps, MetaTag } from '../../ssr/types.js';

/** Merge a single head so the dedupe path runs, and report what survived. */
const dedupe = (meta: MetaTag[]): MetaTag[] => [
	...(mergeHeadProps({}, { meta } as HeadProps).meta ?? []),
];

describe('meta tag dedupe', () => {
	it('keeps two http-equiv tags that share a content value', () => {
		// The standard no-cache pair. Keying an http-equiv tag by its content
		// collapsed these into one and dropped cache-control.
		const survivors = dedupe([
			{ httpEquiv: 'cache-control', content: 'no-cache' },
			{ httpEquiv: 'pragma', content: 'no-cache' },
		]);

		expect(survivors.map((tag) => tag.httpEquiv)).toEqual([
			'cache-control',
			'pragma',
		]);
	});

	it('does not let one tag content displace another tag name', () => {
		// A name and a content were compared in the same namespace, so an
		// unrelated tag ate the robots directive.
		const survivors = dedupe([
			{ name: 'robots', content: 'index' },
			{ httpEquiv: 'refresh', content: 'robots' },
		]);

		expect(survivors).toHaveLength(2);
		expect(survivors.some((tag) => tag.name === 'robots')).toBe(true);
	});

	it('does not let a property displace a name of the same value', () => {
		const survivors = dedupe([
			{ name: 'title', content: 'from name' },
			{ property: 'title', content: 'from property' },
		]);

		expect(survivors).toHaveLength(2);
	});

	it('still collapses a repeated name, last one winning', () => {
		const survivors = dedupe([
			{ name: 'description', content: 'first' },
			{ name: 'description', content: 'second' },
		]);

		expect(survivors).toEqual([{ name: 'description', content: 'second' }]);
	});

	it('still collapses a repeated property, last one winning', () => {
		const survivors = dedupe([
			{ property: 'og:title', content: 'first' },
			{ property: 'og:title', content: 'second' },
		]);

		expect(survivors).toEqual([{ property: 'og:title', content: 'second' }]);
	});

	it('collapses a repeated http-equiv, last one winning', () => {
		const survivors = dedupe([
			{ httpEquiv: 'refresh', content: '30' },
			{ httpEquiv: 'refresh', content: '60' },
		]);

		expect(survivors).toEqual([{ httpEquiv: 'refresh', content: '60' }]);
	});

	it('keeps every value of a repeating property', () => {
		// article:tag is defined as repeating, so keying it by property alone
		// left a page advertising only its last tag.
		const survivors = dedupe([
			{ property: 'article:tag', content: 'a' },
			{ property: 'article:tag', content: 'b' },
		]);

		expect(survivors.map((tag) => tag.content)).toEqual(['a', 'b']);
	});

	it('keeps every alternate locale', () => {
		const survivors = dedupe([
			{ property: 'og:locale:alternate', content: 'fr_FR' },
			{ property: 'og:locale:alternate', content: 'es_ES' },
		]);

		expect(survivors).toHaveLength(2);
	});

	it('keeps every image, including its subkeys', () => {
		const survivors = dedupe([
			{ property: 'og:image', content: '/a.png' },
			{ property: 'og:image:alt', content: 'a' },
			{ property: 'og:image', content: '/b.png' },
			{ property: 'og:image:alt', content: 'b' },
		]);

		expect(survivors).toHaveLength(4);
	});

	it('still collapses an exact duplicate of a repeating property', () => {
		const survivors = dedupe([
			{ property: 'article:tag', content: 'a' },
			{ property: 'article:tag', content: 'a' },
		]);

		expect(survivors).toHaveLength(1);
	});

	it('does not treat a singular og property as repeating', () => {
		// og:title is not on the repeating list, so a later push replaces it.
		const survivors = dedupe([
			{ property: 'og:title', content: 'a' },
			{ property: 'og:title', content: 'b' },
		]);

		expect(survivors).toEqual([{ property: 'og:title', content: 'b' }]);
	});

	it('does not treat a name that merely looks repeating as repeating', () => {
		// The repeating rule is scoped to properties; names stay singular.
		const survivors = dedupe([
			{ name: 'article:tag', content: 'a' },
			{ name: 'article:tag', content: 'b' },
		]);

		expect(survivors).toHaveLength(1);
	});

	it('keeps distinct names apart', () => {
		const survivors = dedupe([
			{ name: 'author', content: 'a' },
			{ name: 'keywords', content: 'b' },
		]);

		expect(survivors).toHaveLength(2);
	});

	it('dedupes a bare content tag against its own kind only', () => {
		const survivors = dedupe([
			{ content: 'x' } as MetaTag,
			{ content: 'x' } as MetaTag,
			{ name: 'x', content: 'y' },
		]);

		expect(survivors).toHaveLength(2);
	});

	it('renders every survivor', () => {
		const html = headToHtml({
			meta: dedupe([
				{ httpEquiv: 'cache-control', content: 'no-cache' },
				{ httpEquiv: 'pragma', content: 'no-cache' },
			]),
		});

		expect(html).toContain('http-equiv="cache-control"');
		expect(html).toContain('http-equiv="pragma"');
	});
});
