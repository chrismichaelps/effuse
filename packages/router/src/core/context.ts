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

import {
	createRuntimeContext,
	runWithRouterContext as runWithCoreRouterContext,
	signal,
	type Signal,
} from '@effuse/core';
import type { Route } from './route.js';

export const ROUTER_KEY = Symbol.for('effuse.router');
export const ROUTE_KEY = Symbol.for('effuse.route');
export const DEPTH_KEY = Symbol.for('effuse.router.depth');

interface RouterContextInstallation {
	readonly router: object;
	readonly route: Signal<Route>;
}
interface RouterContextRuntimeState {
	readonly contextMap: Map<symbol, unknown>;
	globalRouteSignal: Signal<Route> | null;
	readonly routerRouteSignals: WeakMap<object, Signal<Route>>;
	readonly installations: RouterContextInstallation[];
	base: {
		readonly router: unknown;
		readonly route: unknown;
		readonly globalRouteSignal: Signal<Route> | null;
	} | null;
}

const ROUTER_CONTEXT_RUNTIME_KEY = Symbol.for(
	'effuse.router.context-runtime.v1'
);
const routerContextRuntime = (() => {
	const shared = globalThis as Record<PropertyKey, unknown>;
	const existing = shared[ROUTER_CONTEXT_RUNTIME_KEY] as
		| RouterContextRuntimeState
		| undefined;
	if (existing) return existing;
	const created: RouterContextRuntimeState = {
		contextMap: new Map(),
		globalRouteSignal: null,
		routerRouteSignals: new WeakMap(),
		installations: [],
		base: null,
	};
	Object.defineProperty(shared, ROUTER_CONTEXT_RUNTIME_KEY, { value: created });
	return created;
})();
const routerRequestContext = createRuntimeContext<RouterContextInstallation>();

// eslint-disable-next-line @typescript-eslint/no-unnecessary-type-parameters
export const provide = <T>(key: symbol, value: T): void => {
	routerContextRuntime.contextMap.set(key, value);
};

// eslint-disable-next-line @typescript-eslint/no-unnecessary-type-parameters
export const inject = <T>(key: symbol): T | undefined => {
	const requestContext = routerRequestContext.current();
	if (key === ROUTER_KEY && requestContext) {
		return requestContext.router as T;
	}
	if (key === ROUTE_KEY && requestContext) {
		return requestContext.route as T;
	}
	return routerContextRuntime.contextMap.get(key) as T | undefined;
};

export const injectWithDefault = <T>(key: symbol, defaultValue: T): T => {
	const value = inject<T>(key);
	return value !== undefined ? value : defaultValue;
};

export const clearContext = (): void => {
	routerContextRuntime.contextMap.clear();
	routerContextRuntime.globalRouteSignal = null;
	routerContextRuntime.installations.length = 0;
	routerContextRuntime.base = null;
};

export const injectRouter = (): unknown => inject(ROUTER_KEY);

export const injectRoute = (): Signal<Route> | undefined =>
	inject<Signal<Route>>(ROUTE_KEY);

export const provideRouter = (router: unknown): void => {
	provide(ROUTER_KEY, router);
};

export const provideRoute = (route: Signal<Route>): void => {
	provide(ROUTE_KEY, route);
};

export const createRouteSignal = (
	router: object,
	initialRoute: Route
): Signal<Route> => {
	const sig = signal<Route>(initialRoute);
	routerContextRuntime.routerRouteSignals.set(router, sig);
	provideRoute(sig);
	routerContextRuntime.globalRouteSignal = sig;
	return sig;
};

export const getOrCreateRouteSignal = (
	router: object,
	initialRoute: Route
): Signal<Route> => {
	const existing = routerContextRuntime.routerRouteSignals.get(router);
	if (existing) return existing;
	const route = signal<Route>(initialRoute);
	routerContextRuntime.routerRouteSignals.set(router, route);
	return route;
};

export const runWithRouterRouteContext = <T>(
	router: object,
	route: Signal<Route>,
	fn: () => T
): T =>
	routerRequestContext.run({ router, route }, () =>
		runWithCoreRouterContext(router, fn)
	);

export const installRouterContext = (
	router: object,
	initialRoute: Route
): (() => void) => {
	if (routerContextRuntime.installations.length === 0) {
		routerContextRuntime.base = {
			router: routerContextRuntime.contextMap.get(ROUTER_KEY),
			route: routerContextRuntime.contextMap.get(ROUTE_KEY),
			globalRouteSignal: routerContextRuntime.globalRouteSignal,
		};
	}
	provideRouter(router);
	const route = createRouteSignal(router, initialRoute);
	const installation = { router, route };
	routerContextRuntime.installations.push(installation);

	let removed = false;
	return () => {
		if (removed) return;
		removed = true;
		const index = routerContextRuntime.installations.indexOf(installation);
		if (index >= 0) routerContextRuntime.installations.splice(index, 1);
		routerContextRuntime.routerRouteSignals.delete(router);
		const active = routerContextRuntime.installations.at(-1);
		if (active) {
			routerContextRuntime.routerRouteSignals.set(active.router, active.route);
			routerContextRuntime.contextMap.set(ROUTER_KEY, active.router);
			routerContextRuntime.contextMap.set(ROUTE_KEY, active.route);
			routerContextRuntime.globalRouteSignal = active.route;
			return;
		}
		const base = routerContextRuntime.base;
		if (base?.router === undefined)
			routerContextRuntime.contextMap.delete(ROUTER_KEY);
		else routerContextRuntime.contextMap.set(ROUTER_KEY, base.router);
		if (base?.route === undefined)
			routerContextRuntime.contextMap.delete(ROUTE_KEY);
		else routerContextRuntime.contextMap.set(ROUTE_KEY, base.route);
		routerContextRuntime.globalRouteSignal = base?.globalRouteSignal ?? null;
		routerContextRuntime.base = null;
	};
};

export const getRouteSignal = (): Signal<Route> | null => {
	const requestContext = routerRequestContext.current();
	if (requestContext) return requestContext.route;
	const router = injectRouter();
	if (router && typeof router === 'object') {
		const scoped = routerContextRuntime.routerRouteSignals.get(router);
		if (scoped) return scoped;
	}
	return routerContextRuntime.globalRouteSignal;
};

export const updateRouteSignal = (router: object, route: Route): void => {
	const scoped = routerContextRuntime.routerRouteSignals.get(router);
	if (scoped) {
		scoped.value = route;
	} else if (routerContextRuntime.globalRouteSignal) {
		routerContextRuntime.globalRouteSignal.value = route;
	}
};
