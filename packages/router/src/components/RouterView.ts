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
	define,
	effect,
	type EffuseChild,
	EFFUSE_NODE,
	NodeType,
} from '@effuse/core';
import { getGlobalRouter } from '../core/router.js';
import { injectDepth, getRouteSignal } from '../core/context.js';
import type {
	Route,
	NormalizedRouteRecord,
	RouteComponent,
} from '../core/route.js';

const getMatchedComponent = (
	route: Route,
	depth: number,
	name: string
): RouteComponent | null => {
	const matched = route.matched[depth];
	if (!matched) return null;

	if (matched.components) {
		return (matched.components[name] as RouteComponent | undefined) ?? null;
	}

	return name === 'default'
		? ((matched.component as RouteComponent | undefined) ?? null)
		: null;
};

const getComponentProps = (
	route: Route,
	matched: NormalizedRouteRecord | undefined
): Record<string, unknown> => {
	if (!matched?.props) return {};

	if (matched.props === true) {
		return { ...route.params };
	}

	if (typeof matched.props === 'function') {
		return matched.props(route);
	}

	return matched.props;
};

const renderComponent = (
	component: RouteComponent,
	route: Route,
	props: Record<string, unknown>
): EffuseChild => {
	if (
		typeof component === 'object' &&
		component !== null &&
		'_tag' in component
	) {
		if ((component as { _tag: string })._tag === 'Blueprint') {
			return {
				[EFFUSE_NODE]: true,
				type: NodeType.BLUEPRINT,
				blueprint: component,
				props: { ...props, ...route.params },
				portals: null,
			} as unknown as EffuseChild;
		}
	}

	if (typeof component === 'function') {
		return (component as (p: Record<string, unknown>) => EffuseChild)({
			...props,
			...route.params,
		});
	}

	return component as EffuseChild;
};

export interface RouterViewProps {
	readonly name?: string;
	readonly route?: Route;
	readonly slot?: (
		component: RouteComponent,
		route: Route,
		props: Record<string, unknown>
	) => EffuseChild;
}

// Build reactive router view component
export const RouterView = define({
	script: ({ signal: createSignal }) => {
		const router = getGlobalRouter();
		if (!router) {
			throw new Error(
				'RouterView requires a router. Call installRouter() first.'
			);
		}

		const routeSignal = getRouteSignal();
		if (!routeSignal) {
			throw new Error(
				'RouterView requires installRouter() to be called first. No route signal found.'
			);
		}

		const depth = injectDepth();

		const viewName = createSignal('default');

		const matchedView = createSignal<EffuseChild>(null);

		let lastRoutePath: string | null = null;

		const updateView = () => {
			const route = routeSignal.value;
			const currentRoutePath = route.fullPath;

			if (lastRoutePath === currentRoutePath) {
				return;
			}

			const matched = route.matched[depth];
			const component = getMatchedComponent(route, depth, viewName.value);

			if (!component) {
				lastRoutePath = currentRoutePath;
				matchedView.value = null;
				return;
			}

			const props = getComponentProps(route, matched);

			const rendered = renderComponent(component, route, props);

			const content = {
				[EFFUSE_NODE]: true,
				type: NodeType.ELEMENT,
				tag: 'div',
				props: {
					key: `route-${String(depth)}-${currentRoutePath}`,
					class: 'router-view-content',
				},
				children: [rendered],
			} as unknown as EffuseChild;

			lastRoutePath = currentRoutePath;
			matchedView.value = content;
		};

		updateView();

		const checkRouteChange = () => {
			const route = routeSignal.value;
			const currentPath = route.fullPath;

			if (lastRoutePath !== currentPath) {
				queueMicrotask(updateView);
			}
		};

		effect(checkRouteChange);

		return {
			viewName,
			matchedView,
		};
	},

	template: ({ matchedView }): EffuseChild => {
		return {
			[EFFUSE_NODE]: true,
			type: NodeType.ELEMENT,
			tag: 'div',
			props: {
				class: 'router-view',
			},
			children: [matchedView],
		} as unknown as EffuseChild;
	},
});

// Build custom router view slot
export const createRouterViewSlot = (
	render: (
		component: RouteComponent,
		route: Route,
		props: Record<string, unknown>
	) => EffuseChild
): typeof render => render;
