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
import type { Route } from '../core/route.js';

export type TransitionMode = 'in-out' | 'out-in' | 'default';

export interface TransitionConfig {
	readonly name?: string;
	readonly mode?: TransitionMode;
	readonly duration?: number | { enter: number; leave: number };
	readonly enterClass?: string;
	readonly enterActiveClass?: string;
	readonly enterToClass?: string;
	readonly leaveClass?: string;
	readonly leaveActiveClass?: string;
	readonly leaveToClass?: string;
}

export interface TransitionState {
	readonly phase: 'enter' | 'leave' | 'idle';
	readonly classes: string[];
}

export interface TransitionHooks {
	readonly onBeforeEnter?: (el: Element) => void;
	readonly onEnter?: (el: Element, done: () => void) => void;
	readonly onAfterEnter?: (el: Element) => void;
	readonly onEnterCancelled?: (el: Element) => void;
	readonly onBeforeLeave?: (el: Element) => void;
	readonly onLeave?: (el: Element, done: () => void) => void;
	readonly onAfterLeave?: (el: Element) => void;
	readonly onLeaveCancelled?: (el: Element) => void;
}

// Calculate CSS classes for transition phase
export const getTransitionClasses = (
	config: TransitionConfig,
	phase: 'enter' | 'leave'
): { base: string; active: string; to: string } => {
	const name = config.name ?? 'route';

	if (phase === 'enter') {
		return {
			base: config.enterClass ?? `${name}-enter-from`,
			active: config.enterActiveClass ?? `${name}-enter-active`,
			to: config.enterToClass ?? `${name}-enter-to`,
		};
	}

	return {
		base: config.leaveClass ?? `${name}-leave-from`,
		active: config.leaveActiveClass ?? `${name}-leave-active`,
		to: config.leaveToClass ?? `${name}-leave-to`,
	};
};

const DEFAULT_DURATION = 300;

// Calculate duration for transition phase
export const getTransitionDuration = (
	config: TransitionConfig,
	phase: 'enter' | 'leave'
): number => {
	if (typeof config.duration === 'number') {
		return config.duration;
	}
	if (config.duration) {
		return phase === 'enter' ? config.duration.enter : config.duration.leave;
	}
	return DEFAULT_DURATION;
};

// Execute transition effect on element
export const applyTransition = (
	el: Element,
	config: TransitionConfig,
	phase: 'enter' | 'leave'
): Effect.Effect<void> =>
	Effect.async((resume) => {
		const classes = getTransitionClasses(config, phase);
		const duration = getTransitionDuration(config, phase);

		el.classList.add(classes.base, classes.active);
		void (el as HTMLElement).offsetHeight;

		requestAnimationFrame(() => {
			el.classList.remove(classes.base);
			el.classList.add(classes.to);

			setTimeout(() => {
				el.classList.remove(classes.active, classes.to);
				resume(Effect.succeed(undefined));
			}, duration);
		});
	});

// Identify transition config for route change
export const getRouteTransition = (
	to: Route,
	from: Route
): TransitionConfig | undefined => {
	const toTransition = to.meta.transition as
		| TransitionConfig
		| string
		| undefined;

	if (typeof toTransition === 'string') {
		return { name: toTransition };
	}

	if (toTransition) {
		return toTransition;
	}

	const fromTransition = from.meta.leaveTransition as
		| TransitionConfig
		| string
		| undefined;

	if (typeof fromTransition === 'string') {
		return { name: fromTransition };
	}

	return fromTransition;
};

export const transitions = {
	fade: { name: 'fade', duration: 200 } as TransitionConfig,
	slide: { name: 'slide', duration: DEFAULT_DURATION } as TransitionConfig,
	slideLeft: {
		name: 'slide-left',
		duration: DEFAULT_DURATION,
	} as TransitionConfig,
	slideRight: {
		name: 'slide-right',
		duration: DEFAULT_DURATION,
	} as TransitionConfig,
	scale: { name: 'scale', duration: 200 } as TransitionConfig,
};
