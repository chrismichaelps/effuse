// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from 'vitest';
import {
	CreateBlueprintNode,
	EFFUSE_NODE,
	createApp,
	define,
} from '@effuse/core';
import { Link } from '../components/Link.js';
import { clearContext } from '../core/context.js';
import { createMemoryHistory } from '../core/history.js';
import { createRouter, installRouter } from '../core/router.js';

const mountedApps: Array<{ unmount: () => Promise<void> }> = [];
const installedRouters: Array<{ cleanup: () => void }> = [];

const Page = define({
	script: () => ({}),
	template: () => 'Page',
});

const mountLink = async (props: Record<string, unknown>) => {
	vi.spyOn(window, 'scrollTo').mockImplementation(() => undefined);
	const history = createMemoryHistory('/');
	const router = createRouter({
		history,
		routes: [
			{ path: '/', component: Page },
			{ path: '/next', component: Page },
		],
	});
	const installed = installRouter(router);
	installedRouters.push(installed);

	const Shell = define({
		script: () => ({}),
		template: () =>
			CreateBlueprintNode({
				[EFFUSE_NODE]: true,
				blueprint: Link,
				props: { to: '/next', children: 'Next', ...props },
				portals: null,
			}),
	});
	const mounted = await createApp(Shell).mount('#app');
	mountedApps.push(mounted);
	await Promise.resolve();
	await Promise.resolve();

	return {
		anchor: document.querySelector('a') as HTMLAnchorElement,
		history,
		router,
	};
};

afterEach(async () => {
	for (const mounted of mountedApps.splice(0).reverse())
		await mounted.unmount();
	for (const installed of installedRouters.splice(0).reverse())
		installed.cleanup();
	clearContext();
	document.body.innerHTML = '<div id="app"></div>';
	vi.restoreAllMocks();
});

describe('Link', () => {
	it('forwards native and custom anchor attributes', async () => {
		document.body.innerHTML = '<div id="app"></div>';
		const { anchor } = await mountLink({
			id: 'docs-link',
			title: 'Open docs',
			'data-testid': 'docs-route-link',
			'aria-label': 'Open documentation',
			target: '_blank',
			rel: 'noreferrer',
			download: 'docs.html',
		});

		expect(anchor.id).toBe('docs-link');
		expect(anchor.title).toBe('Open docs');
		expect(anchor.dataset.testid).toBe('docs-route-link');
		expect(anchor.getAttribute('aria-label')).toBe('Open documentation');
		expect(anchor.target).toBe('_blank');
		expect(anchor.rel).toBe('noreferrer');
		expect(anchor.download).toBe('docs.html');
		expect(anchor.getAttribute('to')).toBeNull();
	});

	it('uses the router for an uncancelled primary self-navigation', async () => {
		document.body.innerHTML = '<div id="app"></div>';
		const { anchor, router } = await mountLink({});
		const push = vi.spyOn(router, 'push');

		anchor.dispatchEvent(
			new MouseEvent('click', { bubbles: true, cancelable: true, button: 0 })
		);

		expect(push).toHaveBeenCalledOnce();
		expect(push).toHaveBeenCalledWith('/next');
	});

	it('honors consumer cancellation before router navigation', async () => {
		document.body.innerHTML = '<div id="app"></div>';
		const onClick = vi.fn((event: MouseEvent) => event.preventDefault());
		const { anchor, router } = await mountLink({ onClick });
		const push = vi.spyOn(router, 'push');

		anchor.dispatchEvent(
			new MouseEvent('click', { bubbles: true, cancelable: true, button: 0 })
		);

		expect(onClick).toHaveBeenCalledOnce();
		expect(push).not.toHaveBeenCalled();
	});

	it.each([
		['a non-self target', { target: '_blank' }],
		['a download', { download: 'report.csv' }],
	])('preserves native navigation for %s', async (_name, props) => {
		document.body.innerHTML = '<div id="app"></div>';
		const { anchor, router } = await mountLink(props);
		const push = vi.spyOn(router, 'push');
		anchor.addEventListener('click', (event) => event.preventDefault(), {
			once: true,
		});

		anchor.dispatchEvent(
			new MouseEvent('click', { bubbles: true, cancelable: true, button: 0 })
		);

		expect(push).not.toHaveBeenCalled();
	});
});
