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

import { Effect, Scope, Exit } from 'effect';
import type {
	EffuseNode,
	EffuseChild,
	Component,
	BlueprintDef,
} from '../render/node.js';
import { isEffuseNode, NodeType } from '../render/node.js';
import { isSignal } from '../reactivity/index.js';
import type { HeadProps, RenderResult } from './types.js';
import { RenderError } from './errors.js';
import { headToHtml, mergeLayerHeads } from './head-registry.js';
import { setSSRContext } from './use-head.js';

export const renderToString = (
	root: Component | EffuseNode,
	url: string,
	layerHeads: HeadProps[] = []
): Effect.Effect<RenderResult, RenderError> =>
	Effect.gen(function* () {
		const startTime = Date.now();

		const scope = yield* Scope.make();

		const baseHead = mergeLayerHeads(layerHeads);

		const headStack: HeadProps[] = [baseHead];

		setSSRContext({
			push: (head: HeadProps) => {
				headStack.push(head);
			},
		});

		try {
			const html = yield* Effect.try({
				try: () => renderNodeToString(root),
				catch: (error) =>
					new RenderError({
						message: `Render failed: ${String(error)}`,
						url,
						cause: error,
					}),
			});

			const mergedHead = headStack.reduce<HeadProps>(
				(acc, head) => ({ ...acc, ...head }),
				{}
			);

			const fullHtml = generateFullHtml(html, mergedHead, {});

			const timing = Date.now() - startTime;

			return {
				html: fullHtml,
				head: mergedHead,
				state: {},
				timing,
			};
		} finally {
			setSSRContext(null);
			yield* Scope.close(scope, Exit.succeed(undefined));
		}
	});

const renderNodeToString = (node: unknown): string => {
	if (node == null) {
		return '';
	}

	if (typeof node === 'string') {
		return escapeHtml(node);
	}
	if (typeof node === 'number') {
		return String(node);
	}

	if (typeof node === 'boolean') {
		return '';
	}

	if (isSignal(node)) {
		return renderNodeToString((node as { value: unknown }).value);
	}

	if (Array.isArray(node)) {
		return node.map(renderNodeToString).join('');
	}

	if (isEffuseNode(node)) {
		return renderEffuseNode(node);
	}

	if (typeof node === 'function') {
		try {
			const result = (node as () => unknown)();
			return renderNodeToString(result);
		} catch {
			return '';
		}
	}

	if (
		typeof node === 'object' &&
		'_tag' in node &&
		(node as Record<string, unknown>)._tag === 'Blueprint'
	) {
		return renderBlueprint(node as BlueprintDef, {});
	}

	return '';
};

const renderEffuseNode = (node: EffuseNode): string => {
	switch (node.type) {
		case NodeType.TEXT:
			return escapeHtml(node.text);

		case NodeType.ELEMENT: {
			const tag = node.tag;
			const props = node.props ?? {};
			const children =
				(node as unknown as { children?: EffuseChild[] }).children ?? [];

			const attrs = renderAttributes(props);
			const attrStr = attrs ? ` ${attrs}` : '';

			const selfClosing = [
				'area',
				'base',
				'br',
				'col',
				'embed',
				'hr',
				'img',
				'input',
				'link',
				'meta',
				'param',
				'source',
				'track',
				'wbr',
			];

			if (selfClosing.includes(tag)) {
				return `<${tag}${attrStr}>`;
			}

			const childHtml = children.map(renderNodeToString).join('');
			return `<${tag}${attrStr}>${childHtml}</${tag}>`;
		}

		case NodeType.BLUEPRINT: {
			const bp = node as unknown as {
				blueprint: BlueprintDef;
				props: Record<string, unknown>;
			};
			return renderBlueprint(bp.blueprint, bp.props);
		}

		case NodeType.FRAGMENT:
		case NodeType.LIST: {
			const children =
				(node as unknown as { children?: EffuseChild[] }).children ?? [];
			return children.map(renderNodeToString).join('');
		}

		default:
			return '';
	}
};

const renderBlueprint = (
	def: BlueprintDef,
	props: Record<string, unknown>
): string => {
	const state = def.state ? def.state(props) : {};

	const context = {
		props,
		state,
		portals: {},
	};

	const viewResult = def.view(context);
	return renderNodeToString(viewResult);
};

const renderAttributes = (props: Record<string, unknown>): string => {
	const parts: string[] = [];

	for (const [key, value] of Object.entries(props)) {
		if (key === 'children' || key.startsWith('_')) {
			continue;
		}

		if (key.startsWith('on') && typeof value === 'function') {
			continue;
		}

		if (value == null) {
			continue;
		}

		const actualValue = isSignal(value)
			? (value as { value: unknown }).value
			: value;

		if (typeof actualValue === 'boolean') {
			if (actualValue) {
				parts.push(key);
			}
			continue;
		}

		const attrName = key === 'className' ? 'class' : key;

		if (key === 'style' && typeof actualValue === 'object') {
			const styleStr = Object.entries(
				actualValue as Record<string, string | number>
			)
				.map(([k, v]) => `${camelToKebab(k)}: ${String(v)}`)
				.join('; ');
			parts.push(`style="${escapeAttr(styleStr)}"`);
			continue;
		}

		parts.push(`${attrName}="${escapeAttr(String(actualValue))}"`);
	}

	return parts.join(' ');
};

const generateFullHtml = (
	bodyHtml: string,
	head: HeadProps,
	state: Record<string, unknown>
): string => {
	const headHtml = headToHtml(head);
	const lang = head.lang ?? 'en';
	const stateScript =
		Object.keys(state).length > 0
			? `<script id="__EFFUSE_DATA__" type="application/json">${JSON.stringify(state)}</script>`
			: '';

	return `<!DOCTYPE html>
<html lang="${lang}">
<head>
	${headHtml}
</head>
<body>
	<div id="app">${bodyHtml}</div>
	${stateScript}
</body>
</html>`;
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

const camelToKebab = (str: string): string => {
	return str.replace(/([a-z])([A-Z])/g, '$1-$2').toLowerCase();
};
