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
	EFFUSE_NODE,
	CreateBlueprintNode,
	CreateElementNode,
} from '../../render/node.js';
import { signal } from '../../reactivity/signal.js';

const flushRenderer = async (): Promise<void> => {
	await Promise.resolve();
	await Promise.resolve();
	await Promise.resolve();
	await Promise.resolve();
};

describe('blueprint template reactivity', () => {
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

	it('should rerender direct signal reads in define templates', async () => {
		const count = signal(0);
		let scriptRuns = 0;
		const App = define({
			script: () => {
				scriptRuns++;
				return { count };
			},
			template: ({ count }) =>
				CreateElementNode({
					[EFFUSE_NODE]: true,
					tag: 'button',
					props: { 'data-testid': 'count' },
					children: [count.value],
				}),
		});

		mounted = await createApp(App).mount('#app');
		await flushRenderer();

		expect(document.querySelector('[data-testid="count"]')?.textContent).toBe(
			'0'
		);
		expect(scriptRuns).toBe(1);

		count.value = 1;
		await flushRenderer();

		expect(document.querySelector('[data-testid="count"]')?.textContent).toBe(
			'1'
		);
		expect(scriptRuns).toBe(1);
	});

	it('should keep component lifecycle stable during template updates', async () => {
		const count = signal(0);
		let mountCalls = 0;
		let cleanupCalls = 0;
		const App = define({
			script: ({ onMount }) => {
				onMount(() => {
					mountCalls++;
					return () => {
						cleanupCalls++;
					};
				});
				return { count };
			},
			template: ({ count }) =>
				CreateElementNode({
					[EFFUSE_NODE]: true,
					tag: 'p',
					props: { 'data-testid': 'value' },
					children: [count.value],
				}),
		});

		mounted = await createApp(App).mount('#app');
		await flushRenderer();

		expect(mountCalls).toBe(1);
		expect(cleanupCalls).toBe(0);

		count.value = 2;
		await flushRenderer();

		expect(document.querySelector('[data-testid="value"]')?.textContent).toBe(
			'2'
		);
		expect(mountCalls).toBe(1);
		expect(cleanupCalls).toBe(0);
	});

	it('should preserve child component state during parent template updates', async () => {
		const parentCount = signal(0);
		let childMounts = 0;
		let childUnmounts = 0;

		const Child = define({
			script: ({ onMount, onUnmount }) => {
				const output = signal('Ready.');
				onMount(() => {
					childMounts++;
					return undefined;
				});
				onUnmount(() => {
					childUnmounts++;
				});
				return {
					output,
					update: () => {
						output.value = 'Updated.';
						parentCount.value++;
					},
				};
			},
			template: ({ output, update }) =>
				CreateElementNode({
					[EFFUSE_NODE]: true,
					tag: 'section',
					props: { 'data-testid': 'child' },
					children: [
						CreateElementNode({
							[EFFUSE_NODE]: true,
							tag: 'pre',
							props: { 'data-testid': 'child-output' },
							children: [output],
						}),
						CreateElementNode({
							[EFFUSE_NODE]: true,
							tag: 'button',
							props: { 'data-testid': 'child-update', onClick: update },
							children: ['Update'],
						}),
					],
				}),
		});

		const App = define({
			script: () => ({ parentCount }),
			template: ({ parentCount }) =>
				CreateElementNode({
					[EFFUSE_NODE]: true,
					tag: 'main',
					props: { 'data-testid': 'shell' },
					children: [
						CreateElementNode({
							[EFFUSE_NODE]: true,
							tag: 'small',
							props: { 'data-testid': 'parent-count' },
							children: [parentCount.value, ' parent updates'],
						}),
						CreateBlueprintNode({
							[EFFUSE_NODE]: true,
							blueprint: Child,
							props: {},
							portals: null,
						}),
					],
				}),
		});

		mounted = await createApp(App).mount('#app');
		await flushRenderer();

		expect(
			document.querySelector('[data-testid="child-output"]')?.textContent
		).toBe('Ready.');
		expect(childMounts).toBe(1);

		(
			document.querySelector(
				'[data-testid="child-update"]'
			) as HTMLButtonElement
		).click();
		await flushRenderer();

		expect(
			document.querySelector('[data-testid="parent-count"]')?.textContent
		).toBe('1 parent updates');
		expect(
			document.querySelector('[data-testid="child-output"]')?.textContent
		).toBe('Updated.');
		expect(childMounts).toBe(1);
		expect(childUnmounts).toBe(0);
	});

	it('should update child props without remounting the child component', async () => {
		const parentLabel = signal('Initial label');
		let childMounts = 0;
		let childUnmounts = 0;

		const Child = define({
			props: { label: '' },
			script: ({ computed, onMount, onUnmount, props }) => {
				const local = signal('Local ready.');
				const label = computed(() => props.label);

				onMount(() => {
					childMounts++;
					return undefined;
				});
				onUnmount(() => {
					childUnmounts++;
				});

				return {
					label,
					local,
					updateBoth: () => {
						local.value = 'Local preserved.';
						parentLabel.value = 'Changed label';
					},
				};
			},
			template: ({ label, local, updateBoth }) =>
				CreateElementNode({
					[EFFUSE_NODE]: true,
					tag: 'section',
					props: { 'data-testid': 'prop-child' },
					children: [
						CreateElementNode({
							[EFFUSE_NODE]: true,
							tag: 'strong',
							props: { 'data-testid': 'prop-label' },
							children: [label],
						}),
						CreateElementNode({
							[EFFUSE_NODE]: true,
							tag: 'pre',
							props: { 'data-testid': 'prop-local' },
							children: [local],
						}),
						CreateElementNode({
							[EFFUSE_NODE]: true,
							tag: 'button',
							props: { 'data-testid': 'prop-update', onClick: updateBoth },
							children: ['Update props'],
						}),
					],
				}),
		});

		const App = define({
			script: () => ({ parentLabel }),
			template: ({ parentLabel }) =>
				CreateElementNode({
					[EFFUSE_NODE]: true,
					tag: 'main',
					props: { 'data-testid': 'prop-shell' },
					children: [
						CreateBlueprintNode({
							[EFFUSE_NODE]: true,
							blueprint: Child,
							props: { label: parentLabel.value },
							portals: null,
						}),
					],
				}),
		});

		mounted = await createApp(App).mount('#app');
		await flushRenderer();

		expect(
			document.querySelector('[data-testid="prop-label"]')?.textContent
		).toBe('Initial label');
		expect(
			document.querySelector('[data-testid="prop-local"]')?.textContent
		).toBe('Local ready.');
		expect(childMounts).toBe(1);

		(
			document.querySelector('[data-testid="prop-update"]') as HTMLButtonElement
		).click();
		await flushRenderer();

		expect(
			document.querySelector('[data-testid="prop-label"]')?.textContent
		).toBe('Changed label');
		expect(
			document.querySelector('[data-testid="prop-local"]')?.textContent
		).toBe('Local preserved.');
		expect(childMounts).toBe(1);
		expect(childUnmounts).toBe(0);
	});

	it('should clean up child subtrees replaced by parent template updates', async () => {
		const showChild = signal(true);
		let childUnmounts = 0;
		const Child = define({
			script: ({ onUnmount }) => {
				onUnmount(() => {
					childUnmounts++;
				});
				return {};
			},
			template: () =>
				CreateElementNode({
					[EFFUSE_NODE]: true,
					tag: 'span',
					props: { 'data-testid': 'child' },
					children: ['child'],
				}),
		});
		const App = define({
			script: () => ({ showChild }),
			template: ({ showChild }) =>
				showChild.value
					? CreateBlueprintNode({
							[EFFUSE_NODE]: true,
							blueprint: Child,
							props: {},
							portals: null,
						})
					: CreateElementNode({
							[EFFUSE_NODE]: true,
							tag: 'span',
							props: { 'data-testid': 'empty' },
							children: ['empty'],
						}),
		});

		mounted = await createApp(App).mount('#app');
		await flushRenderer();

		expect(document.querySelector('[data-testid="child"]')).not.toBeNull();
		expect(childUnmounts).toBe(0);

		showChild.value = false;
		await flushRenderer();

		expect(document.querySelector('[data-testid="child"]')).toBeNull();
		expect(document.querySelector('[data-testid="empty"]')?.textContent).toBe(
			'empty'
		);
		expect(childUnmounts).toBe(1);
	});

	it('should render diagnostics and recover when tracked templates throw', async () => {
		const shouldThrow = signal(false);
		const App = define({
			script: () => ({ shouldThrow }),
			template: ({ shouldThrow }) => {
				if (shouldThrow.value) {
					throw new Error('broken tracked template');
				}

				return CreateElementNode({
					[EFFUSE_NODE]: true,
					tag: 'section',
					props: { 'data-testid': 'ok' },
					children: ['Ready'],
				});
			},
		});

		mounted = await createApp(App).mount('#app');
		await flushRenderer();

		expect(document.querySelector('[data-testid="ok"]')?.textContent).toBe(
			'Ready'
		);

		shouldThrow.value = true;
		await flushRenderer();

		const error = document.querySelector('[data-effuse-render-error]');
		expect(error).not.toBeNull();
		expect(error?.textContent).toContain('broken tracked template');

		shouldThrow.value = false;
		await flushRenderer();

		expect(document.querySelector('[data-effuse-render-error]')).toBeNull();
		expect(document.querySelector('[data-testid="ok"]')?.textContent).toBe(
			'Ready'
		);
	});
});
