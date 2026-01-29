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

import { defineHook, type ReadonlySignal, type Signal } from '@effuse/core';
import { DEFAULT_DEBOUNCE_MS } from './constants.js';
import { clampDelay } from './utils.js';
import {
	traceDebounceInit,
	traceDebounceSchedule,
	traceDebounceFlush,
	traceDebounceCancel,
} from './telemetry.js';
import {
	type DebounceState,
	DebounceState as DS,
	isPending,
	getCurrentValue,
	getIsPending,
} from './state.js';

export { DebounceState, isPending, isIdle } from './state.js';
export { DebounceError } from './errors.js';

export interface UseDebounceConfig<T> {
	readonly value: Signal<T> | ReadonlySignal<T>;
	readonly delay?: number;
}

export interface UseDebounceReturn<T> {
	readonly value: ReadonlySignal<T>;
	readonly isPending: ReadonlySignal<boolean>;
	readonly cancel: () => void;
	readonly flush: () => void;
}

export const useDebounce = defineHook<
	UseDebounceConfig<unknown>,
	UseDebounceReturn<unknown>
>({
	name: 'useDebounce',
	setup: (ctx) => {
		const { value: sourceSignal, delay = DEFAULT_DEBOUNCE_MS } = ctx.config;
		const clampedDelay = clampDelay(delay);

		traceDebounceInit(clampedDelay);

		const internalState = ctx.signal<DebounceState<unknown>>(
			DS.Idle({ value: sourceSignal.value })
		);

		let timeoutId: ReturnType<typeof setTimeout> | null = null;
		let lastSourceValue: unknown = sourceSignal.value;

		const clearPendingTimeout = (): void => {
			if (timeoutId !== null) {
				clearTimeout(timeoutId);
				timeoutId = null;
			}
		};

		const debouncedValue = ctx.computed(() =>
			getCurrentValue(internalState.value)
		);

		const pending = ctx.computed(() => getIsPending(internalState.value));

		let isCancelled = false;

		const cancel = (): void => {
			traceDebounceCancel();
			isCancelled = true;
			clearPendingTimeout();
			lastSourceValue = sourceSignal.value;
			const currentValue = getCurrentValue(internalState.value);
			internalState.value = DS.Idle({ value: currentValue });
		};

		const flush = (): void => {
			traceDebounceFlush();
			clearPendingTimeout();
			const state = internalState.value;
			if (isPending(state)) {
				lastSourceValue = state.pendingValue;
				internalState.value = DS.Idle({ value: state.pendingValue });
			}
		};

		ctx.effect(() => {
			const newValue = sourceSignal.value;

			if (isCancelled) {
				if (newValue !== lastSourceValue) {
					isCancelled = false;
				} else {
					return undefined;
				}
			}

			if (newValue === lastSourceValue) {
				return undefined;
			}

			clearPendingTimeout();

			traceDebounceSchedule();
			internalState.value = DS.Pending({
				value: getCurrentValue(internalState.value),
				pendingValue: newValue,
			});

			timeoutId = setTimeout(() => {
				const state = internalState.value;
				if (isPending(state)) {
					lastSourceValue = state.pendingValue;
					internalState.value = DS.Idle({ value: state.pendingValue });
				}
				timeoutId = null;
			}, clampedDelay);

			return () => {
				clearPendingTimeout();
			};
		});

		return {
			value: debouncedValue,
			isPending: pending,
			cancel,
			flush,
		};
	},
});
