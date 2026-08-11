// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createApp } from '../../app/createApp.js';
import { define } from '../../blueprint/define.js';
import { Portal, type PortalProps } from '../../blueprint/portal.js';
import {
	CreateBlueprintNode,
	CreateElementNode,
	EFFUSE_NODE,
	type Component,
	type EffuseChild,
} from '../../render/node.js';

const element = (
	tag: string,
	props: Record<string, unknown>,
	children: EffuseChild[] = []
): EffuseChild => CreateElementNode({ [EFFUSE_NODE]: true, tag, props, children });

const portalNode = (props: PortalProps): EffuseChild =>
	CreateBlueprintNode({
		[EFFUSE_NODE]: true,
		blueprint: Portal as unknown as Component,
		props: props as unknown as Record<string, unknown>,
		portals: null,
	});

const portalApp = (props: PortalProps): Component =>
	define({ script: () => ({}), template: () => portalNode(props) }) as Component;

const content = (owner: string): EffuseChild =>
	element('span', { 'data-owner': owner }, [owner]);

const flushRenderer = async (): Promise<void> => {
	for (let index = 0; index < 8; index++) await Promise.resolve();
};

describe('Portal ownership (issue #507)', () => {
	const mounted: Array<{ unmount: () => Promise<void> }> = [];

	beforeEach(() => {
		document.body.innerHTML = [
			'<div id="app-1"></div>',
			'<div id="app-2"></div>',
			'<div id="app-3"></div>',
			'<div id="target"></div>',
		].join('');
	});

	afterEach(async () => {
		for (const app of mounted.splice(0).reverse()) await app.unmount();
		document.body.innerHTML = '';
		vi.restoreAllMocks();
	});

	it('transfers a key without allowing stale teardown to remove its successor', async () => {
		const unmounts = [vi.fn(), vi.fn(), vi.fn()];
		const first = await createApp(
			portalApp({
				target: '#target',
				key: 'shared',
				children: content('first'),
				onUnmount: unmounts[0],
			})
		).mount('#app-1');
		mounted.push(first);
		await flushRenderer();

		const second = await createApp(
			portalApp({
				target: '#target',
				key: 'shared',
				children: content('second'),
				onUnmount: unmounts[1],
			})
		).mount('#app-2');
		mounted.push(second);
		await flushRenderer();

		expect(document.querySelectorAll('#target [data-portal]')).toHaveLength(1);
		expect(document.querySelector('#target [data-owner]')?.textContent).toBe(
			'second'
		);
		expect(unmounts[0]).toHaveBeenCalledOnce();

		await first.unmount();
		expect(document.querySelector('#target [data-owner]')?.textContent).toBe(
			'second'
		);
		expect(unmounts[0]).toHaveBeenCalledOnce();

		const third = await createApp(
			portalApp({
				target: '#target',
				key: 'shared',
				children: content('third'),
				onUnmount: unmounts[2],
			})
		).mount('#app-3');
		mounted.push(third);
		await flushRenderer();

		expect(document.querySelectorAll('#target [data-portal]')).toHaveLength(1);
		expect(document.querySelector('#target [data-owner]')?.textContent).toBe(
			'third'
		);
		expect(unmounts[1]).toHaveBeenCalledOnce();

		await second.unmount();
		expect(document.querySelector('#target [data-owner]')?.textContent).toBe(
			'third'
		);
		expect(unmounts[1]).toHaveBeenCalledOnce();
	});

	it('disposes Effuse-owned portals before replacing target contents', async () => {
		const firstUnmount = vi.fn();
		const first = await createApp(
			portalApp({
				target: '#target',
				key: 'first-key',
				children: content('first'),
				onUnmount: firstUnmount,
			})
		).mount('#app-1');
		mounted.push(first);
		await flushRenderer();

		const replacement = await createApp(
			portalApp({
				target: '#target',
				key: 'replacement-key',
				insertMode: 'replace',
				children: content('replacement'),
			})
		).mount('#app-2');
		mounted.push(replacement);
		await flushRenderer();

		expect(firstUnmount).toHaveBeenCalledOnce();
		expect(document.querySelectorAll('#target [data-portal]')).toHaveLength(1);
		expect(document.querySelector('#target [data-owner]')?.textContent).toBe(
			'replacement'
		);

		await first.unmount();
		expect(firstUnmount).toHaveBeenCalledOnce();
		expect(document.querySelector('#target [data-owner]')?.textContent).toBe(
			'replacement'
		);
	});

	it('keeps disabled and missing-target portals inert', async () => {
		const onMount = vi.fn();
		const onUnmount = vi.fn();
		mounted.push(
			await createApp(
				portalApp({
					target: '#target',
					disabled: true,
					children: content('disabled'),
					onMount,
					onUnmount,
				})
			).mount('#app-1')
		);
		mounted.push(
			await createApp(
				portalApp({
					target: '#missing',
					children: content('missing'),
					onMount,
					onUnmount,
				})
			).mount('#app-2')
		);
		await flushRenderer();

		expect(document.querySelector('#target [data-portal]')).toBeNull();
		expect(onMount).not.toHaveBeenCalled();
		expect(onUnmount).not.toHaveBeenCalled();
	});

	it('rolls back ownership when the portal onMount callback fails', async () => {
		const failure = new Error('portal mount failed');
		const onUnmount = vi.fn();
		const reported = vi.spyOn(console, 'error').mockImplementation(() => {});
		const app = await createApp(
			portalApp({
				target: '#target',
				key: 'failing',
				children: content('partial'),
				onMount: () => {
					throw failure;
				},
				onUnmount,
			})
		).mount('#app-1');
		mounted.push(app);
		await flushRenderer();

		expect(document.querySelector('#target [data-portal]')).toBeNull();
		expect(onUnmount).toHaveBeenCalledOnce();
		expect(reported).toHaveBeenCalledOnce();

		await app.unmount();
		expect(onUnmount).toHaveBeenCalledOnce();
		reported.mockRestore();
	});
});
