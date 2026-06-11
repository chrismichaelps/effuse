// @vitest-environment jsdom
/**
 * MIT License
 *
 * Copyright (c) 2025 Chris M. Perez
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../../app/createApp.js';
import { define } from '../../blueprint/define.js';
import { View, type ViewProps } from '../../components/View.js';
import {
	EFFUSE_NODE,
	CreateElementNode,
	type BlueprintNode,
} from '../../render/node.js';
import { signal } from '../../reactivity/signal.js';

const flushRenderer = async (): Promise<void> => {
	await Promise.resolve();
	await Promise.resolve();
	await Promise.resolve();
};

const viewNode = (of: ViewProps['of']): BlueprintNode<ViewProps> =>
	View({ of }) as BlueprintNode<ViewProps>;

describe('View', () => {
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

	it('should render tracked scalar expressions', async () => {
		const count = signal(1);
		const App = define({
			script: () => ({ count }),
			template: ({ count }) =>
				CreateElementNode({
					[EFFUSE_NODE]: true,
					tag: 'p',
					props: { 'data-testid': 'count' },
					children: [viewNode(() => count.value), ' total'],
				}),
		});

		mounted = await createApp(App).mount('#app');
		await flushRenderer();

		expect(document.querySelector('[data-testid="count"]')?.textContent).toBe(
			'1 total'
		);

		count.value = 2;
		await flushRenderer();

		expect(document.querySelector('[data-testid="count"]')?.textContent).toBe(
			'2 total'
		);
	});

	it('should render tracked nested nodes', async () => {
		const mode = signal<'ready' | 'busy'>('ready');
		const App = define({
			script: () => ({ mode }),
			template: ({ mode }) =>
				CreateElementNode({
					[EFFUSE_NODE]: true,
					tag: 'section',
					props: { 'data-testid': 'host' },
					children: [
						viewNode(() =>
							CreateElementNode({
								[EFFUSE_NODE]: true,
								tag: 'strong',
								props: { 'data-testid': 'mode' },
								children: [mode.value],
							})
						),
					],
				}),
		});

		mounted = await createApp(App).mount('#app');
		await flushRenderer();

		expect(document.querySelector('[data-testid="mode"]')?.textContent).toBe(
			'ready'
		);

		mode.value = 'busy';
		await flushRenderer();

		expect(document.querySelector('[data-testid="mode"]')?.textContent).toBe(
			'busy'
		);
	});

	it('should surface expression errors through render diagnostics', async () => {
		const shouldThrow = signal(false);
		const App = define({
			script: () => ({ shouldThrow }),
			template: ({ shouldThrow }) =>
				CreateElementNode({
					[EFFUSE_NODE]: true,
					tag: 'section',
					props: { 'data-testid': 'host' },
					children: [
						viewNode(() => {
							if (shouldThrow.value) {
								throw new Error('broken view expression');
							}
							return 'Ready';
						}),
					],
				}),
		});

		mounted = await createApp(App).mount('#app');
		await flushRenderer();

		expect(document.querySelector('[data-testid="host"]')?.textContent).toBe(
			'Ready'
		);

		shouldThrow.value = true;
		await flushRenderer();

		const error = document.querySelector('[data-effuse-render-error]');
		expect(error).not.toBeNull();
		expect(error?.textContent).toContain('broken view expression');
	});
});
