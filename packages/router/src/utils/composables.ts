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

import { Effect } from 'effect';
import { markRaw } from '@effuse/core';
import { getGlobalRouter, type RouterInstance } from '../core/router.js';
import type { Route, RouteLocation } from '../core/route.js';
import type { NavigationFailure } from '../navigation/errors.js';

// Access global router instance
export const useRouter = (): RouterInstance => {
	const router = getGlobalRouter();
	if (!router) {
		throw new Error('Router not installed. Call installRouter() first.');
	}
	return markRaw(router);
};

// Access current route state
export const useRoute = (): Route => {
	const routeSignal = getRouteSignal();
	if (!routeSignal) {
		throw new Error('Router not installed. Call installRouter() first.');
	}

	return new Proxy(routeSignal.value, {
		get(_target, prop, receiver) {
			return Reflect.get(
				routeSignal.value,
				prop,
				receiver
			) as Route[keyof Route];
		},
		ownKeys(_target) {
			return Reflect.ownKeys(routeSignal.value);
		},
		getOwnPropertyDescriptor(_target, prop) {
			return Reflect.getOwnPropertyDescriptor(routeSignal.value, prop);
		},
	});
};

import { effect } from '@effuse/core';
import { getRouteSignal } from '../core/context.js';

// Observe route changes
export const onRouteChange = (
	callback: (route: Route) => void
): (() => void) => {
	const routeSignal = getRouteSignal();

	if (!routeSignal) {
		return () => {};
	}

	let lastFullPath = routeSignal.value.fullPath;

	const { stop } = effect(() => {
		const route = routeSignal.value;
		const currentFullPath = route.fullPath;

		if (currentFullPath !== lastFullPath) {
			lastFullPath = currentFullPath;
			callback(route);
		}
	});

	return stop;
};

// Navigate to specified location
export const navigateTo = (
	to: RouteLocation,
	options?: { replace?: boolean }
): Promise<Route | NavigationFailure> => {
	const router = useRouter();
	const navEffect = options?.replace ? router.replace(to) : router.push(to);
	return Effect.runPromise(navEffect);
};

// Navigate back in history
export const goBack = (): void => {
	const router = useRouter();
	Effect.runSync(router.back);
};

// Navigate forward in history
export const goForward = (): void => {
	const router = useRouter();
	Effect.runSync(router.forward);
};

// Verify active route status
export const isActiveRoute = (
	path: string,
	exact: boolean = false
): boolean => {
	const route = useRoute();
	if (exact) {
		return route.path === path;
	}
	return route.path.startsWith(path);
};

// Calculate dynamic link classes
export const getLinkClasses = (
	to: string,
	options?: {
		activeClass?: string;
		exactActiveClass?: string;
		inactiveClass?: string;
	}
): string => {
	const route = useRoute();
	const isExactActive = route.path === to;
	const isActive = route.path.startsWith(to);

	const classes: string[] = [];

	if (isExactActive && options?.exactActiveClass) {
		classes.push(options.exactActiveClass);
	} else if (isActive && options?.activeClass) {
		classes.push(options.activeClass);
	} else if (!isActive && options?.inactiveClass) {
		classes.push(options.inactiveClass);
	}

	return classes.join(' ');
};

// Build navigation guard for route exit
export const onBeforeRouteLeave = (
	guard: (to: Route, from: Route) => boolean | undefined
): (() => void) => {
	const router = useRouter();
	const currentPath = useRoute().path;

	return router.beforeEach((to, from) =>
		Effect.sync(() => {
			if (from.path !== currentPath) {
				return { _tag: 'NavigationAllowed' as const };
			}

			const result = guard(to as Route, from);
			if (result === false) {
				return {
					_tag: 'NavigationCancelled' as const,
					reason: 'Route leave blocked',
				};
			}
			return { _tag: 'NavigationAllowed' as const };
		})
	);
};

// Build navigation guard for route update
export const onBeforeRouteUpdate = (
	guard: (to: Route, from: Route) => boolean | undefined
): (() => void) => {
	const router = useRouter();

	return router.beforeEach((to, from) =>
		Effect.sync(() => {
			const toMatched = to.matched[to.matched.length - 1];
			const fromMatched = from.matched[from.matched.length - 1];

			if (toMatched?.path !== fromMatched?.path) {
				return { _tag: 'NavigationAllowed' as const };
			}

			if (to.fullPath !== from.fullPath) {
				const result = guard(to as Route, from);
				if (result === false) {
					return {
						_tag: 'NavigationCancelled' as const,
						reason: 'Route update blocked',
					};
				}
			}

			return { _tag: 'NavigationAllowed' as const };
		})
	);
};

// Initialize data fetch on route change
export const useFetchOnRouteChange = <T>(
	fetcher: (route: Route) => Effect.Effect<T>,
	onData: (data: T) => void,
	onError: (error: unknown) => void = () => {}
): (() => void) => {
	return onRouteChange((route) => {
		Effect.runPromise(fetcher(route)).then(onData).catch(onError);
	});
};

// Build reactive route data loader
export const createRouteDataLoader = <T>(
	loaders: Record<string, (route: Route) => Effect.Effect<T>>
): ((route: Route) => Effect.Effect<T | null>) => {
	return (route: Route) => {
		const routeName = route.name;
		if (routeName && loaders[routeName]) {
			return loaders[routeName](route);
		}
		return Effect.succeed(null);
	};
};
