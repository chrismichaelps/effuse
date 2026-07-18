// @vitest-environment jsdom
/**
 * MIT License
 *
 * Copyright (c) 2025 Chris M. Perez
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
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

const createOutlet = (props: Record<string, unknown> = {}) =>
	CreateBlueprintNode({
		[EFFUSE_NODE]: true,
		blueprint: RouterView,
		props,
		portals: null,
	});

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

	it('renders an actionable error when a route layer was not registered at startup', async () => {
		const CommerceLayer = defineLayer({
			name: 'commerce-runtime',
			services: { cart: () => ({ total: 42 }) },
		});
		const CommercePage = define({
			name: 'CommercePage',
			layers: { commerce: CommerceLayer } as const,
			script: ({ layers }) => ({ total: layers.commerce.services.cart.total }),
			template: ({ total }) => String(total),
		});
		const Shell = define({
			script: () => ({}),
			template: () => createOutlet(),
		});
		const router = createRouter({
			history: createMemoryHistory(),
			routes: [{ path: '/', component: CommercePage }],
		});

		installRouter(router);
		const mounted = await createApp(Shell).mount('#app');
		await Promise.resolve();
		await Promise.resolve();

		const error = document.querySelector('[data-effuse-render-error="true"]');
		expect(error?.textContent).toContain(
			'component "CommercePage" declares layer binding "commerce" for layer "commerce-runtime"'
		);
		expect(error?.textContent).toContain('app.useLayers(...) before mount');

		await mounted.unmount();
	});

	it('renders a child route through a nested outlet', async () => {
		const ChildPage = define({
			script: () => ({}),
			template: () =>
				CreateElementNode({
					[EFFUSE_NODE]: true,
					tag: 'p',
					props: { 'data-testid': 'nested-child' },
					children: ['Nested child'],
				}),
		});
		const ParentLayout = define({
			script: () => ({}),
			template: () =>
				CreateElementNode({
					[EFFUSE_NODE]: true,
					tag: 'section',
					props: { 'data-testid': 'parent-layout' },
					children: [
						'Parent layout',
						CreateBlueprintNode({
							[EFFUSE_NODE]: true,
							blueprint: RouterView,
							props: {},
							portals: null,
						}),
					],
				}),
		});
		const Shell = define({
			script: () => ({}),
			template: () =>
				CreateBlueprintNode({
					[EFFUSE_NODE]: true,
					blueprint: RouterView,
					props: {},
					portals: null,
				}),
		});
		const router = createRouter({
			history: createMemoryHistory('/account/profile'),
			routes: [
				{
					path: '/account',
					component: ParentLayout,
					children: [{ path: 'profile', component: ChildPage }],
				},
			],
		});

		installRouter(router);
		await createApp(Shell).mount('#app');
		await Promise.resolve();
		await Promise.resolve();

		expect(document.querySelector('[data-testid="parent-layout"]')).not.toBeNull();
		expect(
			document.querySelector('[data-testid="nested-child"]')?.textContent
		).toBe('Nested child');
	});

	it('renders three levels and switches nested siblings', async () => {
		let workspaceScripts = 0;
		let workspaceMounts = 0;
		let workspaceUnmounts = 0;
		let projectScripts = 0;
		let projectMounts = 0;
		let projectUnmounts = 0;
		const OverviewPage = define({
			script: () => ({}),
			template: () =>
				CreateElementNode({
					[EFFUSE_NODE]: true,
					tag: 'p',
					props: { 'data-testid': 'overview-page' },
					children: ['Overview'],
				}),
		});
		const SettingsPage = define({
			script: () => ({}),
			template: () =>
				CreateElementNode({
					[EFFUSE_NODE]: true,
					tag: 'p',
					props: { 'data-testid': 'settings-page' },
					children: ['Settings'],
				}),
		});
		const ProjectLayout = define({
			script: ({ onMount, onUnmount }) => {
				projectScripts += 1;
				onMount(() => {
					projectMounts += 1;
					return undefined;
				});
				onUnmount(() => {
					projectUnmounts += 1;
				});
				return {};
			},
			template: () =>
				CreateElementNode({
					[EFFUSE_NODE]: true,
					tag: 'article',
					props: { 'data-testid': 'project-layout' },
					children: [createOutlet()],
				}),
		});
		const WorkspaceLayout = define({
			script: ({ onMount, onUnmount }) => {
				workspaceScripts += 1;
				onMount(() => {
					workspaceMounts += 1;
					return undefined;
				});
				onUnmount(() => {
					workspaceUnmounts += 1;
				});
				return {};
			},
			template: () =>
				CreateElementNode({
					[EFFUSE_NODE]: true,
					tag: 'section',
					props: { 'data-testid': 'workspace-layout' },
					children: [createOutlet()],
				}),
		});
		const Shell = define({
			script: () => ({}),
			template: () => createOutlet(),
		});
		const router = createRouter({
			history: createMemoryHistory('/workspace/project/overview'),
			routes: [
				{
					path: '/workspace',
					component: WorkspaceLayout,
					children: [
						{
							path: 'project',
							component: ProjectLayout,
							children: [
								{ path: 'overview', component: OverviewPage },
								{ path: 'settings', component: SettingsPage },
							],
						},
					],
				},
			],
		});

		installRouter(router);
		const mounted = await createApp(Shell).mount('#app');
		await vi.waitFor(() => {
			expect(document.querySelector('[data-testid="overview-page"]')).not.toBeNull();
		});
		expect([workspaceScripts, workspaceMounts, projectScripts, projectMounts]).toEqual([
			1, 1, 1, 1,
		]);

		await router.push('/workspace/project/settings');
		await vi.waitFor(() => {
			expect(document.querySelector('[data-testid="settings-page"]')).not.toBeNull();
		});
		expect(document.querySelector('[data-testid="overview-page"]')).toBeNull();
		expect(document.querySelector('[data-testid="workspace-layout"]')).not.toBeNull();
		expect(document.querySelector('[data-testid="project-layout"]')).not.toBeNull();
		expect([workspaceScripts, workspaceMounts, projectScripts, projectMounts]).toEqual([
			1, 1, 1, 1,
		]);
		expect([workspaceUnmounts, projectUnmounts]).toEqual([0, 0]);

		await mounted.unmount();
		expect([workspaceUnmounts, projectUnmounts]).toEqual([1, 1]);
		await router.push('/workspace/project/overview');
		expect(document.querySelector('[data-testid="workspace-layout"]')).toBeNull();
		expect(document.querySelector('[data-testid="overview-page"]')).toBeNull();
	});

	it('updates params, query, and hash props without remounting the route', async () => {
		let scriptRuns = 0;
		let mountCalls = 0;
		let unmountCalls = 0;
		const UserPage = define<{
			readonly id: string;
			readonly tab: string;
			readonly hash: string;
		}>({
			script: ({ onMount, onUnmount }) => {
				scriptRuns += 1;
				onMount(() => {
					mountCalls += 1;
					return undefined;
				});
				onUnmount(() => {
					unmountCalls += 1;
				});
				return {};
			},
			template: ({ id, tab, hash }) =>
				CreateElementNode({
					[EFFUSE_NODE]: true,
					tag: 'p',
					props: { 'data-testid': 'user-props' },
					children: [id, ':', tab, ':', hash],
				}),
		});
		const Shell = define({
			script: () => ({}),
			template: () => createOutlet(),
		});
		const router = createRouter({
			history: createMemoryHistory('/users/1?tab=summary#top'),
			routes: [
				{
					path: '/users/:id',
					component: UserPage,
					props: (route) => ({
						tab: String(route.query.tab ?? ''),
						hash: route.hash,
					}),
				},
			],
		});

		installRouter(router);
		await createApp(Shell).mount('#app');
		await vi.waitFor(() => {
			expect(document.querySelector('[data-testid="user-props"]')?.textContent).toBe(
				'1:summary:#top'
			);
		});

		await router.push('/users/2?tab=activity#latest');
		await vi.waitFor(() => {
			expect(document.querySelector('[data-testid="user-props"]')?.textContent).toBe(
				'2:activity:#latest'
			);
		});

		expect([scriptRuns, mountCalls, unmountCalls]).toEqual([1, 1, 0]);
	});

	it('remounts when navigation switches between alias and canonical records', async () => {
		let scriptRuns = 0;
		let unmountCalls = 0;
		const UserPage = define({
			script: ({ onUnmount }) => {
				scriptRuns += 1;
				onUnmount(() => {
					unmountCalls += 1;
				});
				return {};
			},
			template: () =>
				CreateElementNode({
					[EFFUSE_NODE]: true,
					tag: 'p',
					props: { 'data-testid': 'aliased-user' },
					children: ['User'],
				}),
		});
		const Shell = define({
			script: () => ({}),
			template: () => createOutlet(),
		});
		const router = createRouter({
			history: createMemoryHistory('/people/1'),
			routes: [
				{
					path: '/users/:id',
					alias: '/people/:id',
					component: UserPage,
				},
			],
		});

		installRouter(router);
		await createApp(Shell).mount('#app');
		await vi.waitFor(() => {
			expect(document.querySelector('[data-testid="aliased-user"]')).not.toBeNull();
		});
		await router.push('/users/1');
		await vi.waitFor(() => {
			expect(scriptRuns).toBe(2);
		});

		expect(unmountCalls).toBe(1);
	});

	it('renders nested default and named outlets at the same depth', async () => {
		const MainPage = define({
			script: () => ({}),
			template: () =>
				CreateElementNode({
					[EFFUSE_NODE]: true,
					tag: 'main',
					props: { 'data-testid': 'nested-main' },
					children: ['Main'],
				}),
		});
		const SidebarPage = define({
			script: () => ({}),
			template: () =>
				CreateElementNode({
					[EFFUSE_NODE]: true,
					tag: 'aside',
					props: { 'data-testid': 'nested-sidebar' },
					children: ['Sidebar'],
				}),
		});
		const DashboardLayout = define({
			script: () => ({}),
			template: () =>
				CreateElementNode({
					[EFFUSE_NODE]: true,
					tag: 'section',
					props: {},
					children: [createOutlet(), createOutlet({ name: 'sidebar' })],
				}),
		});
		const Shell = define({
			script: () => ({}),
			template: () => createOutlet(),
		});
		const router = createRouter({
			history: createMemoryHistory('/app/dashboard'),
			routes: [
				{
					path: '/app',
					component: DashboardLayout,
					children: [
						{
							path: 'dashboard',
							components: { default: MainPage, sidebar: SidebarPage },
						},
					],
				},
			],
		});

		installRouter(router);
		await createApp(Shell).mount('#app');

		await vi.waitFor(() => {
			expect(document.querySelector('[data-testid="nested-main"]')).not.toBeNull();
			expect(document.querySelector('[data-testid="nested-sidebar"]')).not.toBeNull();
		});
	});

	it('keeps depth through lazy parent and child modules', async () => {
		const LazyChild = define({
			script: () => ({}),
			template: () =>
				CreateElementNode({
					[EFFUSE_NODE]: true,
					tag: 'p',
					props: { 'data-testid': 'lazy-nested-child' },
					children: ['Lazy child'],
				}),
		});
		const LazyLayout = define({
			script: () => ({}),
			template: () =>
				CreateElementNode({
					[EFFUSE_NODE]: true,
					tag: 'section',
					props: { 'data-testid': 'lazy-layout' },
					children: [createOutlet()],
				}),
		});
		const Shell = define({
			script: () => ({}),
			template: () => createOutlet(),
		});
		const router = createRouter({
			history: createMemoryHistory('/lazy/child'),
			routes: [
				{
					path: '/lazy',
					component: lazyRoute(async () => ({ default: LazyLayout })),
					children: [
						{
							path: 'child',
							component: lazyRoute(async () => ({ default: LazyChild })),
						},
					],
				},
			],
		});

		installRouter(router);
		await createApp(Shell).mount('#app');

		await vi.waitFor(() => {
			expect(document.querySelector('[data-testid="lazy-layout"]')).not.toBeNull();
			expect(
				document.querySelector('[data-testid="lazy-nested-child"]')
			).not.toBeNull();
		});
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

	it('renders a custom lazy fallback until the route chunk resolves', async () => {
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
		let resolveModule:
			| ((module: { readonly default: typeof LazyPage }) => void)
			| undefined;

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
							props: {
								fallback: (route) =>
									CreateElementNode({
										[EFFUSE_NODE]: true,
										tag: 'p',
										props: { 'data-testid': 'custom-route-fallback' },
										children: ['Loading ', route.name ?? 'route'],
									}),
							},
							portals: null,
						}),
					],
				}),
		});

		const LazyRoute = lazyRoute(
			() =>
				new Promise<{ readonly default: typeof LazyPage }>((resolve) => {
					resolveModule = resolve;
				})
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
		await Promise.resolve();

		expect(document.querySelector('.router-view-loading')).toBeNull();
		expect(
			document.querySelector('[data-testid="custom-route-fallback"]')?.textContent
		).toBe('Loading lazy');

		resolveModule?.({ default: LazyPage });
		await Promise.resolve();
		await Promise.resolve();
		await Promise.resolve();

		expect(document.querySelector('[data-testid="lazy-page"]')?.textContent).toBe(
			'Lazy page'
		);
	});

	it('renders a custom lazy error fallback when the route chunk fails', async () => {
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
							props: {
								errorFallback: (error, route) =>
									CreateElementNode({
										[EFFUSE_NODE]: true,
										tag: 'p',
										props: { 'data-testid': 'custom-route-error' },
										children: [
											route.name ?? 'route',
											': ',
											error instanceof Error ? error.message : 'unknown',
										],
									}),
							},
							portals: null,
						}),
					],
				}),
		});

		const LazyRoute = lazyRoute(async () => {
			throw new Error('chunk missing');
		});

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
		await Promise.resolve();
		await Promise.resolve();
		await Promise.resolve();

		expect(document.querySelector('.router-view-error')).toBeNull();
		expect(
			document.querySelector('[data-testid="custom-route-error"]')?.textContent
		).toBe('lazy: chunk missing');
	});

	it('renders a legacy Promise-returning route function', async () => {
		const LazyPage = define({
			script: () => ({}),
			template: () =>
				CreateElementNode({
					[EFFUSE_NODE]: true,
					tag: 'section',
					props: { 'data-testid': 'legacy-lazy-page' },
					children: ['Legacy lazy page'],
				}),
		});
		let resolveLegacy:
			| ((module: { readonly default: typeof LazyPage }) => void)
			| undefined;

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

		const LegacyLazyRoute = () =>
			new Promise<{ readonly default: typeof LazyPage }>((resolve) => {
				resolveLegacy = resolve;
			});
		const router = createRouter({
			history: createMemoryHistory('/legacy'),
			routes: [
				{
					path: '/legacy',
					name: 'legacy',
					component: LegacyLazyRoute,
				},
			],
		});

		installRouter(router);

		await createApp(Shell).mount('#app');

		expect(document.querySelector('.router-view-loading')).not.toBeNull();

		resolveLegacy?.({ default: LazyPage });
		await Promise.resolve();
		await Promise.resolve();
		await Promise.resolve();

		expect(
			document.querySelector('[data-testid="legacy-lazy-page"]')?.textContent
		).toBe('Legacy lazy page');
	});

	it('renders a named route outlet', async () => {
		const MainPage = define({
			script: () => ({}),
			template: () =>
				CreateElementNode({
					[EFFUSE_NODE]: true,
					tag: 'section',
					props: { 'data-testid': 'main-page' },
					children: ['Main page'],
				}),
		});
		const SidebarPage = define({
			script: () => ({}),
			template: () =>
				CreateElementNode({
					[EFFUSE_NODE]: true,
					tag: 'aside',
					props: { 'data-testid': 'sidebar-page' },
					children: ['Sidebar page'],
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
							props: { name: 'sidebar' },
							portals: null,
						}),
					],
				}),
		});

		const router = createRouter({
			history: createMemoryHistory('/dashboard'),
			routes: [
				{
					path: '/dashboard',
					name: 'dashboard',
					components: {
						default: MainPage,
						sidebar: SidebarPage,
					},
				},
			],
		});

		installRouter(router);

		await createApp(Shell).mount('#app');
		await Promise.resolve();
		await Promise.resolve();

		expect(
			document.querySelector('[data-testid="sidebar-page"]')?.textContent
		).toBe('Sidebar page');
		expect(document.querySelector('[data-testid="main-page"]')).toBeNull();
	});

	it('renders an explicit route override', async () => {
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
		const PreviewPage = define({
			script: () => ({}),
			template: () =>
				CreateElementNode({
					[EFFUSE_NODE]: true,
					tag: 'section',
					props: { 'data-testid': 'preview-page' },
					children: ['Preview page'],
				}),
		});

		const router = createRouter({
			history: createMemoryHistory('/'),
			routes: [
				{ path: '/', name: 'home', component: HomePage },
				{ path: '/preview', name: 'preview', component: PreviewPage },
			],
		});
		const previewRoute = router.resolve('/preview');

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
							props: { route: previewRoute },
							portals: null,
						}),
					],
				}),
		});

		installRouter(router);

		await createApp(Shell).mount('#app');
		await Promise.resolve();
		await Promise.resolve();

		expect(
			document.querySelector('[data-testid="preview-page"]')?.textContent
		).toBe('Preview page');
		expect(document.querySelector('[data-testid="home-page"]')).toBeNull();
	});

	it('renders resolved route components through a custom slot', async () => {
		const DetailsPage = define({
			script: () => ({}),
			template: () =>
				CreateElementNode({
					[EFFUSE_NODE]: true,
					tag: 'section',
					props: { 'data-testid': 'details-page' },
					children: ['Details page'],
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
							props: {
								slot: (_component, route, props) =>
									CreateElementNode({
										[EFFUSE_NODE]: true,
										tag: 'p',
										props: { 'data-testid': 'route-slot' },
										children: [
											route.name ?? 'route',
											':',
											String(props.id),
										],
									}),
							},
							portals: null,
						}),
					],
				}),
		});

		const router = createRouter({
			history: createMemoryHistory('/users/42'),
			routes: [
				{
					path: '/users/:id',
					name: 'user',
					component: DetailsPage,
					props: true,
				},
			],
		});

		installRouter(router);

		await createApp(Shell).mount('#app');
		await Promise.resolve();
		await Promise.resolve();

		expect(document.querySelector('[data-testid="route-slot"]')?.textContent).toBe(
			'user:42'
		);
		expect(document.querySelector('[data-testid="details-page"]')).toBeNull();
	});

	it('passes function route components to slots without executing them first', async () => {
		let renderCount = 0;
		const FunctionPage = () => {
			renderCount += 1;
			return CreateElementNode({
				[EFFUSE_NODE]: true,
				tag: 'section',
				props: { 'data-testid': 'function-page' },
				children: ['Function page'],
			});
		};

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
							props: {
								slot: (_component, route) =>
									CreateElementNode({
										[EFFUSE_NODE]: true,
										tag: 'p',
										props: { 'data-testid': 'route-slot' },
										children: ['slotted ', route.name ?? 'route'],
									}),
							},
							portals: null,
						}),
					],
				}),
		});

		const router = createRouter({
			history: createMemoryHistory('/function'),
			routes: [
				{
					path: '/function',
					name: 'function',
					component: FunctionPage,
				},
			],
		});

		installRouter(router);

		await createApp(Shell).mount('#app');
		await Promise.resolve();
		await Promise.resolve();

		expect(document.querySelector('[data-testid="route-slot"]')?.textContent).toBe(
			'slotted function'
		);
		expect(document.querySelector('[data-testid="function-page"]')).toBeNull();
		expect(renderCount).toBe(0);
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

		await router.push('/');
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
		await vi.waitFor(() => {
			expect(window.location.pathname).toBe('/layers');
		});

		expect(document.querySelector('[data-testid="layers-page"]')).not.toBeNull();
		expect(document.querySelector('[data-testid="server-page"]')).toBeNull();

		await mounted.unmount();
	});
});
