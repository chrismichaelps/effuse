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
import { resolveTarget, type EventTarget } from './utils.js';
import { type ListenerState, ListenerState as LS, isActive } from './state.js';

export { ListenerState, isActive, isInactive, isError } from './state.js';
export { EventListenerError } from './errors.js';

export interface UseEventListenerConfig<E extends keyof WindowEventMap> {
	readonly target?: EventTarget | (() => EventTarget);

	readonly event: E;

	readonly handler: (event: WindowEventMap[E]) => void;

	readonly options?: AddEventListenerOptions;
}

export interface UseEventListenerReturn {
	readonly isActive: boolean;

	readonly stop: () => void;
}

export const useEventListener = defineHook<
	UseEventListenerConfig<keyof WindowEventMap>,
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

		const stop = (): void => {
			cleanup?.();
			cleanup = null;
			internalState.value = LS.Inactive();
		};

		ctx.effect(() => {
			if (!isClient()) return undefined;

			const maybeTarget = resolveTarget(target);

			Option.match(maybeTarget, {
				onNone: () => {
					internalState.value = LS.Error({
						reason: 'Target is null or undefined',
					});
				},
				onSome: (el) => {
					el.addEventListener(event, handler as EventListener, options);
					internalState.value = LS.Active({ eventName: event });

					cleanup = () => {
						el.removeEventListener(event, handler as EventListener, options);
					};
				},
			});

			return () => {
				stop();
			};
		});

		return {
			get isActive() {
				return isActive(internalState.value);
			},
			stop,
		};
	},
});
