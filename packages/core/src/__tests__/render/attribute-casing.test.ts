// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../../app/createApp.js';
import { define } from '../../blueprint/define.js';
import { signal } from '../../reactivity/signal.js';
import {
	CreateBlueprintNode,
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

const component = (blueprint: Component): EffuseChild =>
	CreateBlueprintNode({
		[EFFUSE_NODE]: true,
		blueprint,
		props: {},
		portals: null,
	});

const app = (child: EffuseChild): Component =>
	define({ script: () => ({}), template: () => child }) as Component;

const flushRenderer = async (): Promise<void> => {
	for (let index = 0; index < 6; index++) await Promise.resolve();
};

const svgTree = (): EffuseChild => {
	const Path = define({
		script: () => ({}),
		template: () =>
			element('path', {
				d: 'M0 0h10',
				strokeWidth: 2,
				pathLength: 10,
			}),
	}) as Component;
	return element(
		'svg',
		{ viewBox: '0 0 24 24', preserveAspectRatio: 'xMidYMid meet' },
		[
			component(Path),
			element('foreignObject', {}, [
				element('div', { tabIndex: 3, inputMode: 'numeric' }, ['HTML']),
			]),
		]
	);
};

describe('DOM attribute casing across renderers (issue #497)', () => {
	let mounted: { unmount: () => Promise<void> } | undefined;

	beforeEach(() => {
		document.body.innerHTML = '<div id="app"></div>';
	});

	afterEach(async () => {
		await mounted?.unmount();
		mounted = undefined;
		document.body.innerHTML = '';
	});

	it('uses native HTML names for static, signal, and getter values', async () => {
		const tabIndex = signal(2);
		mounted = await createApp(
			app(
				CreateFragmentNode({
					[EFFUSE_NODE]: true,
					children: [
						element('input', {
							tabIndex,
							inputMode: () => 'numeric',
							autoComplete: 'email',
						}),
						element('form', { acceptCharset: 'utf-8' }),
						element('meta', { httpEquiv: 'refresh' }),
					],
				})
			)
		).mount('#app');
		await flushRenderer();

		const input = document.querySelector('input') as HTMLInputElement;
		expect(input.getAttribute('tabindex')).toBe('2');
		expect(input.getAttribute('inputmode')).toBe('numeric');
		expect(input.getAttribute('autocomplete')).toBe('email');
		expect(input.hasAttribute('tab-index')).toBe(false);
		expect(document.querySelector('form')?.getAttribute('accept-charset')).toBe(
			'utf-8'
		);
		expect(document.querySelector('meta')?.getAttribute('http-equiv')).toBe(
			'refresh'
		);

		tabIndex.value = 4;
		await flushRenderer();
		expect(input.tabIndex).toBe(4);
	});

	it('serializes native HTML and case-sensitive SVG names through components', async () => {
		const runtime = await createSSRRuntime([]);
		try {
			const html = runtime.run(() =>
				renderToFragment(
					CreateFragmentNode({
						[EFFUSE_NODE]: true,
						children: [
							element('input', {
								tabIndex: 2,
								inputMode: 'numeric',
								autoComplete: 'email',
							}),
							svgTree(),
						],
					}) as never,
					runtime
				)
			);

			expect(html).toContain(
				'<input tabindex="2" inputmode="numeric" autocomplete="email">'
			);
			expect(html).toContain(
				'<svg viewBox="0 0 24 24" preserveAspectRatio="xMidYMid meet">'
			);
			expect(html).toContain(
				'<path d="M0 0h10" stroke-width="2" pathLength="10"></path>'
			);
			expect(html).toContain(
				'<foreignObject><div tabindex="3" inputmode="numeric">HTML</div>'
			);
			expect(html).not.toContain('tab-index');
			expect(html).not.toContain('view-box');
		} finally {
			await runtime.dispose();
		}
	});

	it('preserves parsed SVG namespaces and attributes during hydration', async () => {
		const runtime = await createSSRRuntime([]);
		let html: string;
		try {
			html = runtime.run(() => renderToFragment(svgTree() as never, runtime));
		} finally {
			await runtime.dispose();
		}
		document.body.innerHTML = `<div id="app">${html}</div>`;
		const serverSvg = document.querySelector('svg');
		const serverPath = document.querySelector('path');

		mounted = await createApp(app(svgTree())).hydrate('#app');
		await flushRenderer();

		const svg = document.querySelector('svg');
		const path = document.querySelector('path');
		expect(svg).toBe(serverSvg);
		expect(path).toBe(serverPath);
		expect(svg?.namespaceURI).toBe('http://www.w3.org/2000/svg');
		expect(svg?.getAttribute('viewBox')).toBe('0 0 24 24');
		expect(path?.getAttribute('stroke-width')).toBe('2');
		expect(path?.getAttribute('pathLength')).toBe('10');
		expect(
			document.querySelector('foreignObject div')?.getAttribute('tabindex')
		).toBe('3');
	});
});
