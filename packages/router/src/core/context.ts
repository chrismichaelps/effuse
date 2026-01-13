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

import { signal, type Signal } from '@effuse/core';
import type { Route } from './route.js';

export const ROUTER_KEY = Symbol.for('effuse.router');
export const ROUTE_KEY = Symbol.for('effuse.route');
export const DEPTH_KEY = Symbol.for('effuse.router.depth');

const contextMap = new Map<symbol, unknown>();

let globalRouteSignal: Signal<Route> | null = null;

// eslint-disable-next-line @typescript-eslint/no-unnecessary-type-parameters
export const provide = <T>(key: symbol, value: T): void => {
	contextMap.set(key, value);
};

// eslint-disable-next-line @typescript-eslint/no-unnecessary-type-parameters
export const inject = <T>(key: symbol): T | undefined => {
	return contextMap.get(key) as T | undefined;
};

export const injectWithDefault = <T>(key: symbol, defaultValue: T): T => {
	const value = contextMap.get(key);
	return (value !== undefined ? value : defaultValue) as T;
};

export const clearContext = (): void => {
	contextMap.clear();
	globalRouteSignal = null;
};

export const injectRouter = (): unknown => inject(ROUTER_KEY);

export const injectRoute = (): Signal<Route> | undefined =>
	inject<Signal<Route>>(ROUTE_KEY);

export const injectDepth = (): number =>
	injectWithDefault<number>(DEPTH_KEY, 0);

export const provideRouter = (router: unknown): void => {
	provide(ROUTER_KEY, router);
};

export const provideRoute = (route: Signal<Route>): void => {
	provide(ROUTE_KEY, route);
};

export const provideDepth = (depth: number): void => {
	provide(DEPTH_KEY, depth);
};

export const createRouteSignal = (initialRoute: Route): Signal<Route> => {
	globalRouteSignal = signal<Route>(initialRoute);
	provideRoute(globalRouteSignal);
	return globalRouteSignal;
};

export const getRouteSignal = (): Signal<Route> | null => globalRouteSignal;

export const updateRouteSignal = (route: Route): void => {
	if (globalRouteSignal) {
		globalRouteSignal.value = route;
	}
};
