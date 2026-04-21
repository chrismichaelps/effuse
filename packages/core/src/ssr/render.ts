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

import { Predicate, pipe } from 'effect';
import type { EffuseNode, Component, BlueprintDef } from '../render/node.js';
import { isEffuseNode, matchEffuseNode } from '../render/node.js';
import { isSignal } from '../reactivity/index.js';
import type { HeadProps, RenderResult } from './types.js';
import { RenderError } from './errors.js';
import { headToHtml } from './head-registry.js';
import { runWithSSRContext } from './use-head.js';
import { serializeHydrationData, type HydrationData } from './hydration.js';
import type { SSRRuntime } from './runtime.js';

/**
 * Render a component tree to a full HTML string using the SSRRuntime.
 *
 * The runtime must have been initialized via `createSSRRuntime` so that
 * layer services and props are available during rendering.
 *
 * Uses `runWithSSRContext` (AsyncLocalStorage) to scope `useHead()` calls
 * to this render pass — no module globals, safe for concurrent requests.
 */
export const renderToString = (
	root: Component | EffuseNode,
	url: string,
	ssrRuntime: SSRRuntime
): RenderResult => {
	const startTime = Date.now();

	// Run the entire render inside the AsyncLocalStorage SSR context
	return runWithSSRContext(
		{
			push: (head: HeadProps) => {
				ssrRuntime.headStack.push(head);
			},
		},
		() => {
			try {
				const html = renderNodeToString(root);

				// Merge all collected heads (layer heads + useHead() calls)
				const mergedHead = ssrRuntime.headStack.reduce<HeadProps>(
					(acc, head) => ({ ...acc, ...head }),
					{}
				);

				// Serialize state for hydration
				const serializedState: Record<string, unknown> = {};
				for (const [key, value] of ssrRuntime.state) {
					serializedState[key] = value;
				}

				const hydrationData: HydrationData = {
					head: mergedHead,
					state: serializedState,
					url,
					timestamp: Date.now(),
				};

				const fullHtml = generateFullHtml(html, mergedHead, hydrationData);

				const timing = Date.now() - startTime;

				return {
					html: fullHtml,
					head: mergedHead,
					state: serializedState,
					timing,
				};
			} catch (error) {
				throw new RenderError({
					message: `Render failed: ${String(error)}`,
					url,
					cause: error,
				});
			}
		}
	);
};

/**
 * Render a component tree to an HTML body fragment (no full document).
 * Useful when you want to control the outer shell yourself.
 */
export const renderToFragment = (
	root: Component | EffuseNode,
	ssrRuntime: SSRRuntime
): string => {
	return runWithSSRContext(
		{
			push: (head: HeadProps) => {
				ssrRuntime.headStack.push(head);
			},
		},
		() => renderNodeToString(root)
	);
};

const renderNodeToString = (node: unknown): string => {
	if (node == null) {
		return '';
	}

	if (Predicate.isString(node)) {
		return escapeHtml(node);
	}
	if (Predicate.isNumber(node)) {
		return String(node);
	}

	if (Predicate.isBoolean(node)) {
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

	if (Predicate.isFunction(node)) {
		try {
			const result = (node as () => unknown)();
			return renderNodeToString(result);
		} catch {
			return '';
		}
	}

	if (
		Predicate.isObject(node) &&
		Predicate.hasProperty(node, '_tag') &&
		node._tag === 'Blueprint'
	) {
		return renderBlueprint(node as BlueprintDef, {});
	}

	return '';
};

const renderEffuseNode = (node: EffuseNode): string => {
	return pipe(
		node,
		matchEffuseNode({
			Text: (node) => escapeHtml(node.text),
			Element: (node) => {
				const tag = node.tag;
				const props = node.props ?? {};
				const children = node.children;

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
			},
			Blueprint: (node) => renderBlueprint(node.blueprint, node.props),
			Fragment: (node) => node.children.map(renderNodeToString).join(''),
			List: (node) => node.children.map(renderNodeToString).join(''),
		})
	);
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

		if (key.startsWith('on') && Predicate.isFunction(value)) {
			continue;
		}

		if (value == null) {
			continue;
		}

		const actualValue = isSignal(value)
			? (value as { value: unknown }).value
			: value;

		if (Predicate.isBoolean(actualValue)) {
			if (actualValue) {
				parts.push(
					escapeAttrName(key === 'className' ? 'class' : camelToKebab(key))
				);
			}
			continue;
		}

		const attrName = escapeAttrName(
			key === 'className' ? 'class' : camelToKebab(key)
		);

		if (key === 'style' && Predicate.isObject(actualValue)) {
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
	hydrationData: HydrationData
): string => {
	const headHtml = headToHtml(head);
	const lang = head.lang ?? 'en';
	const hydrationScript = serializeHydrationData(hydrationData);

	return `<!DOCTYPE html>
<html lang="${lang}">
<head>
	${headHtml}
</head>
<body>
	<div id="app">${bodyHtml}</div>
	${hydrationScript}
</body>
</html>`;
};

const escapeHtml = (str: string): string => {
	return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
};

const escapeAttr = (str: string): string => {
	return str
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;')
		.replace(/'/g, '&#39;');
};

const escapeAttrName = (str: string): string => {
	return escapeAttr(str)
		.replace(/\//g, '&#47;')
		.replace(/\s/g, '&#32;')
		.replace(/=/g, '&#61;');
};

const camelToKebab = (str: string): string => {
	return str.replace(/([a-z])([A-Z])/g, '$1-$2').toLowerCase();
};
