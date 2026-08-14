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

const componentWithClass = (value: unknown): Component =>
	define({
		script: () => ({}),
		template: () => el('div', { id: 'target', class: value }, ['x']),
	}) as unknown as Component;

/** The class attribute the server writes for `value`. */
const serverClass = async (value: unknown): Promise<string | null> => {
	const runtime = await createSSRRuntime([]);
	try {
		const markup = runtime.run(() =>
			renderToFragment(componentWithClass(value), runtime)
		);
		return /class="([^"]*)"/.exec(markup)?.[1] ?? null;
	} finally {
		await runtime.dispose();
	}
};

/** The class attribute the client produces for `value`. */
const clientClass = async (value: unknown): Promise<string | null> => {
	document.body.innerHTML = '<div id="app"></div>';
	const app = await createApp(componentWithClass(value)).mount('#app');
	await flushRenderer();
	const element = document.querySelector('#target');
	const result = element?.getAttribute('class') ?? null;
	await app.unmount();
	return result === '' ? null : result;
};

describe('class value parity between server and client', () => {
	beforeEach(() => {
		document.body.innerHTML = '<div id="app"></div>';
	});

	afterEach(() => {
		document.body.replaceChildren();
	});

	const cases: ReadonlyArray<readonly [string, unknown]> = [
		['a plain string', 'one two'],
		['an object with truthy and falsy entries', { active: true, off: false }],
		['an object with every entry falsy', { off: false }],
		['an array of strings', ['one', 'two']],
		['an array mixing strings and objects', ['one', { two: true, no: false }]],
		['a nested array', [['one', 'two'], 'three']],
		['an array with empty parts', ['one', '', 'two']],
	];

	for (const [label, value] of cases) {
		it(`applies ${label} the same way the server does`, async () => {
			const expected = await serverClass(value);
			await expect(clientClass(value)).resolves.toBe(expected);
		});
	}

	it('clears the class when the value becomes null', async () => {
		const current = signal<unknown>({ active: true });
		const App = define({
			script: () => ({}),
			template: () => () =>
				el('div', { id: 'target', class: current.value }, ['x']),
		});

		const app = await createApp(App as unknown as Component).mount('#app');
		await flushRenderer();
		expect(document.querySelector('#target')?.getAttribute('class')).toBe(
			'active'
		);

		current.value = null;
		await flushRenderer();
		expect(document.querySelector('#target')?.className).toBe('');

		await app.unmount();
	});

	it('updates a reactive object class when a flag flips', async () => {
		const isActive = signal(false);
		const App = define({
			script: () => ({}),
			template: () => () =>
				el('div', { id: 'target', class: { active: isActive.value } }, ['x']),
		});

		const app = await createApp(App as unknown as Component).mount('#app');
		await flushRenderer();
		expect(document.querySelector('#target')?.className).toBe('');

		isActive.value = true;
		await flushRenderer();
		expect(document.querySelector('#target')?.className).toBe('active');

		await app.unmount();
	});
});
