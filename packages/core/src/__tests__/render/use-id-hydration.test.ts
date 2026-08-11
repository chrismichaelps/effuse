// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../../app/createApp.js';
import { define } from '../../blueprint/define.js';
import { useId } from '../../hooks/useId.js';
import {
	CreateBlueprintNode,
	CreateElementNode,
	EFFUSE_NODE,
	type Component,
} from '../../render/node.js';
import { render } from '../../render/index.js';
import { createSSRRuntime } from '../../ssr/runtime.js';
import { renderToFragment } from '../../ssr/render.js';

const flushRenderer = async (): Promise<void> => {
	await Promise.resolve();
	await Promise.resolve();
	await Promise.resolve();
	await Promise.resolve();
};

const element = (
	tag: string,
	props: Record<string, unknown>,
	children: unknown[] = []
) =>
	CreateElementNode({
		[EFFUSE_NODE]: true,
		tag,
		props,
		children: children as never,
	});

const child = (blueprint: Component) =>
	CreateBlueprintNode({
		[EFFUSE_NODE]: true,
		blueprint,
		props: {},
		portals: null,
	});

const Field = define({
	name: 'IdField',
	script: () => ({ id: useId() }),
	template: ({ id }) =>
		element('div', {}, [
			element('label', { for: id }, ['Name']),
			element('input', { id, 'data-field': true }),
		]),
});

const Page = define({
	name: 'IdPage',
	script: () => ({ headingId: useId() }),
	template: ({ headingId }) =>
		element('main', { 'aria-labelledby': headingId }, [
			element('h1', { id: headingId }, ['Profile']),
			child(Field as Component),
		]),
});

const renderServerMarkup = async (): Promise<string> => {
	const runtime = await createSSRRuntime([]);
	try {
		return runtime.run(() => renderToFragment(Page as Component, runtime));
	} finally {
		await runtime.dispose();
	}
};

describe('client useId render ownership (issue #488)', () => {
	const mounted: Array<{ unmount: () => Promise<void> }> = [];
	const renderCleanups: Array<() => void> = [];

	beforeEach(() => {
		document.body.innerHTML = '';
	});

	afterEach(async () => {
		for (const cleanup of renderCleanups.splice(0)) cleanup();
		await Promise.all(mounted.splice(0).map((app) => app.unmount()));
		document.body.innerHTML = '';
	});

	it('hydrates with the same ids after unrelated client id allocation', async () => {
		const markup = await renderServerMarkup();
		document.body.innerHTML = `<div id="app">${markup}</div>`;
		const serverHeading = document.querySelector('h1');
		const serverInput = document.querySelector('input');

		useId();
		mounted.push(await createApp(Page as Component).hydrate('#app'));
		await flushRenderer();

		expect(document.querySelector('h1')).toBe(serverHeading);
		expect(document.querySelector('input')).toBe(serverInput);
		expect(serverHeading?.id).toBe(':e1');
		expect(serverInput?.id).toBe(':e2');
		expect(
			document.querySelector('main')?.getAttribute('aria-labelledby')
		).toBe(':e1');
		expect(document.querySelector('label')?.getAttribute('for')).toBe(':e2');
	});

	it('restarts the sequence for independent client roots', async () => {
		document.body.innerHTML = '<div id="first"></div><div id="second"></div>';

		mounted.push(await createApp(Page as Component).mount('#first'));
		mounted.push(await createApp(Page as Component).mount('#second'));
		await flushRenderer();

		for (const selector of ['#first', '#second']) {
			expect(document.querySelector(`${selector} h1`)?.id).toBe(':e1');
			expect(document.querySelector(`${selector} input`)?.id).toBe(':e2');
		}
	});

	it('owns ids when using the public render API directly', async () => {
		document.body.innerHTML = '<div id="first"></div><div id="second"></div>';
		const first = document.querySelector('#first');
		const second = document.querySelector('#second');
		if (!first || !second) throw new Error('Test containers are missing.');

		renderCleanups.push(render(child(Page as Component), first));
		renderCleanups.push(render(child(Page as Component), second));
		await flushRenderer();

		expect(first.querySelector('h1')?.id).toBe(':e1');
		expect(first.querySelector('input')?.id).toBe(':e2');
		expect(second.querySelector('h1')?.id).toBe(':e1');
		expect(second.querySelector('input')?.id).toBe(':e2');
	});
});
