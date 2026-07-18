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

import { Effect, SubscriptionRef, Predicate } from 'effect';
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
	finalizeNormalizedRoutes,
	resolveRoute,
	createRoute,
	parseUrl,
} from './route.js';
import {
	type NavigationGuard,
	type AfterEachHook,
	createGuardRegistry,
	runGuards,
	runAfterHooks,
	NavigationResult,
} from '../navigation/guards.js';
import { NavigationFailure } from '../navigation/errors.js';
import { loadRouterConfig } from './RouterConfig.js';
import { updateRouteSignal, installRouterContext } from './context.js';

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

	readonly push: (to: RouteLocation) => Promise<Route | NavigationFailure>;
	readonly replace: (to: RouteLocation) => Promise<Route | NavigationFailure>;
	readonly back: () => void;
	readonly forward: () => void;
	readonly go: (delta: number) => void;

	readonly beforeEach: (guard: NavigationGuard) => () => void;
	readonly beforeResolve: (guard: NavigationGuard) => () => void;
	readonly afterEach: (hook: AfterEachHook) => () => void;

	readonly resolve: (to: RouteLocation) => ResolvedRoute;
	readonly hasRoute: (name: string) => boolean;
	readonly addRoute: (route: RouteRecord, parentName?: string) => void;
	readonly removeRoute: (name: string) => void;
	readonly getRoutes: () => readonly NormalizedRouteRecord[];

	readonly start: () => () => void;
	readonly isReady: boolean;
}

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
		opts: NavigateOptions = {},
		redirectPaths: readonly string[] = []
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
						canonicalRouteGroups: [],
						aliasRouteGroups: [],
						routeGroups: [],
						name: undefined,
						meta: {},
					},
					from as ResolvedRoute
				);
			}

			if (redirectPaths.includes(resolved.fullPath)) {
				return NavigationFailure.redirectLoop(
					resolved,
					from as ResolvedRoute,
					[...redirectPaths, resolved.fullPath]
				);
			}
			const nextRedirectPaths = [...redirectPaths, resolved.fullPath];

			if (resolved.fullPath === from.fullPath) {
				return NavigationFailure.duplicated(resolved, from as ResolvedRoute);
			}

			const lastMatched = resolved.matched[resolved.matched.length - 1];
			if (
				Predicate.isNotNullable(lastMatched) &&
				Predicate.isNotNullable(lastMatched.redirect)
			) {
				return yield* navigate(lastMatched.redirect, opts, nextRedirectPaths);
			}

			const beforeEachResult = yield* runGuards(
				guards.beforeEach,
				resolved,
				from
			);
			if (!NavigationResult.isAllowed(beforeEachResult)) {
				if (beforeEachResult._tag === 'NavigationRedirected') {
					return yield* navigate(
						beforeEachResult.to,
						opts,
						nextRedirectPaths
					);
				}
				if (beforeEachResult._tag === 'NavigationFailed') {
					return NavigationFailure.guardFailed(
						resolved,
						from as ResolvedRoute,
						beforeEachResult.error
					);
				}
				return NavigationFailure.guardCancelled(
					resolved,
					from as ResolvedRoute,
					beforeEachResult.reason
				);
			}

			// Run per-route beforeEnter guards
			const beforeEnterGuards = resolved.matched
				.map((r) => (r as unknown as { beforeEnter?: NavigationGuard }).beforeEnter)
				.filter((g): g is NavigationGuard => g !== undefined);
			const beforeEnterResult = yield* runGuards(
				beforeEnterGuards,
				resolved,
				from
			);
			if (!NavigationResult.isAllowed(beforeEnterResult)) {
				if (beforeEnterResult._tag === 'NavigationRedirected') {
					return yield* navigate(
						beforeEnterResult.to,
						opts,
						nextRedirectPaths
					);
				}
				if (beforeEnterResult._tag === 'NavigationFailed') {
					return NavigationFailure.guardFailed(
						resolved,
						from as ResolvedRoute,
						beforeEnterResult.error
					);
				}
				return NavigationFailure.guardCancelled(
					resolved,
					from as ResolvedRoute,
					beforeEnterResult.reason
				);
			}

			const beforeResolveResult = yield* runGuards(
				guards.beforeResolve,
				resolved,
				from
			);
			if (!NavigationResult.isAllowed(beforeResolveResult)) {
				if (beforeResolveResult._tag === 'NavigationRedirected') {
					return yield* navigate(
						beforeResolveResult.to,
						opts,
						nextRedirectPaths
					);
				}
				if (beforeResolveResult._tag === 'NavigationFailed') {
					return NavigationFailure.guardFailed(
						resolved,
						from as ResolvedRoute,
						beforeResolveResult.error
					);
				}
				return NavigationFailure.guardCancelled(
					resolved,
					from as ResolvedRoute,
					beforeResolveResult.reason
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

			updateCurrentRouteSignal(newRoute);

			if (typeof window !== 'undefined') {
				window.dispatchEvent(
					new CustomEvent('effuse:route-change', { detail: newRoute })
				);
			}

			Effect.runSync(runAfterHooks(guards.afterEach, newRoute, from));

			if (config.scrollToTop && !opts.replace && typeof window !== 'undefined') {
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

	const updateCurrentRouteSignal = (route: Route): void => {
		updateRouteSignal(router, route);
	};

	const router: RouterInstance = {
		currentRoute: routeRef,
		get routes() {
			return normalizedRoutes;
		},
		options,

		push: (to) => Effect.runPromise(navigate(to, { replace: false })),
		replace: (to) => Effect.runPromise(navigate(to, { replace: true })),
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

		hasRoute: (name) =>
			normalizedRoutes.some(
				(r) => r.name === name && r.aliasOf === undefined
			),

		addRoute: (route, parentName) => {
			const parent = parentName
				? normalizedRoutes.find(
						(r) => r.name === parentName && r.aliasOf === undefined
					)
				: undefined;
			const parentAliases = parent
				? normalizedRoutes.filter((candidate) => candidate.aliasOf === parent)
				: [];
			const newRoutes = normalizeRoutes([route], parent, parentAliases);
			normalizedRoutes = finalizeNormalizedRoutes([
				...normalizedRoutes,
				...newRoutes,
			]);
		},

		removeRoute: (name) => {
			const target = normalizedRoutes.find(
				(r) => r.name === name && r.aliasOf === undefined
			);
			if (!target) return;

			const removedCanonicalRoutes = new Set<NormalizedRouteRecord>([target]);
			for (const route of normalizedRoutes) {
				if (route.aliasOf) continue;
				let current = route.parent;
				while (current) {
					if (current === target) {
						removedCanonicalRoutes.add(route);
						break;
					}
					current = current.parent;
				}
			}

			normalizedRoutes = normalizedRoutes.filter(
				(route) =>
					!removedCanonicalRoutes.has(route.aliasOf ?? route)
			);
		},

		getRoutes: () => normalizedRoutes,

		start: () => {
			if (isStarted) return () => {};
			isStarted = true;

			const syncRoute = () => {
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
				updateCurrentRouteSignal(newRoute);
			};

			const cleanupHistory = history.listen(syncRoute);
			syncRoute();

			let stopped = false;
			return () => {
				if (stopped) return;
				stopped = true;
				cleanupHistory();
				isStarted = false;
			};
		},

		get isReady() {
			return isStarted;
		},
	};

	return router;
};

let globalRouter: RouterInstance | null = null;
const routerInstallations: Array<{ readonly router: RouterInstance }> = [];

export const setGlobalRouter = (router: RouterInstance): (() => void) => {
	const installation = { router };
	routerInstallations.push(installation);
	globalRouter = router;
	let removed = false;
	return () => {
		if (removed) return;
		removed = true;
		const index = routerInstallations.indexOf(installation);
		if (index >= 0) routerInstallations.splice(index, 1);
		globalRouter = routerInstallations.at(-1)?.router ?? null;
	};
};

export const getGlobalRouter = (): RouterInstance | null => globalRouter;

export const installRouter = (
	router: RouterInstance
): RouterInstance & { cleanup: () => void } => {
	const restoreGlobalRouter = setGlobalRouter(router);
	const restoreCoreRouter = setCoreGlobalRouter(router);

	const initialRoute = Effect.runSync(SubscriptionRef.get(router.currentRoute));
	const restoreContext = installRouterContext(router, initialRoute);

	const stopRouter = router.start();
	let cleanedUp = false;
	const cleanup = (): void => {
		if (cleanedUp) return;
		cleanedUp = true;
		stopRouter();
		restoreContext();
		restoreCoreRouter();
		restoreGlobalRouter();
	};
	return Object.assign(router, { cleanup });
};
