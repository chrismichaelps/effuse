// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../../app/createApp.js';
import { define } from '../../blueprint/define.js';
import { signal } from '../../reactivity/signal.js';
import {
	CreateBlueprintNode,
	CreateElementNode,
	CreateFragmentNode,
	CreateListNode,
	EFFUSE_NODE,
	type Component,
	type EffuseChild,
} from '../../render/node.js';

const SVG_NAMESPACE = 'http://www.w3.org/2000/svg';
const HTML_NAMESPACE = 'http://www.w3.org/1999/xhtml';
const MATHML_NAMESPACE = 'http://www.w3.org/1998/Math/MathML';

const element = (
	tag: string,
	props: Record<string, unknown> = {},
	children: EffuseChild[] = []
) => CreateElementNode({ [EFFUSE_NODE]: true, tag, props, children });

const app = (child: EffuseChild): Component =>
	define({ script: () => ({}), template: () => child }) as Component;

const component = (blueprint: Component): EffuseChild =>
	CreateBlueprintNode({
		[EFFUSE_NODE]: true,
		blueprint,
		props: {},
		portals: null,
	});

const flushRenderer = async (): Promise<void> => {
	for (let index = 0; index < 8; index++) await Promise.resolve();
};

describe('client DOM namespace ownership (issue #498)', () => {
	const mounted: Array<{ unmount: () => Promise<void> }> = [];

	beforeEach(() => {
		document.body.innerHTML = '<div id="app"></div>';
	});

	afterEach(async () => {
		for (const instance of mounted.splice(0)) await instance.unmount();
		document.body.innerHTML = '';
	});

	it('inherits SVG across every existing composition path and deferred update', async () => {
		const dynamicShape = signal<EffuseChild>(element('polygon', { points: '0,0' }));
		const Path = define({
			script: () => ({}),
			template: () => element('path', { strokeWidth: 2, pathLength: 10 }),
		}) as Component;
		const tree = element('svg', { viewBox: '0 0 24 24' }, [
			component(Path),
			CreateFragmentNode({
				[EFFUSE_NODE]: true,
				children: [element('circle', { cx: 4 })],
			}),
			CreateListNode({
				[EFFUSE_NODE]: true,
				children: [element('rect', { width: 3 })],
			}),
			() => element('line', { x1: 0, x2: 2 }),
			dynamicShape,
			element('foreignObject', {}, [element('div', {}, ['HTML'])]),
		]);

		mounted.push(await createApp(app(tree)).mount('#app'));
		await flushRenderer();

		for (const tag of ['svg', 'path', 'circle', 'rect', 'line', 'polygon']) {
			expect(document.querySelector(tag)?.namespaceURI, tag).toBe(SVG_NAMESPACE);
		}
		expect(document.querySelector('svg')?.getAttribute('viewBox')).toBe(
			'0 0 24 24'
		);
		expect(document.querySelector('path')?.getAttribute('stroke-width')).toBe('2');
		expect(document.querySelector('path')?.getAttribute('pathLength')).toBe('10');
		expect(document.querySelector('foreignObject div')?.namespaceURI).toBe(
			HTML_NAMESPACE
		);

		dynamicShape.value = element('polyline', { points: '0,0 1,1' });
		await flushRenderer();
		expect(document.querySelector('polygon')).toBeNull();
		expect(document.querySelector('polyline')?.namespaceURI).toBe(SVG_NAMESPACE);
	});

	it('inherits the namespace of an existing SVG mount container', async () => {
		document.body.innerHTML = '<svg id="app"></svg>';
		mounted.push(await createApp(app(element('circle', { r: 5 }))).mount('#app'));
		await flushRenderer();

		expect(document.querySelector('circle')?.namespaceURI).toBe(SVG_NAMESPACE);
	});

	it('creates declared MathML roots and descendants in the MathML namespace', async () => {
		mounted.push(
			await createApp(app(element('math', {}, [element('mi', {}, ['x'])]))).mount(
				'#app'
			)
		);
		await flushRenderer();

		expect(document.querySelector('math')?.namespaceURI).toBe(MATHML_NAMESPACE);
		expect(document.querySelector('mi')?.namespaceURI).toBe(MATHML_NAMESPACE);
	});

	it('repairs a same-tag hydration candidate from the wrong namespace', async () => {
		const host = document.querySelector('#app') as HTMLDivElement;
		const stale = document.createElementNS(HTML_NAMESPACE, 'svg');
		host.append(stale);

		mounted.push(await createApp(app(element('svg'))).hydrate('#app'));
		await flushRenderer();

		const hydrated = document.querySelector('svg');
		expect(hydrated).not.toBe(stale);
		expect(hydrated?.namespaceURI).toBe(SVG_NAMESPACE);
		expect(stale.isConnected).toBe(false);
	});
});
