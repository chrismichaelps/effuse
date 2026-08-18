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
import { isEventHandlerName } from '../../render/event-prop.js';
import {
	CreateElementNode,
	EFFUSE_NODE,
	type Component,
} from '../../render/node.js';

const flushRenderer = async (): Promise<void> => {
	for (let index = 0; index < 8; index++) await Promise.resolve();
};

const node = (props: Record<string, unknown>) =>
	CreateElementNode({
		[EFFUSE_NODE]: true,
		tag: 'div',
		props: { id: 'target', ...props },
		children: ['x'] as never,
	});

/** Whether the server writes `key` when its value is a reactive getter. */
const serverWrites = async (key: string): Promise<boolean> => {
	const runtime = await createSSRRuntime([]);
	try {
		const html = renderToFragment(node({ [key]: () => 'V' }) as never, runtime);
		return html.includes(`${key}="V"`);
	} finally {
		await runtime.dispose();
	}
};

/** Whether the client writes `key` for the same node. */
const clientWrites = async (key: string): Promise<boolean> => {
	const App = define({
		script: () => ({}),
		template: () => node({ [key]: () => 'V' }),
	}) as unknown as Component;

	const app = await createApp(App).mount('#app');
	await flushRenderer();
	const written = document.querySelector('#target')?.getAttribute(key) === 'V';
	await app.unmount();
	return written;
};

/**
 * Names the shared rule treats as ordinary props, alongside the handler and
 * the plain attribute that bracket them.
 */
const ORDINARY = ['title', 'once', 'online', 'onboarded', 'on-click', 'on'];

describe('event-handler rule across the render boundary', () => {
	beforeEach(() => {
		document.body.replaceChildren();
		const host = document.createElement('div');
		host.id = 'app';
		document.body.append(host);
	});

	afterEach(() => {
		document.body.replaceChildren();
	});

	it.each(ORDINARY)('server and client agree on %s', async (key) => {
		// The server tested `key.startsWith('on')` while the client used the
		// shared helper, so every one of these rendered on the client only.
		expect(isEventHandlerName(key)).toBe(false);
		expect(await serverWrites(key)).toBe(true);
		expect(await clientWrites(key)).toBe(true);
	});

	it('still drops a real handler on both sides', async () => {
		expect(isEventHandlerName('onClick')).toBe(true);
		expect(await serverWrites('onClick')).toBe(false);
		expect(await clientWrites('onClick')).toBe(false);
	});

	it('does not register a listener for an ordinary on-prefixed prop', async () => {
		// `on-click` is the name the shared rule was written for: treating it as
		// a handler once bound a listener for an event called `-click`.
		const App = define({
			script: () => ({}),
			template: () => node({ 'on-click': () => 'V' }),
		}) as unknown as Component;

		const app = await createApp(App).mount('#app');
		await flushRenderer();
		const element = document.querySelector('#target') as HTMLElement;
		let fired = false;
		element.addEventListener('-click', () => {
			fired = true;
		});
		element.dispatchEvent(new Event('-click'));
		await app.unmount();

		expect(fired).toBe(true);
		expect(element.getAttribute('on-click')).toBe('V');
	});

	it('leaves a non-function on-prefixed value alone on both sides', async () => {
		const runtime = await createSSRRuntime([]);
		const html = renderToFragment(node({ once: 'plain' }) as never, runtime);
		await runtime.dispose();

		expect(html).toContain('once="plain"');
	});
});
