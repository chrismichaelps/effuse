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

import { Predicate } from 'effect';
import type { EffuseNode, Component, BlueprintDef } from '../render/node.js';
import { isEffuseNode } from '../render/node.js';
import { isSignal } from '../reactivity/index.js';
import {
	runWithProvideScope,
	type ProvideScope,
} from '../blueprint/provide-inject.js';
import { isSuspendToken } from '../suspense/Suspense.js';
import type { HeadProps, RenderResult, ServerAppOptions } from './types.js';
import { RenderError } from './errors.js';
import { escapeHtml, escapeAttr, escapeAttrName } from './escape.js';
import { headToHtml } from './head-registry.js';
import { runWithSSRContext } from './use-head.js';
import { serializeHydrationData, type HydrationData } from './hydration.js';
import type { SSRRuntime } from './runtime.js';
import type { ComponentLifecycle } from '../blueprint/lifecycle.js';

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
	ssrRuntime: SSRRuntime,
	options: ServerAppOptions = {}
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

				const fullHtml = generateFullHtml(html, mergedHead, hydrationData, options);

				const timing = Date.now() - startTime;

				return {
					html: fullHtml,
					head: mergedHead,
					state: serializedState,
					timing,
				};
			} catch (error) {
				if (error instanceof RenderError) {
					throw error;
				}
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
		return renderChildren(node as readonly unknown[]);
	}

	if (isEffuseNode(node)) {
		return renderEffuseNode(node);
	}

	if (Predicate.isFunction(node)) {
		try {
			const result = (node as () => unknown)();
			return renderNodeToString(result);
		} catch (err) {
			if (isSuspendToken(err)) {
				return '';
			}
			throw err;
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

/** Void elements, hoisted so the set is not rebuilt for every element. */
const SELF_CLOSING_TAGS = new Set([
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
]);

/** Concatenates children without the intermediate array `map().join('')` builds. */
const renderChildren = (children: readonly unknown[]): string => {
	let html = '';
	for (let index = 0; index < children.length; index += 1) {
		html += renderNodeToString(children[index]);
	}
	return html;
};

const renderEffuseNode = (node: EffuseNode): string => {
	// Direct dispatch on the tag. The combinator form allocated a fresh object
	// of five closures for every node rendered, which dominated large documents.
	switch (node._tag) {
		case 'Text':
			return escapeHtml(node.text);
		case 'Element': {
			const tag = node.tag;
			const attrs = renderAttributes(node.props ?? {});
			const attrStr = attrs ? ` ${attrs}` : '';

			if (SELF_CLOSING_TAGS.has(tag)) {
				return `<${tag}${attrStr}>`;
			}

			return `<${tag}${attrStr}>${renderChildren(node.children)}</${tag}>`;
		}
		case 'Blueprint':
			return renderBlueprint(node.blueprint, node.props);
		case 'Fragment':
		case 'List':
			return renderChildren(node.children);
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

	const provideScope = (state as Record<string, unknown>)._provideScope as
		| ProvideScope
		| undefined;

	let html: string | undefined;
	let renderError: unknown;
	let renderFailed = false;
	try {
		const viewResult = provideScope
			? runWithProvideScope(provideScope, () => def.view(context))
			: def.view(context);
		html = renderNodeToString(viewResult);
	} catch (error) {
		renderFailed = true;
		renderError = error;
	}

	let cleanupError: unknown;
	let cleanupFailed = false;
	const lifecycle = (state as { lifecycle?: ComponentLifecycle }).lifecycle;
	try {
		lifecycle?.runCleanup();
	} catch (error) {
		cleanupFailed = true;
		cleanupError = error;
	}

	if (renderFailed && cleanupFailed) {
		throw new AggregateError(
			[renderError, cleanupError],
			'[Effuse] SSR component render and lifecycle cleanup both failed.'
		);
	}
	if (renderFailed) throw renderError;
	if (cleanupFailed) throw cleanupError;
	return html ?? '';
};

const normalizeClassValue = (value: unknown): string => {
	if (Predicate.isString(value)) {
		return value;
	}
	if (Array.isArray(value)) {
		return value
			.map(normalizeClassValue)
			.filter((part) => part !== '')
			.join(' ');
	}
	if (Predicate.isObject(value)) {
		return Object.entries(value as Record<string, unknown>)
			.filter(([, enabled]) => Boolean(enabled))
			.map(([name]) => name)
			.join(' ');
	}
	return '';
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

		if (key === 'ref' || key.startsWith('use:')) {
			continue;
		}

		if (value == null) {
			continue;
		}

		let actualValue = isSignal(value)
			? (value as { value: unknown }).value
			: value;

		// Zero-arg functions are reactive getters on the client; evaluate them
		// so SSR output matches the first client render.
		if (Predicate.isFunction(actualValue) && actualValue.length === 0) {
			actualValue = (actualValue as () => unknown)();
			if (isSignal(actualValue)) {
				actualValue = (actualValue as { value: unknown }).value;
			}
		} else if (Predicate.isFunction(actualValue)) {
			continue;
		}

		if (actualValue == null) {
			continue;
		}

		if (key === 'class' || key === 'className') {
			const classString = normalizeClassValue(actualValue);
			if (classString !== '') {
				parts.push(`class="${escapeAttr(classString)}"`);
			}
			continue;
		}

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
	hydrationData: HydrationData,
	options: ServerAppOptions = {}
): string => {
	let headHtml = headToHtml(head);
	const lang = head.lang ?? 'en';
	
	if (options.manifest) {
		for (const chunk of Object.values(options.manifest)) {
			if (chunk.isEntry) {
				headHtml += `\n\t<link rel="modulepreload" crossorigin href="/${chunk.file}">`;
				if (chunk.css) {
					for (const cssFile of chunk.css) {
						headHtml += `\n\t<link rel="stylesheet" href="/${cssFile}">`;
					}
				}
			}
		}
	}

	const hydrationScript = options.hydrate !== false 
		? serializeHydrationData(hydrationData) 
		: '';

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

const camelToKebab = (str: string): string => {
	return str.replace(/([a-z])([A-Z])/g, '$1-$2').toLowerCase();
};
