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

import { Predicate } from 'effect';
import { markRaw, watchEffect, computed } from '@effuse/core';
import { getGlobalRouter, type RouterInstance } from '../core/router.js';
import type { Route, RouteLocation } from '../core/route.js';
import type { NavigationFailure } from '../navigation/errors.js';
import { RouterNotInstalledError } from '../errors.js';
import { getRouteSignal } from '../core/context.js';

export const useRouter = (): RouterInstance => {
	const router = getGlobalRouter();
	if (!router) {
		throw new RouterNotInstalledError({ operation: 'useRouter' });
	}
	return markRaw(router);
};

export const useRoute = (): Route => {
	const routeSignal = getRouteSignal();
	if (!routeSignal) {
		throw new RouterNotInstalledError({ operation: 'useRoute' });
	}

	// Create stable reactive proxies so accessing .params only subscribes to param changes
	const path = computed(() => routeSignal.value.path);
	const fullPath = computed(() => routeSignal.value.fullPath);
	const params = computed(() => routeSignal.value.params);
	const query = computed(() => routeSignal.value.query);
	const hash = computed(() => routeSignal.value.hash);
	const matched = computed(() => routeSignal.value.matched);
	const name = computed(() => routeSignal.value.name);
	const meta = computed(() => routeSignal.value.meta);

	return new Proxy({} as Route, {
		get(_target, prop) {
			switch (prop) {
				case 'path':
					return path.value;
				case 'fullPath':
					return fullPath.value;
				case 'params':
					return params.value;
				case 'query':
					return query.value;
				case 'hash':
					return hash.value;
				case 'matched':
					return matched.value;
				case 'name':
					return name.value;
				case 'meta':
					return meta.value;
				default:
					return undefined;
			}
		},
		ownKeys() {
			return [
				'path',
				'fullPath',
				'params',
				'query',
				'hash',
				'matched',
				'name',
				'meta',
			];
		},
		getOwnPropertyDescriptor(_target, prop) {
			if (
				[
					'path',
					'fullPath',
					'params',
					'query',
					'hash',
					'matched',
					'name',
					'meta',
				].includes(prop as string)
			) {
				return {
					enumerable: true,
					configurable: true,
				};
			}
			return undefined;
		},
	});
};

export const onRouteChange = (
	callback: (route: Route) => void
): (() => void) => {
	const routeSignal = getRouteSignal();

	if (!routeSignal) {
		return () => {};
	}

	let lastFullPath = routeSignal.value.fullPath;

	const { stop } = watchEffect(() => {
		const route = routeSignal.value;
		const currentFullPath = route.fullPath;

		if (currentFullPath !== lastFullPath) {
			lastFullPath = currentFullPath;
			callback(route);
		}
	});

	return stop;
};

export const navigateTo = (
	to: RouteLocation,
	options?: { replace?: boolean }
): Route | NavigationFailure => {
	const router = useRouter();
	const shouldReplace =
		Predicate.isNotNullable(options) && options.replace === true;
	return shouldReplace ? router.replace(to) : router.push(to);
};

export const goBack = (): void => {
	const router = useRouter();
	router.back();
};

export const goForward = (): void => {
	const router = useRouter();
	router.forward();
};

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

	if (
		isExactActive &&
		Predicate.isNotNullable(options) &&
		Predicate.isNotNullable(options.exactActiveClass)
	) {
		classes.push(options.exactActiveClass);
	} else if (
		isActive &&
		Predicate.isNotNullable(options) &&
		Predicate.isNotNullable(options.activeClass)
	) {
		classes.push(options.activeClass);
	} else if (
		!isActive &&
		Predicate.isNotNullable(options) &&
		Predicate.isNotNullable(options.inactiveClass)
	) {
		classes.push(options.inactiveClass);
	}

	return classes.join(' ');
};
