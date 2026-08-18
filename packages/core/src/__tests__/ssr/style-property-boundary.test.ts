// @vitest-environment jsdom
/**
 * MIT License
 *
 * Copyright (c) 2025 Chris M. Perez
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../../app/createApp.js';
import { define } from '../../blueprint/define.js';
import { renderToFragment } from '../../ssr/render.js';
import { createSSRRuntime } from '../../ssr/runtime.js';
import { styleKeyToCssProperty } from '../../render/style-property.js';
import {
	CreateElementNode,
	EFFUSE_NODE,
	type Component,
} from '../../render/node.js';

const flushRenderer = async (): Promise<void> => {
	for (let index = 0; index < 8; index++) await Promise.resolve();
};

const node = (style: Record<string, unknown>) =>
	CreateElementNode({
		[EFFUSE_NODE]: true,
		tag: 'div',
		props: { id: 'target', style: style as never },
		children: ['x'] as never,
	});

/** The style attribute the server writes, normalised for comparison. */
const serverStyle = async (style: Record<string, unknown>): Promise<string> => {
	const runtime = await createSSRRuntime([]);
	try {
		const html = renderToFragment(node(style) as never, runtime);
		return (/style="([^"]*)"/.exec(html)?.[1] ?? '').trim().replace(/;$/, '');
	} finally {
		await runtime.dispose();
	}
};

/** The same, after a client render. */
const clientStyle = async (style: Record<string, unknown>): Promise<string> => {
	const App = define({
		script: () => ({}),
		template: () => node(style),
	}) as unknown as Component;

	const app = await createApp(App).mount('#app');
	await flushRenderer();
	const written =
		document.querySelector('#target')?.getAttribute('style') ?? '';
	await app.unmount();
	return written.trim().replace(/;$/, '');
};

describe('styleKeyToCssProperty', () => {
	it('kebab-cases an ordinary camelCase key', () => {
		expect(styleKeyToCssProperty('fontSize')).toBe('font-size');
		expect(styleKeyToCssProperty('backgroundColor')).toBe('background-color');
	});

	it('keeps the leading dash on a vendor-prefixed key', () => {
		// `([a-z])([A-Z])` needs a preceding lowercase letter, so these lost
		// their dash and became property names that do not exist.
		expect(styleKeyToCssProperty('WebkitTransform')).toBe('-webkit-transform');
		expect(styleKeyToCssProperty('MozAppearance')).toBe('-moz-appearance');
		expect(styleKeyToCssProperty('WebkitLineClamp')).toBe('-webkit-line-clamp');
	});

	it('leaves an already-kebab key alone', () => {
		expect(styleKeyToCssProperty('font-size')).toBe('font-size');
	});

	it('passes a custom property through untouched', () => {
		// Custom properties are case-sensitive: rewriting `--myVar` broke every
		// `var(--myVar)` and collided with a real `--my-var`.
		expect(styleKeyToCssProperty('--myVar')).toBe('--myVar');
		expect(styleKeyToCssProperty('--brandColor')).toBe('--brandColor');
		expect(styleKeyToCssProperty('--my-var')).toBe('--my-var');
	});
});

describe('style keys across the render boundary', () => {
	beforeEach(() => {
		document.body.replaceChildren();
		const host = document.createElement('div');
		host.id = 'app';
		document.body.append(host);
	});

	afterEach(() => {
		document.body.replaceChildren();
	});

	const VENDOR: [string, string][] = [
		['WebkitTransform', 'scale(2)'],
		['WebkitLineClamp', '2'],
		['WebkitUserSelect', 'none'],
	];

	it.each(VENDOR)('server writes %s with its leading dash', async (key, value) => {
		const expected = `${styleKeyToCssProperty(key)}: ${value}`;

		expect(await serverStyle({ [key]: value })).toBe(expected);
		expect(await clientStyle({ [key]: value })).toBe(expected);
	});

	it('agrees on an ordinary camelCase key', async () => {
		expect(await serverStyle({ fontSize: '12px' })).toBe('font-size: 12px');
		expect(await clientStyle({ fontSize: '12px' })).toBe('font-size: 12px');
	});

	it('agrees on a custom property, keeping its case', async () => {
		expect(await serverStyle({ '--myVar': 'red' })).toBe('--myVar: red');
		expect(await clientStyle({ '--myVar': 'red' })).toBe('--myVar: red');
	});

	it('keeps two custom properties that differ only in case apart', async () => {
		// Converting both to `--my-var` made them one property, so one was lost.
		const server = await serverStyle({ '--myVar': 'red', '--my-var': 'blue' });

		expect(server).toContain('--myVar: red');
		expect(server).toContain('--my-var: blue');
	});

	it('still writes a plain string style through unchanged', async () => {
		expect(await serverStyle({} as never)).toBe('');
		const runtime = await createSSRRuntime([]);
		const html = renderToFragment(
			CreateElementNode({
				[EFFUSE_NODE]: true,
				tag: 'div',
				props: { id: 'target', style: 'color: red' },
				children: ['x'] as never,
			}) as never,
			runtime
		);
		await runtime.dispose();

		expect(html).toContain('style="color: red"');
	});
});
