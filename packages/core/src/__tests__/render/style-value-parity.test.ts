// @vitest-environment jsdom
/**
 * MIT License
 *
 * Copyright (c) 2025 Chris M. Perez
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../../app/createApp.js';
import { define } from '../../blueprint/define.js';
import { signal } from '../../reactivity/signal.js';
import {
	EFFUSE_NODE,
	CreateElementNode,
	type Component,
} from '../../render/node.js';
import { renderToFragment } from '../../ssr/render.js';
import { createSSRRuntime } from '../../ssr/runtime.js';

const flushRenderer = async (): Promise<void> => {
	for (let index = 0; index < 6; index++) await Promise.resolve();
};

const el = (
	tag: string,
	props: Record<string, unknown>,
	children: unknown[]
): ReturnType<typeof CreateElementNode> =>
	CreateElementNode({
		[EFFUSE_NODE]: true,
		tag,
		props,
		children: children as never,
	});

const componentWithStyle = (value: unknown): Component =>
	define({
		script: () => ({}),
		template: () => el('div', { id: 'target', style: value }, ['x']),
	}) as unknown as Component;

/** Declarations the server writes, normalized for comparison. */
const declarations = (style: string | null): string[] =>
	(style ?? '')
		.split(';')
		.map((part) => part.trim().replace(/\s*:\s*/, ': '))
		.filter((part) => part !== '')
		.sort();

const serverStyle = async (value: unknown): Promise<string[]> => {
	const runtime = await createSSRRuntime([]);
	try {
		const markup = runtime.run(() =>
			renderToFragment(componentWithStyle(value), runtime)
		);
		return declarations(/style="([^"]*)"/.exec(markup)?.[1] ?? null);
	} finally {
		await runtime.dispose();
	}
};

const clientStyle = async (value: unknown): Promise<string[]> => {
	document.body.innerHTML = '<div id="app"></div>';
	const app = await createApp(componentWithStyle(value)).mount('#app');
	await flushRenderer();
	const result = declarations(
		document.querySelector('#target')?.getAttribute('style') ?? null
	);
	await app.unmount();
	return result;
};

describe('style value parity between server and client', () => {
	beforeEach(() => {
		document.body.innerHTML = '<div id="app"></div>';
	});

	afterEach(() => {
		document.body.replaceChildren();
	});

	const cases: ReadonlyArray<readonly [string, unknown]> = [
		['a single declaration string', 'color: red'],
		['a multi declaration string', 'color: red; font-size: 10px'],
		['an object', { color: 'red' }],
		['an object with a camelCase property', { fontSize: '10px' }],
		['an object with a numeric value', { zIndex: 5 }],
	];

	for (const [label, value] of cases) {
		it(`applies ${label} the same way the server does`, async () => {
			const expected = await serverStyle(value);
			expect(expected.length).toBeGreaterThan(0);
			await expect(clientStyle(value)).resolves.toEqual(expected);
		});
	}

	it('leaves no style attribute for a null value', async () => {
		await expect(clientStyle(null)).resolves.toEqual([]);
	});

	it('replaces a string style when it changes', async () => {
		const current = signal('color: red');
		const App = define({
			script: () => ({}),
			template: () => () =>
				el('div', { id: 'target', style: current.value }, ['x']),
		});

		const app = await createApp(App as unknown as Component).mount('#app');
		await flushRenderer();
		expect(
			declarations(document.querySelector('#target')?.getAttribute('style') ?? null)
		).toEqual(['color: red']);

		current.value = 'font-size: 10px';
		await flushRenderer();
		expect(
			declarations(document.querySelector('#target')?.getAttribute('style') ?? null)
		).toEqual(['font-size: 10px']);

		await app.unmount();
	});
});
