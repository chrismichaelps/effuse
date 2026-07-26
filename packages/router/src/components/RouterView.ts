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
import {
	define,
	watchEffect,
	type EffuseChild,
	type BlueprintDef,
	type Signal,
	EFFUSE_NODE,
	CreateElementNode,
	CreateBlueprintNode,
} from '@effuse/core';
import { getGlobalRouter } from '../core/router.js';
import { DEPTH_KEY, getRouteSignal } from '../core/context.js';
import {
	isLazyRouteComponent,
	type Route,
	type NormalizedRouteRecord,
	type RouteComponent,
	type LazyRouteComponent,
} from '../core/route.js';
import { InvalidRouterStateError } from '../errors.js';

const getMatchedComponent = (
	route: Route,
	depth: number,
	name: string
): RouteComponent | LazyRouteComponent | null => {
	const matched = route.matched[depth];
	if (!matched) return null;

	if (matched.components) {
		return matched.components[name] ?? null;
	}

	return name === 'default' ? (matched.component ?? null) : null;
};

/**
 * Resolves the props a matched route component receives.
 *
 * The route record's `props` option is the single source of truth for prop
 * injection; route params are never merged on top of it elsewhere:
 *
 * - absent or `true` — the route params are injected as props (default).
 * - `false` — nothing is injected; params remain available via `useRoute()`.
 * - object — exactly that object is injected; params are not auto-merged.
 * - function — exactly its return value is injected; the function receives
 *   `route`, so it can spread `route.params` explicitly when desired.
 */
const getComponentProps = (
	route: Route,
	matched: NormalizedRouteRecord | undefined
): Record<string, unknown> => {
	if (!Predicate.isNotNullable(matched)) return {};

	const option = matched.props;

	if (option === undefined || option === true) {
		return { ...route.params };
	}

	if (option === false) {
		return {};
	}

	if (Predicate.isFunction(option)) {
		return option(route);
	}

	return option;
};

const isBlueprintComponent = (component: unknown): component is BlueprintDef =>
	Predicate.isObject(component) &&
	Predicate.hasProperty(component, '_tag') &&
	(component as { readonly _tag?: unknown })._tag === 'Blueprint';

const isLazyRouteModule = (
	value: unknown
): value is { readonly default: RouteComponent } =>
	Predicate.isObject(value) &&
	Predicate.hasProperty(value, 'default') &&
	(Predicate.isFunction(value.default) || isBlueprintComponent(value.default));

const renderComponent = (
	component: RouteComponent,
	props: Record<string, unknown>
): EffuseChild => {
	if (isBlueprintComponent(component)) {
		return CreateBlueprintNode({
			[EFFUSE_NODE]: true,
			blueprint: component,
			props: { ...props },
			portals: null,
		});
	}

	if (Predicate.isFunction(component)) {
		return component({ ...props });
	}

	return component as EffuseChild;
};

const renderRouteContent = (
	component: RouteComponent,
	route: Route,
	props: Record<string, unknown>,
	slot: RouterViewProps['slot'] | undefined
): EffuseChild => {
	if (Predicate.isNotNullable(slot)) {
		return slot(component, route, props);
	}

	return renderComponent(component, props);
};

const createRouteContentNode = (
	depth: number,
	viewName: string,
	route: Route,
	rendered: EffuseChild
): EffuseChild =>
	CreateElementNode({
		[EFFUSE_NODE]: true,
		tag: 'div',
		key: createViewIdentity(depth, viewName, route),
		props: {
			class: 'router-view-content',
		},
		children: [rendered],
	});

const createDefaultLoadingView = (): EffuseChild =>
	CreateElementNode({
		[EFFUSE_NODE]: true,
		tag: 'div',
		props: { class: 'router-view-loading' },
		children: [],
	});

const createDefaultErrorView = (): EffuseChild =>
	CreateElementNode({
		[EFFUSE_NODE]: true,
		tag: 'div',
		props: { class: 'router-view-error' },
		children: ['Failed to load component'],
	});

const renderFallback = (
	fallback: RouterViewFallback | undefined,
	route: Route
): EffuseChild => {
	if (!Predicate.isNotNullable(fallback)) {
		return createDefaultLoadingView();
	}

	if (Predicate.isFunction(fallback)) {
		return (fallback as (route: Route) => EffuseChild)(route);
	}

	return fallback;
};

const renderErrorFallback = (
	errorFallback: RouterViewErrorFallback | undefined,
	error: unknown,
	route: Route
): EffuseChild => {
	if (!Predicate.isNotNullable(errorFallback)) {
		return createDefaultErrorView();
	}

	if (Predicate.isFunction(errorFallback)) {
		return (errorFallback as (error: unknown, route: Route) => EffuseChild)(
			error,
			route
		);
	}

	return errorFallback;
};

const createViewIdentity = (
	depth: number,
	viewName: string,
	route: Route
): string =>
	`${String(depth)}:${viewName}:${route.matched[depth]?.fullPath ?? 'unmatched'}`;

const createViewUpdateKey = (
	depth: number,
	viewName: string,
	route: Route
): string => `${createViewIdentity(depth, viewName, route)}:${route.fullPath}`;

export type RouterViewFallback =
	| EffuseChild
	| ((route: Route) => EffuseChild);

