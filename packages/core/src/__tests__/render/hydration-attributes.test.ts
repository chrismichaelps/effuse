// @vitest-environment jsdom
/**
 * MIT License
 *
 * Copyright (c) 2025 Chris M. Perez
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createApp } from '../../app/createApp.js';
import { define } from '../../blueprint/define.js';
import {
	EFFUSE_NODE,
	CreateElementNode,
	type Component,
} from '../../render/node.js';
import { renderToFragment } from '../../ssr/render.js';
import { createSSRRuntime } from '../../ssr/runtime.js';
import { serializeHydrationData } from '../../ssr/hydration.js';

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

const renderServerMarkup = async (root: Component): Promise<string> => {
	const runtime = await createSSRRuntime([]);
	try {
		return runtime.run(() => renderToFragment(root, runtime));
	} finally {
		await runtime.dispose();
	}
};

/** Seeds `#app` with `serverRoot`'s markup, then hydrates `clientRoot` into it. */
const hydrateOver = async (
	serverRoot: Component,
	clientRoot: Component
): Promise<{ unmount: () => Promise<void> }> => {
	const markup = await renderServerMarkup(serverRoot);
	document.body.innerHTML =
		`<div id="app">${markup}</div>` +
		serializeHydrationData({ head: {}, state: {}, url: '/', timestamp: 0 });
	const app = await createApp(clientRoot).mount('#app', { hydrate: true });
	await flushRenderer();
	return app;
};

const attributesOf = (element: Element | null): Record<string, string> => {
	const result: Record<string, string> = {};
	for (const attribute of Array.from(element?.attributes ?? [])) {
		result[attribute.name] = attribute.value;
	}
	return result;
};

describe('hydration reconciles element attributes', () => {
	let mounted: { unmount: () => Promise<void> } | null = null;

	beforeEach(() => {
		document.body.innerHTML = '<div id="app"></div>';
		mounted = null;
	});

	afterEach(async () => {
		await mounted?.unmount();
		mounted = null;
		document.body.replaceChildren();
	});

	it('drops server attributes the client render does not produce', async () => {
		const Server = define({
			script: () => ({}),
			template: () =>
				el('div', { id: 'box', 'data-stale': 'yes', title: 'server' }, ['x']),
		});
		const Client = define({
			script: () => ({}),
			template: () => el('div', { id: 'box' }, ['x']),
		});

		mounted = await hydrateOver(Server as Component, Client as Component);

		expect(attributesOf(document.querySelector('#box'))).toEqual({ id: 'box' });
	});

	it('re-enables a control the server rendered as disabled', async () => {
		const Server = define({
			script: () => ({}),
			template: () =>
				el('button', { id: 'b', disabled: true, 'aria-hidden': 'true' }, [
					'Save',
				]),
		});
		const Client = define({
			script: () => ({}),
			template: () => el('button', { id: 'b' }, ['Save']),
		});

		mounted = await hydrateOver(Server as Component, Client as Component);

		const button = document.querySelector<HTMLButtonElement>('#b');
		expect(button?.disabled).toBe(false);
		expect(button?.getAttribute('aria-hidden')).toBeNull();
	});

	it('matches a plain client mount of the same component', async () => {
		const Server = define({
			script: () => ({}),
			template: () =>
				el('div', { id: 'box', class: 'a b', 'data-old': '1', hidden: true }, [
					'x',
				]),
		});
		const Client = define({
			script: () => ({}),
			template: () => el('div', { id: 'box', class: 'a' }, ['x']),
		});

		mounted = await hydrateOver(Server as Component, Client as Component);
		const hydratedAttributes = attributesOf(document.querySelector('#box'));

		document.body.innerHTML = '<div id="fresh"></div>';
		const fresh = await createApp(Client as Component).mount('#fresh');
		await flushRenderer();
		const freshAttributes = attributesOf(document.querySelector('#box'));
		await fresh.unmount();
		mounted = null;

		expect(hydratedAttributes).toEqual(freshAttributes);
	});

	it('keeps client values for attributes both passes declare', async () => {
		const Server = define({
			script: () => ({}),
			template: () => el('div', { id: 'box', title: 'server' }, ['x']),
		});
		const Client = define({
			script: () => ({}),
			template: () => el('div', { id: 'box', title: 'client' }, ['x']),
		});

		mounted = await hydrateOver(Server as Component, Client as Component);

		expect(document.querySelector('#box')?.getAttribute('title')).toBe(
			'client'
		);
	});

	it('leaves event handlers and refs bound on the adopted element', async () => {
		const clicked = vi.fn();
		const Server = define({
			script: () => ({}),
			template: () => el('button', { id: 'b', 'data-stale': 'yes' }, ['Go']),
		});
		const Client = define({
			script: () => ({}),
			template: () => el('button', { id: 'b', onClick: clicked }, ['Go']),
		});

		mounted = await hydrateOver(Server as Component, Client as Component);

		const button = document.querySelector<HTMLButtonElement>('#b');
		expect(button?.hasAttribute('data-stale')).toBe(false);
		expect(button?.hasAttribute('onClick')).toBe(false);
		button?.click();
		expect(clicked).toHaveBeenCalledTimes(1);
	});

	it('keeps the adopted node rather than replacing it', async () => {
		const Server = define({
			script: () => ({}),
			template: () => el('div', { id: 'box', 'data-stale': 'yes' }, ['x']),
		});
		const Client = define({
			script: () => ({}),
			template: () => el('div', { id: 'box' }, ['x']),
		});

		const markup = await renderServerMarkup(Server as Component);
		document.body.innerHTML =
			`<div id="app">${markup}</div>` +
			serializeHydrationData({ head: {}, state: {}, url: '/', timestamp: 0 });
		const serverNode = document.querySelector('#box');

		mounted = await createApp(Client as Component).mount('#app', {
			hydrate: true,
		});
		await flushRenderer();

		expect(document.querySelector('#box')).toBe(serverNode);
	});
});
