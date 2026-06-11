// @vitest-environment jsdom
/**
 * MIT License
 *
 * Copyright (c) 2025 Chris M. Perez
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../../app/createApp.js';
import { define } from '../../blueprint/define.js';
import { defineLayer } from '../../layers/api/defineLayer.js';
import { CreateElementNode, EFFUSE_NODE } from '../../render/node.js';

type MountedApp = {
	unmount: () => Promise<void>;
};

const flushRenderer = async (): Promise<void> => {
	await Promise.resolve();
	await Promise.resolve();
	await Promise.resolve();
	await Promise.resolve();
};

const createMountedComponent = (text: string, onUnmount?: () => void) =>
	define({
		script: ({ onUnmount: registerUnmount }) => {
			if (onUnmount) {
				registerUnmount(onUnmount);
			}
			return {};
		},
		template: () =>
			CreateElementNode({
				[EFFUSE_NODE]: true,
				tag: 'main',
				props: { 'data-testid': 'app-root' },
				children: [text],
			}),
	});

describe('app unmount', () => {
	let mountedApps: MountedApp[] = [];

	beforeEach(() => {
		document.body.innerHTML = '<div id="app"></div>';
		mountedApps = [];
	});

	afterEach(async () => {
		for (const mounted of mountedApps) {
			await mounted.unmount();
		}
		document.body.innerHTML = '';
	});

	it('should dispose the mounted canvas and clear the DOM', async () => {
		let componentUnmounts = 0;
		const App = createMountedComponent('Mounted app', () => {
			componentUnmounts++;
		});
		const mounted = await createApp(App).mount('#app');
		mountedApps.push(mounted);
		await flushRenderer();

		const container = document.querySelector('#app');
		expect(container?.textContent).toBe('Mounted app');

		await mounted.unmount();

		expect(container?.innerHTML).toBe('');
		expect(componentUnmounts).toBe(1);

		await mounted.unmount();

		expect(container?.innerHTML).toBe('');
		expect(componentUnmounts).toBe(1);
	});

	it('should dispose layer runtime after renderer cleanup', async () => {
		const cleanupOrder: string[] = [];
		const App = createMountedComponent('Layered app', () => {
			cleanupOrder.push('component');
		});
		const Layer = defineLayer({
			name: 'app-unmount-runtime-cleanup',
			setup: () => () => {
				cleanupOrder.push('layer');
			},
		});

		const app = await createApp(App).useLayers([Layer]);
		const mounted = await app.mount('#app');
		mountedApps.push(mounted);
		await flushRenderer();

		await mounted.unmount();

		expect(cleanupOrder).toEqual(['component', 'layer']);
		expect(document.querySelector('#app')?.innerHTML).toBe('');
	});

	it('should clean up layer runtime when DOM mount fails', async () => {
		let layerCleanups = 0;
		const App = createMountedComponent('Missing target');
		const Layer = defineLayer({
			name: 'app-unmount-missing-target-cleanup',
			setup: () => () => {
				layerCleanups++;
			},
		});
		const app = await createApp(App).useLayers([Layer]);

		await expect(app.mount('#missing-target')).rejects.toThrow(
			'Canvas target not found: #missing-target'
		);

		expect(layerCleanups).toBe(1);
	});

	it('should ignore stale unmount handles after remounting', async () => {
		document.body.innerHTML = '<div id="first"></div><div id="second"></div>';
		let componentUnmounts = 0;
		let layerCleanups = 0;
		const App = createMountedComponent('Remounted app', () => {
			componentUnmounts++;
		});
		const Layer = defineLayer({
			name: 'app-unmount-remount-cleanup',
			setup: () => () => {
				layerCleanups++;
			},
		});
		const app = await createApp(App).useLayers([Layer]);

		const firstMount = await app.mount('#first');
		mountedApps.push(firstMount);
		await flushRenderer();

		expect(document.querySelector('#first')?.textContent).toBe('Remounted app');

		const secondMount = await app.mount('#second');
		mountedApps.push(secondMount);
		await flushRenderer();

		expect(document.querySelector('#first')?.innerHTML).toBe('');
		expect(document.querySelector('#second')?.textContent).toBe('Remounted app');
		expect(componentUnmounts).toBe(1);
		expect(layerCleanups).toBe(1);

		await firstMount.unmount();

		expect(document.querySelector('#second')?.textContent).toBe('Remounted app');
		expect(componentUnmounts).toBe(1);
		expect(layerCleanups).toBe(1);

		await secondMount.unmount();

		expect(document.querySelector('#second')?.innerHTML).toBe('');
		expect(componentUnmounts).toBe(2);
		expect(layerCleanups).toBe(2);
	});
});
