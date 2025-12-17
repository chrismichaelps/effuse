/**
 * MIT License
 *
 * Copyright (c) 2025 Chris M. Perez
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 */

import { Effect } from 'effect';
import type { HeadProps } from './types.js';
import { HeadRegistry } from './head-registry.js';

let ssrContext: { push: (head: HeadProps) => void } | null = null;

export const setSSRContext = (
	ctx: { push: (head: HeadProps) => void } | null
): void => {
	ssrContext = ctx;
};

export const getSSRContext = (): { push: (head: HeadProps) => void } | null => {
	return ssrContext;
};

export const isServer = (): boolean => {
	return ssrContext !== null;
};

export const useHead = (head: HeadProps): void => {
	if (ssrContext) {
		ssrContext.push(head);
	} else if (typeof document !== 'undefined') {
		updateClientHead(head);
	}
};

const updateClientHead = (head: HeadProps): void => {
	if (head.title) {
		document.title = head.title;
	}

	if (head.description) {
		updateMetaTag('name', 'description', head.description);
	}

	if (head.canonical) {
		updateLinkTag('canonical', head.canonical);
	}

	if (head.themeColor) {
		updateMetaTag('name', 'theme-color', head.themeColor);
	}

	if (head.robots) {
		updateMetaTag('name', 'robots', head.robots);
	}

	if (head.og) {
		for (const [key, value] of Object.entries(head.og)) {
			if (value) {
				updateMetaTag('property', `og:${key}`, value);
			}
		}
	}

	if (head.twitter) {
		for (const [key, value] of Object.entries(head.twitter)) {
			if (value) {
				updateMetaTag('name', `twitter:${key}`, value);
			}
		}
	}

	if (head.meta) {
		for (const tag of head.meta) {
			if (tag.name) {
				updateMetaTag('name', tag.name, tag.content);
			} else if (tag.property) {
				updateMetaTag('property', tag.property, tag.content);
			}
		}
	}
};

const updateMetaTag = (
	attr: 'name' | 'property',
	name: string,
	content: string
): void => {
	let meta = document.querySelector<HTMLMetaElement>(`meta[${attr}="${name}"]`);

	if (!meta) {
		meta = document.createElement('meta');
		meta.setAttribute(attr, name);
		document.head.appendChild(meta);
	}

	meta.content = content;
};

const updateLinkTag = (rel: string, href: string): void => {
	let link = document.querySelector<HTMLLinkElement>(`link[rel="${rel}"]`);

	if (!link) {
		link = document.createElement('link');
		link.rel = rel;
		document.head.appendChild(link);
	}

	link.href = href;
};

export const useHeadEffect = (
	head: HeadProps
): Effect.Effect<void, never, HeadRegistry> =>
	Effect.gen(function* () {
		const registry = yield* HeadRegistry;
		yield* registry.push(head);
	});
