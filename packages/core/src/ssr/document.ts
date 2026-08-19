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

import type { AssetManifest } from './types.js';
import { RenderError } from './errors.js';
import { escapeAttr } from './escape.js';

/** Default id of the element the app is rendered into and hydrated from. */
export const DEFAULT_CONTAINER_ID = 'app';

/**
 * Marker a custom template can use to say exactly where the rendered app
 * markup goes. Takes precedence over the container lookup.
 */
export const SSR_OUTLET_COMMENT = '<!--effuse-ssr-outlet-->';

export interface EntryAssets {
	/** Module scripts that must execute on the client for hydration to happen. */
	readonly scripts: readonly string[];
	readonly styles: readonly string[];
	readonly preloads: readonly string[];
}

const toAbsolute = (file: string): string =>
	file.startsWith('/') || /^[a-z]+:\/\//i.test(file) ? file : `/${file}`;

/**
 * Collect the client assets that belong in the rendered document.
 *
 * A Vite manifest contributes the entry chunk (script + preload) and its CSS.
 * `clientEntry` covers dev servers and hand-rolled builds where no manifest
 * exists; it is de-duplicated against the manifest entries.
 */
export const collectEntryAssets = (
	manifest?: AssetManifest,
	clientEntry?: string
): EntryAssets => {
	const scripts = new Set<string>();
	const styles = new Set<string>();
	const preloads = new Set<string>();

	if (manifest) {
		const visitChunk = (key: string, isEntry: boolean): void => {
			const chunk = manifest[key];
			if (!chunk) return;

			const file = toAbsolute(chunk.file);
			if (isEntry) scripts.add(file);
			preloads.add(file);
			for (const cssFile of chunk.css ?? []) {
				styles.add(toAbsolute(cssFile));
			}
			for (const importedKey of chunk.imports ?? []) {
				if (
					!preloads.has(toAbsolute(manifest[importedKey]?.file ?? importedKey))
				) {
					visitChunk(importedKey, false);
				}
			}
		};

		for (const [key, chunk] of Object.entries(manifest)) {
			if (!chunk.isEntry) continue;
			visitChunk(key, true);
		}
	}

	if (clientEntry) {
		const entry = toAbsolute(clientEntry);
		scripts.add(entry);
	}

	return {
		scripts: [...scripts],
		styles: [...styles],
		preloads: [...preloads],
	};
};

/**
 * Whether the template already ships the given client entry as an executing
 * script, so the renderer does not emit a second copy of the same module.
 */
export const templateDeclaresEntry = (
	template: string | undefined,
	clientEntry: string | undefined
): boolean => {
	if (!template || !clientEntry) return false;
	const entry = toAbsolute(clientEntry);
	const scriptPattern = /<script\b[^>]*\bsrc=["']([^"']+)["'][^>]*>/gi;
	for (const match of template.matchAll(scriptPattern)) {
		const src = match[1];
		if (src && toAbsolute(src) === entry) return true;
	}
	return false;
};

/** Keep template-owned entry scripts from being emitted a second time. */
export const omitTemplateDeclaredScripts = (
	assets: EntryAssets,
	template: string | undefined
): EntryAssets => ({
	...assets,
	scripts: assets.scripts.filter(
		(script) => !templateDeclaresEntry(template, script)
	),
});

/** Head links for the entry assets — stylesheets first so they block paint. */
export const renderEntryLinkTags = (assets: EntryAssets): string => {
	let html = '';
	for (const style of assets.styles) {
		html += `\n\t<link rel="stylesheet" href="${escapeAttr(style)}">`;
	}
	for (const preload of assets.preloads) {
		html += `\n\t<link rel="modulepreload" crossorigin href="${escapeAttr(preload)}">`;
	}
	return html;
};

/** The executing `<script type="module">` tags for the client entry. */
export const renderEntryScriptTags = (assets: EntryAssets): string => {
	let html = '';
	for (const script of assets.scripts) {
		html += `\n\t<script type="module" crossorigin src="${escapeAttr(script)}"></script>`;
	}
	return html;
};

/** Links and scripts together, for callers that emit a single blob. */
export const renderEntryAssetTags = (assets: EntryAssets): string =>
	`${renderEntryLinkTags(assets)}${renderEntryScriptTags(assets)}`;

export interface TemplateInjection {
	readonly appHtml: string;
	readonly headHtml: string;
	readonly bodyTailHtml: string;
	readonly containerId?: string;
	/** Reported in errors so a failure points at the request that caused it. */
	readonly url?: string;
}

