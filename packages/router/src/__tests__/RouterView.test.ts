// @vitest-environment jsdom
/**
 * MIT License
 *
 * Copyright (c) 2025 Chris M. Perez
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
	CreateBlueprintNode,
	CreateElementNode,
	EFFUSE_NODE,
	createApp,
	define,
} from '@effuse/core';
import { createMemoryHistory } from '../core/history.js';
import { createWebHistory } from '../core/history.js';
import { createRouter, installRouter } from '../core/router.js';
import { clearContext } from '../core/context.js';
import { RouterView } from '../components/RouterView.js';

describe('RouterView', () => {
	beforeEach(() => {
		clearContext();
		document.body.innerHTML = '<div id="app"></div>';
	});

	it('renders the current route component on initial mount', async () => {
		const FormsPage = define({
			script: () => ({}),
			template: () =>
				CreateElementNode({
					[EFFUSE_NODE]: true,
					tag: 'section',
					props: { 'data-testid': 'forms-page' },
					children: ['Forms page'],
				}),
		});

		const Shell = define({
			script: () => ({}),
			template: () =>
				CreateElementNode({
					[EFFUSE_NODE]: true,
					tag: 'main',
					props: null,
					children: [
						CreateBlueprintNode({
							[EFFUSE_NODE]: true,
							blueprint: RouterView,
							props: {},
							portals: null,
						}),
					],
				}),
		});

		const router = createRouter({
			history: createMemoryHistory('/forms'),
			routes: [
				{
					path: '/forms',
					name: 'forms',
					component: FormsPage,
				},
			],
		});

		installRouter(router);

		await createApp(Shell).mount('#app');
		await Promise.resolve();
		await Promise.resolve();

		expect(document.querySelector('[data-testid="forms-page"]')?.textContent).toBe(
			'Forms page'
		);
	});

	it('renders the current web-history route on initial mount', async () => {
		window.history.replaceState({}, '', '/forms');

		const FormsPage = define({
			script: () => ({}),
			template: () =>
				CreateElementNode({
					[EFFUSE_NODE]: true,
					tag: 'section',
					props: { 'data-testid': 'forms-page' },
					children: ['Forms page'],
				}),
		});

		const Shell = define({
			script: () => ({}),
			template: () =>
				CreateElementNode({
					[EFFUSE_NODE]: true,
					tag: 'main',
					props: null,
					children: [
						CreateBlueprintNode({
							[EFFUSE_NODE]: true,
							blueprint: RouterView,
							props: {},
							portals: null,
						}),
					],
				}),
		});

		const router = createRouter({
			history: createWebHistory(),
			routes: [
				{
					path: '/forms',
					name: 'forms',
					component: FormsPage,
				},
			],
		});

		installRouter(router);

		await createApp(Shell).mount('#app');
		await Promise.resolve();
		await Promise.resolve();

		expect(document.querySelector('[data-testid="forms-page"]')?.textContent).toBe(
			'Forms page'
		);
	});

	it('updates the rendered route component after client navigation', async () => {
		const HomePage = define({
			script: () => ({}),
			template: () =>
				CreateElementNode({
					[EFFUSE_NODE]: true,
					tag: 'section',
					props: { 'data-testid': 'home-page' },
					children: ['Home page'],
				}),
		});
		const ServerPage = define({
			script: () => ({}),
			template: () =>
				CreateElementNode({
					[EFFUSE_NODE]: true,
					tag: 'section',
					props: { 'data-testid': 'server-page' },
					children: ['Server page'],
				}),
		});

		const Shell = define({
			script: () => ({}),
			template: () =>
				CreateElementNode({
					[EFFUSE_NODE]: true,
					tag: 'main',
					props: null,
					children: [
						CreateBlueprintNode({
							[EFFUSE_NODE]: true,
							blueprint: RouterView,
							props: {},
							portals: null,
						}),
					],
				}),
		});

		const router = createRouter({
			history: createMemoryHistory('/server'),
			routes: [
				{ path: '/', name: 'home', component: HomePage },
				{ path: '/server', name: 'server', component: ServerPage },
			],
		});

		installRouter(router);
		await createApp(Shell).mount('#app');
		await Promise.resolve();
		await Promise.resolve();

		expect(document.querySelector('[data-testid="server-page"]')?.textContent).toBe(
			'Server page'
		);

		router.push('/');
		await Promise.resolve();
		await Promise.resolve();

		expect(document.querySelector('[data-testid="home-page"]')?.textContent).toBe(
			'Home page'
		);
		expect(document.querySelector('[data-testid="server-page"]')).toBeNull();
	});
});
