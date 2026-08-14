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

const flushRenderer = async (): Promise<void> => {
	for (let index = 0; index < 6; index++) await Promise.resolve();
};

const componentWithProp = (name: string, value: unknown): Component =>
	define({
		script: () => ({}),
		template: () =>
			CreateElementNode({
				[EFFUSE_NODE]: true,
				tag: 'div',
				props: { id: 'target', [name]: value },
				children: ['x'] as never,
			}),
	}) as unknown as Component;

/** The attribute value after mounting, or null when none was applied. */
const attributeFor = async (name: string): Promise<string | null> => {
	document.body.replaceChildren();
	const host = document.createElement('div');
	host.id = 'app';
	document.body.append(host);

	const app = await createApp(componentWithProp(name, 'plain')).mount('#app');
	await flushRenderer();
	const value = document.querySelector('#target')?.getAttribute(name) ?? null;
	await app.unmount();
	return value;
};

/**
 * A prefix alone does not make an event handler; the next character has to
 * start a new word. `toUpperCase()` leaves digits, `-`, `_` and `$` unchanged,
 * so a check for "unchanged by toUpperCase" accepts all of them.
 */
const ORDINARY_PROPS: readonly string[] = [
	'on-click',
	'on1',
	'on_foo',
	'once',
	'online',
	'onboarded',
	'ontology',
	'onlyAdmins',
	'title',
	'data-value',
	'aria-label',
];

/**
 * Function values take a different branch in `mount.ts` than other values, and
 * that branch is where the rule was loosest, so each name is checked with a
 * function too.
 */
const EVENT_PROPS: readonly string[] = [
	'onClick',
	'onInput',
	'onKeyDown',
	'onDoubleClick',
];

describe('event handler prop boundary', () => {
	beforeEach(() => {
		document.body.replaceChildren();
	});

	afterEach(() => {
		document.body.replaceChildren();
	});

	for (const name of ORDINARY_PROPS) {
		it(`applies ${name} as an attribute`, async () => {
			await expect(attributeFor(name)).resolves.toBe('plain');
		});
	}

	for (const name of EVENT_PROPS) {
		it(`does not apply ${name} as an attribute`, async () => {
			await expect(attributeFor(name)).resolves.toBeNull();
		});
	}

	it('does not bind a listener for a near-miss name holding a function', async () => {
		// `once`, `online` and `onboarded` are ordinary props. Slicing the prefix
		// blindly produced listeners for `ce`, `line` and `boarded`.
		for (const [name, event] of [
			['once', 'ce'],
			['online', 'line'],
			['onboarded', 'boarded'],
			['on-click', '-click'],
		] as const) {
			document.body.replaceChildren();
			const host = document.createElement('div');
			host.id = 'app';
			document.body.append(host);

			const handler = vi.fn();
			const app = await createApp(componentWithProp(name, handler)).mount(
				'#app'
			);
			await flushRenderer();
			// A zero-argument function is the compiler's getter convention, so an
			// ordinary prop may legitimately call it once while rendering. What
			// must not happen is a listener firing on a spliced event name.
			handler.mockClear();

			document
				.querySelector('#target')
				?.dispatchEvent(new Event(event, { bubbles: true }));

			expect(
				handler,
				`${name} bound a listener for ${event}`
			).not.toHaveBeenCalled();
			await app.unmount();
		}
	});

	it('binds a real handler to its event', async () => {
		const clicked = vi.fn();
		document.body.replaceChildren();
		const host = document.createElement('div');
		host.id = 'app';
		document.body.append(host);

		const app = await createApp(componentWithProp('onClick', clicked)).mount(
			'#app'
		);
		await flushRenderer();
		document.querySelector<HTMLElement>('#target')?.click();

		expect(clicked).toHaveBeenCalledTimes(1);
		await app.unmount();
	});

	it('does not register a listener for a hyphenated prop', async () => {
		const handler = vi.fn();
		document.body.replaceChildren();
		const host = document.createElement('div');
		host.id = 'app';
		document.body.append(host);

		const app = await createApp(componentWithProp('on-click', handler)).mount(
			'#app'
		);
		await flushRenderer();
		handler.mockClear();

		// Whatever `on-click` means, it is not an event named `-click`.
		document
			.querySelector('#target')
			?.dispatchEvent(new Event('-click', { bubbles: true }));

		expect(handler).not.toHaveBeenCalled();
		await app.unmount();
	});
});