const TITLE_PATTERN = /<title[^>]*>[\s\S]*?<\/title>/i;

const escapeRegExp = (value: string): string =>
	value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * Matches `<div id="app">…</div>` (any tag, any attribute order, single or
 * double quotes) and captures the open tag, the current content and the close
 * tag. The content match is lazy and the close tag is anchored to the same tag
 * name, which is correct for the empty or placeholder containers templates use.
 */
const createContainerPattern = (containerId: string): RegExp =>
	new RegExp(
		`(<([a-zA-Z][\\w-]*)\\b[^>]*\\bid=["']${escapeRegExp(containerId)}["'][^>]*>)([\\s\\S]*?)(<\\/\\2>)`,
		'i'
	);

const injectHead = (template: string, headHtml: string): string => {
	if (!headHtml) return template;

	// A title rendered by the app supersedes the template's placeholder title,
	// otherwise the document would ship with two of them.
	let result = template;
	if (TITLE_PATTERN.test(headHtml) && TITLE_PATTERN.test(result)) {
		result = result.replace(TITLE_PATTERN, '');
	}

	// String replacements go through a replacer function so `$&`-style
	// sequences inside rendered head/body html are never re-interpreted.
	if (result.includes('</head>')) {
		return result.replace('</head>', () => `${headHtml}</head>`);
	}
	if (result.includes('<body')) {
		return result.replace('<body', () => `${headHtml}<body`);
	}
	return `${headHtml}${result}`;
};

/**
 * Insert html at the end of the document body — before `</body>` when the
 * fragment has one, otherwise appended.
 */
export const appendBodyTail = (
	template: string,
	bodyTailHtml: string
): string => {
	if (!bodyTailHtml) return template;
	if (template.includes('</body>')) {
		return template.replace('</body>', () => `${bodyTailHtml}</body>`);
	}
	if (template.includes('</html>')) {
		return template.replace('</html>', () => `${bodyTailHtml}</html>`);
	}
	return `${template}${bodyTailHtml}`;
};

/**
 * Render the app into a user-supplied HTML template.
 *
 * The template is preserved verbatim apart from the three injection points, so
 * the client entry `<script type="module">` it declares survives into the
 * response — without it the served page can never hydrate.
 */
export const injectIntoTemplate = (
	template: string,
	injection: TemplateInjection
): string => {
	const containerId = injection.containerId ?? DEFAULT_CONTAINER_ID;

	let html: string;
	if (template.includes(SSR_OUTLET_COMMENT)) {
		html = template.replace(SSR_OUTLET_COMMENT, () => injection.appHtml);
	} else {
		const containerPattern = createContainerPattern(containerId);
		if (!containerPattern.test(template)) {
			throw new RenderError({
				message:
					`SSR template has no render outlet: expected an element with id="${containerId}" ` +
					`or the ${SSR_OUTLET_COMMENT} marker. Add \`<div id="${containerId}"></div>\` to the template, ` +
					`or set \`containerId\` in ServerAppOptions to match your own container.`,
				url: injection.url ?? '',
			});
		}
		html = template.replace(
			containerPattern,
			(_match, open: string, _tag: string, _content: string, close: string) =>
				`${open}${injection.appHtml}${close}`
		);
	}

	html = injectHead(html, injection.headHtml);
	return appendBodyTail(html, injection.bodyTailHtml);
};

/** Sentinel that cannot occur in HTML, used to split a template in two. */
const STREAM_OUTLET_SENTINEL = '\u0000effuse-stream-outlet\u0000';

export interface TemplateParts {
	/** Everything up to and including the render outlet's opening tag. */
	readonly shell: string;
	/** Everything from the outlet's closing tag onward, with the tail injected. */
	readonly tail: string;
}

/**
 * Split a template around its render outlet so streaming SSR can flush the
 * shell before the body is rendered, then close with the template's own tail
 * (client entry script included) plus the hydration payload.
 */
export const splitTemplate = (
	template: string,
	injection: Omit<TemplateInjection, 'appHtml'>
): TemplateParts => {
	const html = injectIntoTemplate(template, {
		...injection,
		appHtml: STREAM_OUTLET_SENTINEL,
	});
	const index = html.indexOf(STREAM_OUTLET_SENTINEL);

	return {
		shell: html.slice(0, index),
		tail: html.slice(index + STREAM_OUTLET_SENTINEL.length),
	};
};
