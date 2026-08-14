// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../../app/createApp.js';
import { define } from '../../blueprint/define.js';
import { signal } from '../../reactivity/signal.js';
import {
	CreateElementNode,
	CreateFragmentNode,
	EFFUSE_NODE,
	type Component,
	type EffuseChild,
} from '../../render/node.js';
import { renderToFragment } from '../../ssr/render.js';
import { createSSRRuntime } from '../../ssr/runtime.js';

const element = (
	tag: string,
	props: Record<string, unknown>,
	children: EffuseChild[] = []
) => CreateElementNode({ [EFFUSE_NODE]: true, tag, props, children });

const form = (htmlFor: unknown): EffuseChild =>
	CreateFragmentNode({
		[EFFUSE_NODE]: true,
		children: [
			element('label', { htmlFor, 'data-testid': 'label' }, ['Name']),
			element('input', { id: 'name-field', 'data-testid': 'input' }),
		],
	});

const app = (child: EffuseChild): Component =>
	define({ script: () => ({}), template: () => child }) as Component;

const flushRenderer = async (): Promise<void> => {
	for (let index = 0; index < 6; index++) await Promise.resolve();
};

const expectValidAssociation = (
	label: HTMLLabelElement,
	value: string
): void => {
	expect(label.htmlFor).toBe(value);
	expect(label.getAttribute('for')).toBe(value);
	expect(label.hasAttribute('htmlfor')).toBe(false);
	expect(label.hasAttribute('html-for')).toBe(false);
};

describe('htmlFor DOM attribute normalization (issue #489)', () => {
	let mounted: { unmount: () => Promise<void> } | undefined;

	beforeEach(() => {
		document.body.innerHTML = '<div id="app"></div>';
	});

	afterEach(async () => {
		await mounted?.unmount();
		mounted = undefined;
		document.body.innerHTML = '';
	});

	it('normalizes static, signal, and compiler-getter values on the client', async () => {
		const value = signal('name-field');
		for (const source of ['name-field', value, () => value.value]) {
			mounted = await createApp(app(form(source))).mount('#app');
			await flushRenderer();
			const label = document.querySelector('label') as HTMLLabelElement;
			expectValidAssociation(label, 'name-field');

			if (source !== 'name-field') {
				value.value = 'updated-field';
				await flushRenderer();
				expectValidAssociation(label, 'updated-field');
				value.value = 'name-field';
			}

			await mounted.unmount();
			mounted = undefined;
			document.querySelector('#app')?.replaceChildren();
		}
	});

	it('serializes every supported value source as the native for attribute', async () => {
		const runtime = await createSSRRuntime([]);
		try {
			for (const source of [
				'name-field',
				signal('name-field'),
				() => 'name-field',
			]) {
				const html = runtime.run(() =>
					renderToFragment(form(source) as never, runtime)
				);
				expect(html).toContain('<label for="name-field"');
				expect(html).not.toContain('htmlfor');
				expect(html).not.toContain('html-for');
			}
		} finally {
			await runtime.dispose();
		}
	});

	it('preserves the server label and association during hydration', async () => {
		const runtime = await createSSRRuntime([]);
		let html: string;
		try {
			html = runtime.run(() =>
				renderToFragment(form('name-field') as never, runtime)
			);
		} finally {
			await runtime.dispose();
		}
		document.body.innerHTML = `<div id="app">${html}</div>`;
		const serverLabel = document.querySelector('label') as HTMLLabelElement;

		mounted = await createApp(app(form('name-field'))).hydrate('#app');
		await flushRenderer();

		const label = document.querySelector('label') as HTMLLabelElement;
		expect(label).toBe(serverLabel);
		expectValidAssociation(label, 'name-field');
		expect(label.control).toBe(document.querySelector('#name-field'));
	});
});
