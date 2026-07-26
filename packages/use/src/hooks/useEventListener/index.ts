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

import { Option } from 'effect';
import { defineHook } from '@effuse/core';
import { isClient } from '../../internal/utils.js';
import { DEFAULT_LISTENER_OPTIONS } from './constants.js';
import { resolveTarget, getTargetName } from './utils.js';
import {
	traceEventListenerAdd,
	traceEventListenerRemove,
} from './telemetry.js';
import { type ListenerState, ListenerState as LS, isActive } from './state.js';

export { ListenerState, isActive, isInactive, isError } from './state.js';
export { EventListenerError } from './errors.js';

export type EventMapFor<T extends globalThis.EventTarget> =
	T extends Window
		? WindowEventMap
		: T extends Document
			? DocumentEventMap
			: T extends HTMLElement
				? HTMLElementEventMap
				: T extends SVGElement
					? SVGElementEventMap
					: T extends MediaQueryList
						? MediaQueryListEventMap
						: Record<string, Event>;

export type EventNameFor<T extends globalThis.EventTarget> = Extract<
	keyof EventMapFor<T>,
	string
>;

export interface UseEventListenerConfig<
	T extends globalThis.EventTarget = Window,
	E extends EventNameFor<T> = EventNameFor<T>,
> {
	readonly target?: T | null | (() => T | null);

	readonly event: E;

	readonly handler: (event: EventMapFor<T>[E]) => void;

	readonly options?: AddEventListenerOptions;
}

export interface UseEventListenerReturn {
	readonly isActive: boolean;

	readonly stop: () => void;
}

interface InternalEventListenerConfig {
	readonly target?:
		| globalThis.EventTarget
		| null
		| (() => globalThis.EventTarget | null);
	readonly event: string;
	readonly handler: EventListener;
	readonly options?: AddEventListenerOptions;
}

const useEventListenerHook = defineHook<
	InternalEventListenerConfig,
	UseEventListenerReturn
>({
	name: 'useEventListener',
	setup: (ctx) => {
		const {
			target = () => (isClient() ? window : null),
			event,
			handler,
			options = DEFAULT_LISTENER_OPTIONS,
		} = ctx.config;

		const internalState = ctx.signal<ListenerState>(LS.Inactive());
		let cleanup: (() => void) | null = null;

		let isStopped = false;

		const detach = (): void => {
			cleanup?.();
			cleanup = null;
			internalState.value = LS.Inactive();
		};

		const stop = (): void => {
			isStopped = true;
			detach();
		};

		ctx.watchEffect(() => {
			if (!isClient() || isStopped) return undefined;

			const maybeTarget = resolveTarget(target);

			Option.match(maybeTarget, {
				onNone: () => {
					internalState.value = LS.Error({
						reason: 'Target is null or undefined',
					});
				},
				onSome: (el) => {
					const targetName = getTargetName(el);
					traceEventListenerAdd(event, targetName);
					el.addEventListener(event, handler, options);
					internalState.value = LS.Active({ eventName: event });

					cleanup = () => {
						traceEventListenerRemove(event, targetName);
						el.removeEventListener(event, handler, options);
					};
				},
			});

			return detach;
		});

		return {
			get isActive() {
				return isActive(internalState.value);
			},
			stop,
		};
	},
});

export const useEventListener = useEventListenerHook as <
	T extends globalThis.EventTarget = Window,
	E extends EventNameFor<T> = EventNameFor<T>,
>(config: UseEventListenerConfig<T, E>) => UseEventListenerReturn;
