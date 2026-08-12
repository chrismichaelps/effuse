// @vitest-environment jsdom
/**
 * MIT License
 *
 * Copyright (c) 2025 Chris M. Perez
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createApp } from '../../app/createApp.js';
import { define } from '../../blueprint/define.js';
import { createRef } from '../../refs/ref.js';
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

const componentWith = (props: Record<string, unknown>): Component =>
	define({
		script: () => ({}),
		template: () =>
			CreateElementNode({
				[EFFUSE_NODE]: true,
				tag: 'div',
				props: { id: 'target', ...props },
				children: ['x'] as never,
			}),
	}) as unknown as Component;

/** Attribute names the server writes, sorted. */
const serverAttributes = async (
	props: Record<string, unknown>
): Promise<string[]> => {
	const runtime = await createSSRRuntime([]);
	try {
		const markup = runtime.run(() =>
			renderToFragment(componentWith(props), runtime)
		);
		const container = document.createElement('div');
		container.innerHTML = markup;
		const element = container.querySelector('#target');
		return (element?.getAttributeNames() ?? []).sort();
	} finally {
		await runtime.dispose();
	}
};

/** Attribute names the client writes, sorted. */
const clientAttributes = async (
	props: Record<string, unknown>
): Promise<string[]> => {
	document.body.innerHTML = '<div id="app"></div>';
	const app = await createApp(componentWith(props)).mount('#app');
	await flushRenderer();
	const names = (
		document.querySelector('#target')?.getAttributeNames() ?? []
	).sort();
	await app.unmount();
	return names;
};

describe('props that must not become DOM attributes', () => {
	beforeEach(() => {
		document.body.innerHTML = '<div id="app"></div>';
	});

	afterEach(() => {
		document.body.replaceChildren();
	});

	it('omits key on both sides', async () => {
		const props = { key: 'item-1' };
		await expect(serverAttributes(props)).resolves.toEqual(['id']);
		await expect(clientAttributes(props)).resolves.toEqual(['id']);
	});

	it('omits underscore-prefixed props on both sides', async () => {
		const props = { _internal: 'x' };
		await expect(serverAttributes(props)).resolves.toEqual(['id']);
		await expect(clientAttributes(props)).resolves.toEqual(['id']);
	});

	it('omits refs on both sides', async () => {
		const props = { ref: createRef() };
		await expect(serverAttributes(props)).resolves.toEqual(['id']);
		await expect(clientAttributes(props)).resolves.toEqual(['id']);
	});

	it('omits event handlers on both sides', async () => {
		const props = { onClick: vi.fn() };
		await expect(serverAttributes(props)).resolves.toEqual(['id']);
		await expect(clientAttributes(props)).resolves.toEqual(['id']);
	});

	it('keeps ordinary data and aria props on both sides', async () => {
		const props = { 'data-role': 'row', 'aria-label': 'Row' };
		const expected = ['aria-label', 'data-role', 'id'];
		await expect(serverAttributes(props)).resolves.toEqual(expected);
		await expect(clientAttributes(props)).resolves.toEqual(expected);
	});

	it('agrees between server and client for a mixed prop set', async () => {
		const props = {
			key: 'item-1',
			_internal: 'x',
			ref: createRef(),
			onClick: vi.fn(),
			'data-role': 'row',
			title: 'Row',
		};

		const fromServer = await serverAttributes(props);
		const fromClient = await clientAttributes(props);

		expect(fromClient).toEqual(fromServer);
		expect(fromServer).toEqual(['data-role', 'id', 'title']);
	});
});