export type RouterViewErrorFallback =
	| EffuseChild
	| ((error: unknown, route: Route) => EffuseChild);

export interface RouterViewProps {
	readonly name?: string;
	readonly route?: Route;
	readonly fallback?: RouterViewFallback;
	readonly errorFallback?: RouterViewErrorFallback;
	readonly slot?: (
		component: RouteComponent,
		route: Route,
		props: Record<string, unknown>
	) => EffuseChild;
}

interface RouterViewState {
	readonly matchedView: Signal<EffuseChild>;
}

export const RouterView = define<RouterViewProps, RouterViewState>({
	script: ({
		props: viewProps,
		signal: createSignal,
		inject,
		provide,
	}) => {
		const router = getGlobalRouter();
		if (!router) {
			throw new InvalidRouterStateError({
				message: 'RouterView requires a router. Call installRouter() first.',
			});
		}

		const routeSignal = getRouteSignal();
		if (!routeSignal) {
			throw new InvalidRouterStateError({
				message:
					'RouterView requires installRouter() to be called first. No route signal found.',
			});
		}

		const depth = inject<number>(DEPTH_KEY, 0) ?? 0;
		provide(DEPTH_KEY, depth + 1);

		const matchedView = createSignal<EffuseChild>(null);

		let lastViewKey: string | null = null;

		const getActiveRoute = (): Route => viewProps.route ?? routeSignal.value;
		const getActiveViewName = (): string => viewProps.name ?? 'default';

		const renderLazyComponent = (
			result: Promise<unknown>,
			route: Route,
			viewName: string,
			currentViewKey: string,
			componentProps: Record<string, unknown>
		): void => {
			lastViewKey = currentViewKey;
			matchedView.value = renderFallback(viewProps.fallback, route);

			result
				.then((mod) => {
					if (
						createViewUpdateKey(depth, getActiveViewName(), getActiveRoute()) !==
						currentViewKey
					)
						return;
					if (!isLazyRouteModule(mod)) {
						matchedView.value = renderErrorFallback(
							viewProps.errorFallback,
							new TypeError(
								'Effuse lazy route expected a default route component.'
							),
							route
						);
						return;
					}
					const rendered = renderRouteContent(
						mod.default,
						route,
						componentProps,
						viewProps.slot
					);
					matchedView.value = createRouteContentNode(
						depth,
						viewName,
						route,
						rendered
					);
				})
				.catch((error: unknown) => {
					if (
						createViewUpdateKey(depth, getActiveViewName(), getActiveRoute()) !==
						currentViewKey
					)
						return;
					matchedView.value = renderErrorFallback(
						viewProps.errorFallback,
						error,
						route
					);
				});
		};

		const updateView = () => {
			const route = getActiveRoute();
			const viewName = getActiveViewName();
			const currentViewKey = createViewUpdateKey(depth, viewName, route);

			if (lastViewKey === currentViewKey) {
				return;
			}

			const matched = route.matched[depth];
			const component = getMatchedComponent(route, depth, viewName);

			if (!component) {
				lastViewKey = currentViewKey;
				matchedView.value = null;
				return;
			}

			const componentProps = getComponentProps(route, matched);

			if (isLazyRouteComponent(component)) {
				renderLazyComponent(
					component(),
					route,
					viewName,
					currentViewKey,
					componentProps
				);
				return;
			}

			if (Predicate.isFunction(component)) {
				const routeFunction = component as (
					props?: Record<string, unknown>
				) => EffuseChild | Promise<unknown>;

				if (Predicate.isNotNullable(viewProps.slot)) {
					const rendered = viewProps.slot(
						routeFunction as RouteComponent,
						route,
						componentProps
					);
					const content = createRouteContentNode(
						depth,
						viewName,
						route,
						rendered
					);

					lastViewKey = currentViewKey;
					matchedView.value = content;
					return;
				}

				const result = routeFunction({ ...componentProps, ...route.params });
				if (result instanceof Promise) {
					renderLazyComponent(
						result,
						route,
						viewName,
						currentViewKey,
						componentProps
					);
					return;
				}

				// Sync function component
				const content = createRouteContentNode(depth, viewName, route, result);

				lastViewKey = currentViewKey;
				matchedView.value = content;
				return;
			}

			const rendered = renderRouteContent(
				component,
				route,
				componentProps,
				viewProps.slot
			);

			const content = createRouteContentNode(depth, viewName, route, rendered);

			lastViewKey = currentViewKey;
			matchedView.value = content;
		};

		updateView();

		const checkRouteChange = () => {
			const route = getActiveRoute();
			const viewName = getActiveViewName();
			const currentViewKey = createViewUpdateKey(depth, viewName, route);

			if (lastViewKey !== currentViewKey) {
				queueMicrotask(updateView);
			}
		};

		watchEffect(checkRouteChange);

		return {
			matchedView,
		};
	},

	template: ({ matchedView }): EffuseChild => {
		return CreateElementNode({
			[EFFUSE_NODE]: true,
			tag: 'div',
			props: {
				class: 'router-view',
			},
			children: [matchedView],
		});
	},
});

export const createRouterViewSlot = (
	render: (
		component: RouteComponent,
		route: Route,
		props: Record<string, unknown>
	) => EffuseChild
): typeof render => render;
