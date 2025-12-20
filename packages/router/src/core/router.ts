/**
 * MIT License
 *
 * Copyright (c) 2025 Chris M. Perez
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 */

import { Effect, SubscriptionRef } from 'effect';
import { setGlobalRouter as setCoreGlobalRouter } from '@effuse/core';
import type { RouterHistory } from './history.js';
import { createWebHistory, createHashHistory } from './history.js';
import {
	type Route,
	type RouteRecord,
	type RouteLocation,
	type ResolvedRoute,
	type NormalizedRouteRecord,
	normalizeRoutes,
	resolveRoute,
	createRoute,
	parseUrl,
} from './route.js';
import {
	type NavigationGuardEffect,
	createGuardRegistry,
	runGuards,
	runAfterHooks,
	NavigationResult,
} from '../navigation/guards.js';
import { NavigationFailure } from '../navigation/errors.js';
import { loadRouterConfig } from './RouterConfig.js';
import {
	updateRouteSignal,
	provideRouter,
	createRouteSignal,
	provideDepth,
} from './context.js';

let cachedConfig: {
	base: string;
	historyMode: 'web' | 'hash';
	scrollToTop: boolean;
} | null = null;

const getConfig = () => {
	if (!cachedConfig) {
		cachedConfig = Effect.runSync(
			loadRouterConfig.pipe(
				Effect.orElseSucceed(() => ({
					base: '',
					historyMode: 'web' as const,
					scrollToTop: true,
				}))
			)
		);
	}
	return cachedConfig;
};

export type ScrollBehavior = (
	to: Route,
	from: Route,
	savedPosition: { left: number; top: number } | null
) =>
	| {
			left?: number;
			top?: number;
			el?: string;
			behavior?: ScrollBehavior;
	  }
	| undefined;

export interface RouterOptions {
	readonly routes: readonly RouteRecord[];
	readonly history?: RouterHistory;
	readonly base?: string;
	readonly scrollBehavior?: ScrollBehavior;
}

export interface NavigateOptions {
	readonly replace?: boolean;
}

export interface RouterInstance {
	readonly currentRoute: SubscriptionRef.SubscriptionRef<Route>;
	readonly routes: readonly NormalizedRouteRecord[];
	readonly options: RouterOptions;

	readonly push: (to: RouteLocation) => Route | NavigationFailure;
	readonly replace: (to: RouteLocation) => Route | NavigationFailure;
	readonly back: () => void;
	readonly forward: () => void;
	readonly go: (delta: number) => void;

	readonly beforeEach: (guard: NavigationGuardEffect) => () => void;
	readonly beforeResolve: (guard: NavigationGuardEffect) => () => void;
	readonly afterEach: (
		hook: (to: Route, from: Route) => Effect.Effect<void>
	) => () => void;

	readonly resolve: (to: RouteLocation) => ResolvedRoute;
	readonly hasRoute: (name: string) => boolean;
	readonly addRoute: (route: RouteRecord, parentName?: string) => void;
	readonly removeRoute: (name: string) => void;
	readonly getRoutes: () => readonly NormalizedRouteRecord[];

	readonly start: () => () => void;
	readonly isReady: boolean;
}

