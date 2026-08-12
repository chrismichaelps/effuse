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

import type { HeadProps } from './types.js';

/**
 * Marks the tags this module owns. Reconciliation removes a managed tag the
 * next head no longer declares, and leaves anything the application authored
 * in its own markup untouched.
 */
const MANAGED = 'data-effuse-head';

type MetaKey = { readonly attr: 'name' | 'property'; readonly key: string };

/**
 * Finds a head tag by attribute value.
 *
 * Deliberately not `querySelector`: the value is interpolated into a selector
 * there, so a name carrying a quote or bracket threw and aborted the rest of
 * the update. Head values come from application and CMS content, where that is
 * ordinary rather than exotic.
 */
const findTag = (
	tagName: 'meta' | 'link',
	attr: string,
	value: string
): Element | undefined => {
	for (const element of Array.from(document.head.children)) {
		if (
			element.tagName.toLowerCase() === tagName &&
			element.getAttribute(attr) === value
		) {
			return element;
		}
	}
	return undefined;
};

const applyMeta = (attr: 'name' | 'property', key: string, content: string): void => {
	let meta = findTag('meta', attr, key);
	if (!meta) {
		meta = document.createElement('meta');
		meta.setAttribute(attr, key);
		document.head.appendChild(meta);
	}
	meta.setAttribute('content', content);
	meta.setAttribute(MANAGED, '');
};

const applyLink = (rel: string, href: string): void => {
	let link = findTag('link', 'rel', rel);
	if (!link) {
		link = document.createElement('link');
		link.setAttribute('rel', rel);
		document.head.appendChild(link);
	}
	link.setAttribute('href', href);
	link.setAttribute(MANAGED, '');
};

/** Every meta tag the given head declares, in the order it declares them. */
const declaredMeta = (head: HeadProps): Map<string, MetaKey & { content: string }> => {
	const declared = new Map<string, MetaKey & { content: string }>();
	const add = (attr: 'name' | 'property', key: string, content: string): void => {
		declared.set(`${attr}:${key}`, { attr, key, content });
	};

	if (head.description) add('name', 'description', head.description);
	if (head.themeColor) add('name', 'theme-color', head.themeColor);
	if (head.robots) add('name', 'robots', head.robots);

	if (head.og) {
		for (const [key, value] of Object.entries(head.og)) {
			if (value) add('property', `og:${key}`, value);
		}
	}
	if (head.twitter) {
		for (const [key, value] of Object.entries(head.twitter)) {
			if (value) add('name', `twitter:${key}`, value);
		}
	}
	if (head.meta) {
		for (const tag of head.meta) {
			if (tag.name) add('name', tag.name, tag.content);
			else if (tag.property) add('property', tag.property, tag.content);
		}
	}

	return declared;
};

/** Removes managed tags the new head no longer declares. */
const pruneManaged = (
	declaredMetaKeys: ReadonlySet<string>,
	declaredLinkRels: ReadonlySet<string>
): void => {
	for (const element of Array.from(document.head.children)) {
		if (!element.hasAttribute(MANAGED)) continue;

		const tagName = element.tagName.toLowerCase();
		if (tagName === 'meta') {
			const name = element.getAttribute('name');
			const property = element.getAttribute('property');
			const key =
				name !== null ? `name:${name}` : property !== null ? `property:${property}` : '';
			if (!declaredMetaKeys.has(key)) element.remove();
			continue;
		}
		if (tagName === 'link') {
			const rel = element.getAttribute('rel');
			if (rel === null || !declaredLinkRels.has(rel)) element.remove();
		}
	}
};

export const updateClientHead = (head: HeadProps): void => {
	if (typeof document === 'undefined') return;

	if (head.title) document.title = head.title;

	const meta = declaredMeta(head);
	for (const { attr, key, content } of meta.values()) {
		applyMeta(attr, key, content);
	}

	const linkRels = new Set<string>();
	if (head.canonical) {
		applyLink('canonical', head.canonical);
		linkRels.add('canonical');
	}
	if (head.link) {
		for (const tag of head.link) {
			if (tag.rel && tag.href) {
				applyLink(tag.rel, tag.href);
				linkRels.add(tag.rel);
			}
		}
	}

	pruneManaged(new Set(meta.keys()), linkRels);
};
