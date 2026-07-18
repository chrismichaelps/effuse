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
import {
	define,
	EFFUSE_NODE,
	CreateElementNode,
	type ElementNode,
	type EffuseChild,
	type Signal,
	watchEffect,
	computed,
} from '@effuse/core';
import { getGlobalRouter } from '../core/router.js';
import { getRouteSignal } from '../core/context.js';
import type { Route } from '../core/route.js';

interface LinkProps {
	[key: string]: unknown;
	to: string | (() => string);
	activeClass?: string;
	exactActiveClass?: string;
	class?: string;
	className?: string;
	children?: unknown;
}

interface LinkState {
	href: () => string;
	isActive: Signal<boolean>;
	isExactActive: Signal<boolean>;
	resolvedActiveClass: string;
	resolvedExactActiveClass: string;
	handleClick: (event: MouseEvent) => void;
}

export const Link = define<LinkProps, LinkState>({
	script: ({ props, signal, onMount, onUnmount }): LinkState => {
		const router = getGlobalRouter();

		const resolveTo = (): string =>
			typeof props.to === 'function' ? props.to() : props.to;
		const activeClass = props.activeClass ?? 'router-link-active';
		const exactActiveClass =
			props.exactActiveClass ?? 'router-link-exact-active';

		const isActive = signal(false);
		const isExactActive = signal(false);

		let stopWatch: (() => void) | null = null;

		const updateActiveState = (route: Route): void => {
			const to = resolveTo();
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
				const h = watchEffect(() => {
					updateActiveState(routeSignal.value);
				});
				stopWatch = h.stop;
			}
			return undefined;
		});

		onUnmount(() => {
			if (Predicate.isNotNullable(stopWatch)) {
				stopWatch();
			}
			stopWatch = null;
		});

		const handleClick = (event: MouseEvent): void => {
			if (event.metaKey || event.altKey || event.ctrlKey || event.shiftKey)
				return;

			if (event.button !== 0) return;

			event.preventDefault();

			if (router) {
				void router.push(resolveTo());
			}
		};

		return {
			href: resolveTo,
			isActive,
			isExactActive,
			resolvedActiveClass: activeClass,
			resolvedExactActiveClass: exactActiveClass,
			handleClick,
		};
	},

	template: (ctx): ElementNode => {
		const userClass =
			(typeof ctx.props.class === 'string' && ctx.props.class) ||
			(typeof ctx.props.className === 'string' && ctx.props.className) ||
			'';

		const classSig = computed<string | null>(() => {
			const classes: string[] = [];
			if (userClass) classes.push(userClass);
			if (ctx.isExactActive.value) {
				classes.push(ctx.resolvedExactActiveClass);
			} else if (ctx.isActive.value) {
				classes.push(ctx.resolvedActiveClass);
			}
			return classes.length > 0 ? classes.join(' ') : null;
		});

		const ariaCurrentSig = computed<string | null>(() =>
			ctx.isExactActive.value ? 'page' : null
		);

		const childrenProp = ctx.children;
		const childrenArr =
			childrenProp == null
				? []
				: Array.isArray(childrenProp)
					? (childrenProp as EffuseChild[])
					: [childrenProp as EffuseChild];

		return CreateElementNode({
			[EFFUSE_NODE]: true,
			tag: 'a',
			props: {
				href: ctx.href,
				className: classSig,
				onClick: ctx.handleClick,
				'aria-current': ariaCurrentSig,
			},
			children: childrenArr,
		});
	},
});

export const RouterLink = Link;
