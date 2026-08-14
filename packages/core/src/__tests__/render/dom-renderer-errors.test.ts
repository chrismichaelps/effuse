// @vitest-environment jsdom
/**
 * MIT License
 *
 * Copyright (c) 2025 Chris M. Perez
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../../app/createApp.js';
import { define } from '../../blueprint/define.js';
import {
	CreateBlueprintNode,
	CreateElementNode,
	CreateListNode,
	EFFUSE_NODE,
	type EffuseChild,
} from '../../render/node.js';
import { signal } from '../../reactivity/signal.js';

const flushRenderer = async (): Promise<void> => {
	await Promise.resolve();
	await Promise.resolve();
	await Promise.resolve();
};

describe('DOM renderer error diagnostics', () => {
	let mounted: { unmount: () => Promise<void> } | null = null;

	beforeEach(() => {
		document.body.innerHTML = '<div id="app"></div>';
		mounted = null;
	});

	afterEach(async () => {
		if (mounted) {
			await mounted.unmount();
		}
		document.body.innerHTML = '';
	});

	it('renders diagnostics when a signal child fails to mount', async () => {
		const child = signal<EffuseChild>('Ready');
		const BrokenChild = define({
			script: () => {
				throw new Error('broken signal child');
			},
			template: () => 'unreachable',
		});
		const App = define({
			script: () => ({}),
			template: () =>
				CreateElementNode({
					[EFFUSE_NODE]: true,
					tag: 'section',
					props: { 'data-testid': 'host' },
					children: [child],
				}),
		});

		mounted = await createApp(App).mount('#app');
		await flushRenderer();

		expect(document.querySelector('[data-testid="host"]')?.textContent).toBe(
			'Ready'
		);

		child.value = CreateBlueprintNode({
			[EFFUSE_NODE]: true,
			blueprint: BrokenChild,
			props: {},
			portals: null,
		});
		await flushRenderer();

		const error = document.querySelector('[data-effuse-render-error]');
		expect(error).not.toBeNull();
		expect(error?.textContent).toContain('broken signal child');
	});

	it('renders diagnostics when a function child fails to mount', async () => {
		const App = define({
			script: () => ({}),
			template: () =>
				CreateElementNode({
					[EFFUSE_NODE]: true,
					tag: 'section',
					props: { 'data-testid': 'host' },
					children: [
						() => {
							throw new Error('broken function child');
						},
					],
				}),
		});

		mounted = await createApp(App).mount('#app');
		await flushRenderer();

		const error = document.querySelector('[data-effuse-render-error]');
		expect(error).not.toBeNull();
		expect(error?.textContent).toContain('broken function child');
	});

	it('renders diagnostics when a list child fails without a boundary', async () => {
		const App = define({
			script: () => ({}),
			template: () =>
				CreateListNode({
					[EFFUSE_NODE]: true,
					children: [
						() => {
							throw new Error('broken list child');
						},
					],
				}),
		});

		mounted = await createApp(App).mount('#app');
		await flushRenderer();

		const error = document.querySelector('[data-effuse-render-error]');
		expect(error).not.toBeNull();
		expect(error?.textContent).toContain('broken list child');
	});
});
