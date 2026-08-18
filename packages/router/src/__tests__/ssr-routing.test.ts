/**
 * MIT License
 *
 * Copyright (c) 2025 Chris M. Perez
 */

import { describe, expect, it } from 'vitest';
import {
	createServerApp,
	define,
	CreateElementNode,
	EFFUSE_NODE,
	getServerRenderUrl,
} from '@effuse/core';
import { Effect, SubscriptionRef } from 'effect';
import {
	createRouter,
	createWebHistory,
	createMemoryHistory,
	defineRoutes,
} from '../index.js';

const routes = defineRoutes([
	{ path: '/', name: 'home', component: {} as never },
	{ path: '/layers', name: 'layers', component: {} as never },
]);

/** Render `url`, running `probe` inside the render, and return what it saw. */
const duringRender = async <T>(
	url: string,
	probe: () => T
): Promise<T> => {
	let seen!: T;
	const Root = define({
		script: () => {
			seen = probe();
			return {};
		},
		template: () =>
			CreateElementNode({
				[EFFUSE_NODE]: true,
				tag: 'div',
				props: {},
				children: ['x'] as never,
			}),
	}) as never;
	await createServerApp(Root).renderToString(url);
	return seen;
};

const resolvedName = (): string | undefined => {
	const router = createRouter({ history: createWebHistory(), routes });
	return Effect.runSync(SubscriptionRef.get(router.currentRoute)).name;
};

describe('web history during a server render', () => {
	it('reports the URL being rendered, not "/"', async () => {
		// Off-browser this returned a hardcoded '/', so every server-rendered
		// request resolved the root route.
		expect(await duringRender('/layers', () => getServerRenderUrl())).toBe(
			'/layers'
		);
	});

	it('keeps the query string', async () => {
		expect(await duringRender('/layers?x=1', () => getServerRenderUrl())).toBe(
			'/layers?x=1'
		);
	});

	it('resolves the requested route', async () => {
		expect(await duringRender('/layers', resolvedName)).toBe('layers');
	});

	it('still resolves the root route for /', async () => {
		expect(await duringRender('/', resolvedName)).toBe('home');
	});

	it('exposes the query to the resolved route', async () => {
		const query = await duringRender('/layers?x=1&y=2', () => {
			const router = createRouter({ history: createWebHistory(), routes });
			return Effect.runSync(SubscriptionRef.get(router.currentRoute)).query;
		});

		expect(query).toEqual({ x: '1', y: '2' });
	});

	it('does not leak between concurrent renders', async () => {
		// The context is AsyncLocalStorage-scoped, so two renders in flight at
		// once must not observe each other's URL.
		const [a, b] = await Promise.all([
			duringRender('/layers', () => getServerRenderUrl()),
			duringRender('/', () => getServerRenderUrl()),
		]);

		expect(a).toBe('/layers');
		expect(b).toBe('/');
	});
});

describe('unchanged behaviour', () => {
	it('reports "/" outside a server render', () => {
		expect(getServerRenderUrl()).toBeNull();
		expect(createWebHistory().getCurrentPath()).toBe('/');
	});

	it('leaves memory history alone', () => {
		const router = createRouter({
			history: createMemoryHistory('/layers?x=1'),
			routes,
		});
		const route = Effect.runSync(SubscriptionRef.get(router.currentRoute));

		expect(route.name).toBe('layers');
		expect(route.query).toEqual({ x: '1' });
	});
});
