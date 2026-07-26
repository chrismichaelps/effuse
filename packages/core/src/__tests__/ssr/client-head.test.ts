// @vitest-environment jsdom

import { afterEach, describe, expect, it } from 'vitest';
import { updateClientHead } from '../../ssr/client-head.js';

describe('client head updates', () => {
	afterEach(() => {
		document.title = '';
		document.head
			.querySelectorAll('meta, link')
			.forEach((node) => node.remove());
	});

	it('applies the browser-safe head contract', () => {
		updateClientHead({
			title: 'Effuse Docs',
			description: 'Production documentation',
			canonical: 'https://effuse.dev/docs',
			themeColor: '#00d4a7',
			robots: 'index,follow',
			og: { title: 'Effuse' },
			twitter: { card: 'summary_large_image' },
			meta: [{ name: 'author', content: 'Effuse' }],
		});

		expect(document.title).toBe('Effuse Docs');
		expect(
			document
				.querySelector('meta[name="description"]')
				?.getAttribute('content')
		).toBe('Production documentation');
		expect(
			document.querySelector('link[rel="canonical"]')?.getAttribute('href')
		).toBe('https://effuse.dev/docs');
		expect(
			document
				.querySelector('meta[property="og:title"]')
				?.getAttribute('content')
		).toBe('Effuse');
		expect(
			document
				.querySelector('meta[name="twitter:card"]')
				?.getAttribute('content')
		).toBe('summary_large_image');
	});

	it('updates owned tags instead of duplicating them', () => {
		updateClientHead({ description: 'First' });
		updateClientHead({ description: 'Second' });

		const descriptions = document.querySelectorAll('meta[name="description"]');
		expect(descriptions).toHaveLength(1);
		expect(descriptions[0]?.getAttribute('content')).toBe('Second');
	});
});
