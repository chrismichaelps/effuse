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

import {
	Effect,
	Context,
	Ref,
	Layer,
	Option as EffectOption,
	pipe,
} from 'effect';
import type { HeadProps, MetaTag, LinkTag, ScriptTag } from './types.js';

export class HeadRegistry extends Context.Tag('HeadRegistry')<
	HeadRegistry,
	{
		readonly push: (head: HeadProps) => Effect.Effect<void>;

		readonly getMerged: () => Effect.Effect<HeadProps>;

		readonly clear: () => Effect.Effect<void>;
	}
>() {}

export const mergeHeadProps = (
	base: HeadProps,
	override: HeadProps
): HeadProps => {
	const merged: HeadProps = { ...base };
	const mutable = merged as Record<string, unknown>;

	const scalars: (keyof HeadProps)[] = [
		'title',
		'description',
		'canonical',
		'viewport',
		'charset',
		'lang',
		'themeColor',
		'favicon',
		'base',
		'robots',
	];

	for (const key of scalars) {
		if (override[key] !== undefined) {
			mutable[key] = override[key];
		}
	}

	if (override.og) {
		mutable.og = { ...base.og, ...override.og };
	}
	if (override.twitter) {
		mutable.twitter = { ...base.twitter, ...override.twitter };
	}

	if (override.meta) {
		const existing = base.meta ?? [];
		const newMeta = dedupeMetaTags([...existing, ...override.meta]);
		mutable.meta = newMeta;
	}
	if (override.link) {
		const existing = base.link ?? [];
		const newLinks = dedupeLinkTags([...existing, ...override.link]);
		mutable.link = newLinks;
	}
	if (override.script) {
		const existing = base.script ?? [];
		const newScripts = dedupeScriptTags([...existing, ...override.script]);
		mutable.script = newScripts;
	}

	return merged;
};

const dedupeMetaTags = (tags: readonly MetaTag[]): MetaTag[] => {
	const seen = new Map<string, MetaTag>();
	for (const tag of tags) {
		const key = tag.name ?? tag.property ?? tag.content;
		seen.set(key, tag);
	}
	return Array.from(seen.values());
};

const dedupeLinkTags = (tags: readonly LinkTag[]): LinkTag[] => {
	const seen = new Map<string, LinkTag>();
	for (const tag of tags) {
		const key = `${tag.rel}:${tag.href}`;
		seen.set(key, tag);
	}
	return Array.from(seen.values());
};

const dedupeScriptTags = (tags: readonly ScriptTag[]): ScriptTag[] => {
	const seen = new Map<string, ScriptTag>();
	for (const tag of tags) {
		const key = pipe(
			EffectOption.fromNullable(tag.src),
			EffectOption.orElse(() => EffectOption.fromNullable(tag.id)),
			EffectOption.orElse(() =>
				pipe(
					EffectOption.fromNullable(tag.content),
					EffectOption.map((c) => c.slice(0, 50))
				)
			),
			EffectOption.getOrElse(() => '')
		);
		if (key) {
			seen.set(key, tag);
		}
	}
	return Array.from(seen.values());
};

export const HeadRegistryLive = Layer.effect(
	HeadRegistry,
	Effect.gen(function* () {
		const stackRef = yield* Ref.make<HeadProps[]>([]);

		return {
			push: (head: HeadProps) =>
				Ref.update(stackRef, (stack) => [...stack, head]),

			getMerged: () =>
				Effect.gen(function* () {
					const stack = yield* Ref.get(stackRef);
					return stack.reduce<HeadProps>(
						(acc, head) => mergeHeadProps(acc, head),
						{}
					);
				}),

			clear: () => Ref.set(stackRef, []),
		};
	})
);

export const mergeLayerHeads = (heads: readonly HeadProps[]): HeadProps => {
	return heads.reduce<HeadProps>((acc, head) => mergeHeadProps(acc, head), {});
};

export const headToHtml = (head: HeadProps): string => {
	const parts: string[] = [];

	if (head.charset) {
		parts.push(`<meta charset="${escapeAttr(head.charset)}">`);
	} else {
		parts.push('<meta charset="utf-8">');
	}

	if (head.viewport) {
		parts.push(`<meta name="viewport" content="${escapeAttr(head.viewport)}">`);
	} else {
		parts.push(
			'<meta name="viewport" content="width=device-width, initial-scale=1">'
		);
	}

	if (head.title) {
		parts.push(`<title>${escapeHtml(head.title)}</title>`);
	}

	if (head.description) {
		parts.push(
			`<meta name="description" content="${escapeAttr(head.description)}">`
		);
	}

	if (head.canonical) {
		parts.push(`<link rel="canonical" href="${escapeAttr(head.canonical)}">`);
	}

	if (head.base) {
		parts.push(`<base href="${escapeAttr(head.base)}">`);
	}

	if (head.themeColor) {
		parts.push(
			`<meta name="theme-color" content="${escapeAttr(head.themeColor)}">`
		);
	}

	if (head.favicon) {
		parts.push(`<link rel="icon" href="${escapeAttr(head.favicon)}">`);
	}

	if (head.robots) {
		parts.push(`<meta name="robots" content="${escapeAttr(head.robots)}">`);
	}

	if (head.og) {
		for (const [key, value] of Object.entries(head.og)) {
			if (value) {
				parts.push(
					`<meta property="og:${escapeAttr(key)}" content="${escapeAttr(value)}">`
				);
			}
		}
	}

	if (head.twitter) {
		for (const [key, value] of Object.entries(head.twitter)) {
			if (value) {
				parts.push(
					`<meta name="twitter:${escapeAttr(key)}" content="${escapeAttr(value)}">`
				);
			}
		}
	}

	if (head.meta) {
		for (const tag of head.meta) {
			const attrs: string[] = [];
			if (tag.name) attrs.push(`name="${escapeAttr(tag.name)}"`);
			if (tag.property) attrs.push(`property="${escapeAttr(tag.property)}"`);
			if (tag.httpEquiv)
				attrs.push(`http-equiv="${escapeAttr(tag.httpEquiv)}"`);
			attrs.push(`content="${escapeAttr(tag.content)}"`);
			parts.push(`<meta ${attrs.join(' ')}>`);
		}
	}

	if (head.link) {
		for (const tag of head.link) {
			const attrs = Object.entries(tag)
				.filter(([, v]) => v !== undefined)
				.map(([k, v]) => `${k}="${escapeAttr(String(v))}"`)
				.join(' ');
			parts.push(`<link ${attrs}>`);
		}
	}

	if (head.script) {
		for (const tag of head.script) {
			const attrs: string[] = [];
			if (tag.src) attrs.push(`src="${escapeAttr(tag.src)}"`);
			if (tag.type) attrs.push(`type="${escapeAttr(tag.type)}"`);
			if (tag.async) attrs.push('async');
			if (tag.defer) attrs.push('defer');
			if (tag.id) attrs.push(`id="${escapeAttr(tag.id)}"`);

			const attrStr = attrs.length > 0 ? ` ${attrs.join(' ')}` : '';
			const content = tag.content ? escapeHtml(tag.content) : '';
			parts.push(`<script${attrStr}>${content}</script>`);
		}
	}

	return parts.join('\n\t');
};

const escapeHtml = (str: string): string => {
	return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
};

const escapeAttr = (str: string): string => {
	return str
		.replace(/&/g, '&amp;')
		.replace(/"/g, '&quot;')
		.replace(/'/g, '&#39;');
};
