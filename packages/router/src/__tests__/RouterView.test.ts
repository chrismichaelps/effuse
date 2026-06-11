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
	defineHook,
	defineLayer,
	signal,
	type Signal,
} from '@effuse/core';
import { createMemoryHistory } from '../core/history.js';
import { createWebHistory } from '../core/history.js';
import { createRouter, installRouter } from '../core/router.js';
import { lazyRoute } from '../core/route.js';
import { clearContext } from '../core/context.js';
import { Link } from '../components/Link.js';
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

	it('renders a cached named-export lazy route component', async () => {
		let loadCount = 0;
		const LazyPage = define({
			script: () => ({}),
			template: () =>
				CreateElementNode({
					[EFFUSE_NODE]: true,
					tag: 'section',
					props: { 'data-testid': 'lazy-page' },
					children: ['Lazy page'],
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

		const LazyRoute = lazyRoute(
			async () => {
				loadCount += 1;
				return { LazyPage };
			},
			{ export: 'LazyPage' }
		);

		const router = createRouter({
			history: createMemoryHistory('/lazy'),
			routes: [
				{
					path: '/lazy',
					name: 'lazy',
					component: LazyRoute,
				},
			],
		});

		installRouter(router);

		await createApp(Shell).mount('#app');

		expect(document.querySelector('.router-view-loading')).not.toBeNull();

		await Promise.resolve();
		await Promise.resolve();
		await Promise.resolve();

		expect(document.querySelector('[data-testid="lazy-page"]')?.textContent).toBe(
			'Lazy page'
		);
		expect(loadCount).toBe(1);

		await LazyRoute();

		expect(loadCount).toBe(1);
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

	it('keeps RouterView mounted after web-history link navigation from a stateful page', async () => {
		window.history.replaceState({}, '', '/server');

		interface LabService {
			readonly events: Signal<string[]>;
			record(message: string): void;
		}

		const events = signal<string[]>([]);
		const mode = signal<'light' | 'dark'>('dark');

		const LabLayer = defineLayer({
			name: 'router-view-lab',
			deriveProps: () => ({ events }),
			services: {
				lab: (): LabService => ({
					events,
					record: (message) => {
						events.value = [message, ...events.value];
					},
				}),
			},
		});

		const ThemeLayer = defineLayer({
			name: 'router-view-theme',
			deriveProps: () => ({ mode }),
			services: {
				theme: () => ({
					mode,
					toggle: () => {
						mode.value = mode.value === 'dark' ? 'light' : 'dark';
					},
				}),
			},
		});

		const useTimeline = defineHook({
			name: 'useTimeline',
			layers: { lab: LabLayer } as const,
			setup: ({ computed, layers }) => {
				const lab = layers.lab.services.lab;
				return {
					count: computed(() => lab.events.value.length),
					record: lab.record,
				};
			},
		});

		const ServerPage = define({
			layers: { lab: LabLayer } as const,
			script: ({ layers, signal: createSignal }) => {
				const output = createSignal('Ready.');
				const lab = layers.lab.services.lab;
				const run = (message: string) => {
					lab.record(message);
					output.value = message;
				};
				return { output, run };
			},
			template: ({ output, run }) =>
				CreateElementNode({
					[EFFUSE_NODE]: true,
					tag: 'section',
					props: { 'data-testid': 'server-page' },
					children: [
						CreateElementNode({
							[EFFUSE_NODE]: true,
							tag: 'button',
							props: { onClick: () => run('route') },
							children: ['Route'],
						}),
						CreateElementNode({
							[EFFUSE_NODE]: true,
							tag: 'button',
							props: { onClick: () => run('action') },
							children: ['Action'],
						}),
						CreateElementNode({
							[EFFUSE_NODE]: true,
							tag: 'pre',
							props: { 'data-testid': 'server-output' },
							children: [output],
						}),
					],
				}),
		});

		const LayersPage = define({
			layers: { lab: LabLayer, theme: ThemeLayer } as const,
			script: ({ computed, layers }) => {
				const theme = layers.theme.services.theme;
				const timeline = useTimeline();
				return {
					record: () => timeline.record('layers mounted'),
					theme,
					themeLabel: computed(() => `Theme: ${theme.mode.value}`),
					timeline,
				};
			},
			template: ({ record, theme, themeLabel, timeline }) =>
				CreateElementNode({
					[EFFUSE_NODE]: true,
					tag: 'section',
					props: { 'data-testid': 'layers-page' },
					children: [
						CreateElementNode({
							[EFFUSE_NODE]: true,
							tag: 'button',
							props: { onClick: () => theme.toggle() },
							children: ['Toggle'],
						}),
						CreateElementNode({
							[EFFUSE_NODE]: true,
							tag: 'button',
							props: { onClick: record },
							children: ['Record'],
						}),
						CreateElementNode({
							[EFFUSE_NODE]: true,
							tag: 'p',
							props: { 'data-testid': 'theme-label' },
							children: [themeLabel],
						}),
						CreateElementNode({
							[EFFUSE_NODE]: true,
							tag: 'p',
							props: { 'data-testid': 'event-count' },
							children: ['Events: ', timeline.count],
						}),
					],
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
							blueprint: Link,
							props: { to: '/server', children: 'Server' },
							portals: null,
						}),
						CreateBlueprintNode({
							[EFFUSE_NODE]: true,
							blueprint: Link,
							props: { to: '/layers', children: 'Layers' },
							portals: null,
						}),
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
				{ path: '/server', name: 'server', component: ServerPage },
				{ path: '/layers', name: 'layers', component: LayersPage },
			],
		});

		installRouter(router);
		const app = createApp(Shell);
		await app.useLayers({ lab: LabLayer, theme: ThemeLayer });
		const mounted = await app.mount('#app');
		await Promise.resolve();
		await Promise.resolve();

		expect(document.querySelector('[data-testid="server-page"]')).not.toBeNull();

		document.querySelectorAll('button')[0]?.dispatchEvent(
			new MouseEvent('click', { bubbles: true, button: 0 })
		);
		document.querySelectorAll('button')[1]?.dispatchEvent(
			new MouseEvent('click', { bubbles: true, button: 0 })
		);
		await Promise.resolve();
		await Promise.resolve();

		expect(document.querySelector('[data-testid="server-output"]')?.textContent).toBe(
			'action'
		);

		document.querySelector<HTMLAnchorElement>('a[href="/layers"]')?.dispatchEvent(
			new MouseEvent('click', { bubbles: true, cancelable: true, button: 0 })
		);
		await Promise.resolve();
		await Promise.resolve();
		await Promise.resolve();

		expect(window.location.pathname).toBe('/layers');
		expect(document.querySelector('[data-testid="layers-page"]')).not.toBeNull();
		expect(document.querySelector('[data-testid="server-page"]')).toBeNull();

		await mounted.unmount();
	});
});
