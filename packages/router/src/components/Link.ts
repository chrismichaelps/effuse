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
import {
	define,
	EFFUSE_NODE,
	NodeType,
	type ElementNode,
	type Signal,
	effect,
	computed,
} from '@effuse/core';
import { getGlobalRouter } from '../core/router.js';
import { getRouteSignal } from '../core/context.js';
import type { Route } from '../core/route.js';

interface LinkProps {
	[key: string]: unknown;
	to: string;
	activeClass?: string;
	exactActiveClass?: string;
	class?: string;
	className?: string;
	children?: unknown;
}

interface LinkState {
	to: string;
	isActive: Signal<boolean>;
	isExactActive: Signal<boolean>;
	activeClass: string;
	exactActiveClass: string;
	handleClick: (event: MouseEvent) => void;
}

// Build reactive router link component
export const Link = define<LinkProps, LinkState>({
	script: ({ props, signal, onMount, onUnmount }): LinkState => {
		const router = getGlobalRouter();

		const to = props.to;
		const activeClass = props.activeClass ?? 'router-link-active';
		const exactActiveClass =
			props.exactActiveClass ?? 'router-link-exact-active';

		const isActive = signal(false);
		const isExactActive = signal(false);

		let stopWatch: (() => void) | null = null;

		const updateActiveState = (route: Route): void => {
			isExactActive.value = route.path === to;
			isActive.value = route.path.startsWith(to) || isExactActive.value;
		};

		onMount(() => {
			if (!router) return undefined;

			const currentRoute = Effect.runSync(
				SubscriptionRef.get(router.currentRoute)
			);
			updateActiveState(currentRoute);

			const routeSignal = getRouteSignal();
			if (routeSignal) {
				const h = effect(() => {
					updateActiveState(routeSignal.value);
				});
				stopWatch = h.stop;
			}
			return undefined;
		});

		onUnmount(() => {
			stopWatch?.();
			stopWatch = null;
		});

		const handleClick = (event: MouseEvent): void => {
			if (event.metaKey || event.altKey || event.ctrlKey || event.shiftKey)
				return;

			if (event.button !== 0) return;

			event.preventDefault();

			if (router) {
				Effect.runFork(router.push(to));
			}
		};

		return {
			to,
			isActive,
			isExactActive,
			activeClass,
			exactActiveClass,
			handleClick,
		};
	},

	template: (exposed, props): ElementNode => {
		const userClass =
			(typeof props.class === 'string' && props.class) ||
			(typeof props.className === 'string' && props.className) ||
			'';

		const classSig = computed<string | null>(() => {
			const classes: string[] = [];
			if (userClass) classes.push(userClass);
			if (exposed.isExactActive.value) {
				classes.push(exposed.exactActiveClass);
			} else if (exposed.isActive.value) {
				classes.push(exposed.activeClass);
			}
			return classes.length > 0 ? classes.join(' ') : null;
		});

		const ariaCurrentSig = computed<string | null>(() =>
			exposed.isExactActive.value ? 'page' : null
		);

		const childrenProp = (props as { children?: unknown }).children;
		const childrenArr =
			childrenProp == null
				? []
				: Array.isArray(childrenProp)
					? (childrenProp as unknown[])
					: [childrenProp];

		return {
			[EFFUSE_NODE]: true,
			type: NodeType.ELEMENT,
			tag: 'a',
			props: {
				href: exposed.to,
				className: classSig,
				onClick: exposed.handleClick,
				'aria-current': ariaCurrentSig,
			},
			children: childrenArr,
		} as ElementNode;
	},
});

export const RouterLink = Link;