// Build application router
export const createRouter = (options: RouterOptions): RouterInstance => {
	const config = getConfig();

	const history =
		options.history ??
		(config.historyMode === 'hash'
			? createHashHistory()
			: createWebHistory(options.base ?? config.base));

	let normalizedRoutes = normalizeRoutes(options.routes);
	const guards = createGuardRegistry();
	let isStarted = false;

	const initialPath = history.getCurrentPath();
	const { pathname, query, hash } = parseUrl(initialPath);
	const initialResolved = resolveRoute(pathname, normalizedRoutes);
	const initialRoute = createRoute({
		...initialResolved,
		query,
		hash,
		fullPath: initialPath,
	});

	const routeRef = Effect.runSync(SubscriptionRef.make(initialRoute));
	let navigationId = 0;

	const navigate = (
		to: RouteLocation,
		opts: NavigateOptions = {}
	): Effect.Effect<Route | NavigationFailure> =>
		Effect.gen(function* () {
			const currentNavId = ++navigationId;
			const from = yield* SubscriptionRef.get(routeRef);

			let resolved: ResolvedRoute;
			try {
				resolved = resolveRoute(to, normalizedRoutes, from);
			} catch {
				return NavigationFailure.aborted(
					{
						path: '',
						fullPath: '',
						params: {},
						query: {},
						hash: '',
						matched: [],
						name: undefined,
						meta: {},
					},
					from as ResolvedRoute
				);
			}

			if (resolved.fullPath === from.fullPath) {
				return NavigationFailure.duplicated(resolved, from as ResolvedRoute);
			}

			const lastMatched = resolved.matched[resolved.matched.length - 1];
			if (lastMatched?.redirect) {
				return yield* navigate(lastMatched.redirect, opts);
			}

			const beforeEachResult = yield* runGuards(
				guards.beforeEach,
				resolved,
				from
			);
			if (!NavigationResult.isAllowed(beforeEachResult)) {
				if (beforeEachResult._tag === 'NavigationRedirected') {
					return yield* navigate(beforeEachResult.to, opts);
				}
				return NavigationFailure.guardCancelled(
					resolved,
					from as ResolvedRoute,
					beforeEachResult._tag === 'NavigationCancelled'
						? beforeEachResult.reason
						: undefined
				);
			}

			const beforeResolveResult = yield* runGuards(
				guards.beforeResolve,
				resolved,
				from
			);
			if (!NavigationResult.isAllowed(beforeResolveResult)) {
				if (beforeResolveResult._tag === 'NavigationRedirected') {
					return yield* navigate(beforeResolveResult.to, opts);
				}
				return NavigationFailure.guardCancelled(
					resolved,
					from as ResolvedRoute
				);
			}

			if (currentNavId !== navigationId) {
				return NavigationFailure.aborted(resolved, from as ResolvedRoute);
			}

			const newRoute = createRoute({
				...resolved,
				query: resolved.query,
				hash: resolved.hash,
			});

			if (opts.replace) {
				history.replace(resolved.fullPath);
			} else {
				history.push(resolved.fullPath);
			}

			yield* SubscriptionRef.set(routeRef, newRoute);

			updateRouteSignal(newRoute);

			window.dispatchEvent(
				new CustomEvent('effuse:route-change', { detail: newRoute })
			);

			Effect.runFork(runAfterHooks(guards.afterEach, newRoute, from));

			if (config.scrollToTop && !opts.replace) {
				window.scrollTo(0, 0);
			}

			return newRoute;
		});

	const registerGuard = <T>(registry: T[], guard: T): (() => void) => {
		registry.push(guard);
		return () => {
			const index = registry.indexOf(guard);
			if (index > -1) registry.splice(index, 1);
		};
	};

	const router: RouterInstance = {
		currentRoute: routeRef,
		routes: normalizedRoutes,
		options,

		push: (to) => Effect.runSync(navigate(to, { replace: false })),
		replace: (to) => Effect.runSync(navigate(to, { replace: true })),
		back: () => {
			history.back();
		},
		forward: () => {
			history.forward();
		},
		go: (delta) => {
			history.go(delta);
		},

		beforeEach: (guard) => registerGuard(guards.beforeEach, guard),
		beforeResolve: (guard) => registerGuard(guards.beforeResolve, guard),
		afterEach: (hook) => registerGuard(guards.afterEach, hook),

		resolve: (to) => {
			const from = Effect.runSync(SubscriptionRef.get(routeRef));
			return resolveRoute(to, normalizedRoutes, from);
		},

		hasRoute: (name) => normalizedRoutes.some((r) => r.name === name),

		addRoute: (route, parentName) => {
			const parent = parentName
				? normalizedRoutes.find((r) => r.name === parentName)
				: undefined;
			const newRoutes = normalizeRoutes([route], parent);
			normalizedRoutes = [...normalizedRoutes, ...newRoutes];
		},

		removeRoute: (name) => {
			normalizedRoutes = normalizedRoutes.filter((r) => r.name !== name);
		},

		getRoutes: () => normalizedRoutes,

		start: () => {
			if (isStarted) return () => {};
			isStarted = true;

			const cleanup = history.listen(() => {
				const path = history.getCurrentPath();
				const { pathname, query, hash } = parseUrl(path);
				const resolved = resolveRoute(pathname, normalizedRoutes);
				const newRoute = createRoute({
					...resolved,
					query,
					hash,
					fullPath: path,
				});
				Effect.runSync(SubscriptionRef.set(routeRef, newRoute));

				updateRouteSignal(newRoute);
			});

			return cleanup;
		},

		get isReady() {
			return isStarted;
		},
	};

	return router;
};

let globalRouter: RouterInstance | null = null;

export const setGlobalRouter = (router: RouterInstance): void => {
	globalRouter = router;
};

export const getGlobalRouter = (): RouterInstance | null => globalRouter;

// Initialize router within application
export const installRouter = (router: RouterInstance): RouterInstance => {
	setGlobalRouter(router);
	setCoreGlobalRouter(router);
	provideRouter(router);

	const initialRoute = Effect.runSync(SubscriptionRef.get(router.currentRoute));
	createRouteSignal(initialRoute);

	provideDepth(0);

	router.start();
	return router;
};
