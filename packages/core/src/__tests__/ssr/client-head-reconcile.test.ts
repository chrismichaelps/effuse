// @vitest-environment jsdom
/**
 * MIT License
 *
 * Copyright (c) 2025 Chris M. Perez
 */

import { beforeEach, describe, expect, it } from 'vitest';
import { updateClientHead } from '../../ssr/client-head.js';

const metaContent = (key: string): string | null => {
	for (const meta of Array.from(document.querySelectorAll('meta'))) {
		const name = meta.getAttribute('name') ?? meta.getAttribute('property');
		if (name === key) return meta.getAttribute('content');
	}
	return null;
};

const linkHref = (rel: string): string | null =>
	document.querySelector<HTMLLinkElement>(`link[rel="${rel}"]`)?.getAttribute(
		'href'
	) ?? null;

const countMeta = (key: string): number =>
	Array.from(document.querySelectorAll('meta')).filter(
		(meta) => (meta.getAttribute('name') ?? meta.getAttribute('property')) === key
	).length;

const PAGE_A = {
	title: 'Page A',
	description: 'Description of A',
	canonical: 'https://x.test/a',
	robots: 'index,follow',
	og: { title: 'A', image: 'https://x.test/a.png' },
	twitter: { card: 'summary_large_image' },
} as const;

describe('client head reconciliation', () => {
	beforeEach(() => {
		document.head.replaceChildren();
		document.title = '';
	});

	it('applies a full head', () => {
		updateClientHead(PAGE_A);

		expect(document.title).toBe('Page A');
		expect(metaContent('description')).toBe('Description of A');
		expect(metaContent('og:image')).toBe('https://x.test/a.png');
		expect(metaContent('twitter:card')).toBe('summary_large_image');
		expect(linkHref('canonical')).toBe('https://x.test/a');
	});

	it('clears tags the next head does not declare', () => {
		updateClientHead(PAGE_A);
		updateClientHead({ title: 'Page B' });

		expect(document.title).toBe('Page B');
		expect(metaContent('description')).toBeNull();
		expect(metaContent('robots')).toBeNull();
		expect(metaContent('og:title')).toBeNull();
		expect(metaContent('og:image')).toBeNull();
		expect(metaContent('twitter:card')).toBeNull();
		expect(linkHref('canonical')).toBeNull();
	});

	it('replaces values rather than accumulating duplicates', () => {
		updateClientHead(PAGE_A);
		updateClientHead({
			title: 'Page B',
			description: 'Description of B',
			og: { title: 'B' },
		});

		expect(metaContent('description')).toBe('Description of B');
		expect(metaContent('og:title')).toBe('B');
		expect(countMeta('description')).toBe(1);
		expect(countMeta('og:title')).toBe(1);
		// Declared by A, absent from B.
		expect(metaContent('og:image')).toBeNull();
	});

	it('adopts a server-rendered tag instead of duplicating it', () => {
		const server = document.createElement('meta');
		server.setAttribute('name', 'description');
		server.setAttribute('content', 'server description');
		document.head.appendChild(server);

		updateClientHead({ description: 'client description' });

		expect(countMeta('description')).toBe(1);
		expect(metaContent('description')).toBe('client description');
	});

	it('leaves tags the framework never set alone', () => {
		const authored = document.createElement('meta');
		authored.setAttribute('name', 'author');
		authored.setAttribute('content', 'hand written');
		document.head.appendChild(authored);

		updateClientHead(PAGE_A);
		updateClientHead({ title: 'Page B' });

		expect(metaContent('author')).toBe('hand written');
	});

	it('handles a tag name containing quotes and brackets', () => {
		expect(() =>
			updateClientHead({ meta: [{ name: 'weird"]attr', content: 'v' }] })
		).not.toThrow();

		expect(metaContent('weird"]attr')).toBe('v');
	});

	it('keeps applying later tags after an awkward name', () => {
		updateClientHead({
			meta: [
				{ name: 'weird"]attr', content: 'v' },
				{ name: 'follows', content: 'applied' },
			],
		});

		expect(metaContent('follows')).toBe('applied');
	});

	it('is stable across repeated identical updates', () => {
		updateClientHead(PAGE_A);
		const first = document.head.innerHTML;
		updateClientHead(PAGE_A);

		expect(document.head.innerHTML).toBe(first);
		expect(countMeta('description')).toBe(1);
	});

	it('distinguishes name from property with the same key', () => {
		updateClientHead({
			meta: [
				{ name: 'shared', content: 'by name' },
				{ property: 'shared', content: 'by property' },
			],
		});

		const byName = document.querySelector('meta[name="shared"]');
		const byProperty = document.querySelector('meta[property="shared"]');

		expect(byName?.getAttribute('content')).toBe('by name');
		expect(byProperty?.getAttribute('content')).toBe('by property');
	});
});
