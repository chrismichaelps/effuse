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
import { DEFAULT_THROTTLE_MS } from './constants.js';
import { clampInterval } from './utils.js';
import {
  traceThrottleInit,
  traceThrottleUpdate,
  traceThrottleSkip,
  traceThrottleCooldownEnd,
} from './telemetry.js';
import {
  type ThrottleState,
  ThrottleState as TS,
  isThrottled,
  getCurrentValue,
  getIsThrottled,
} from './state.js';

export { ThrottleState, isReady, isThrottled } from './state.js';
export { ThrottleError } from './errors.js';

export interface UseThrottleConfig<T> {
  readonly value: Signal<T> | ReadonlySignal<T>;
  readonly interval?: number;
  readonly leading?: boolean;
  readonly trailing?: boolean;
}

export interface UseThrottleReturn<T> {
  readonly value: ReadonlySignal<T>;
  readonly isThrottled: ReadonlySignal<boolean>;
}

export const useThrottle = defineHook<
  UseThrottleConfig<unknown>,
  UseThrottleReturn<unknown>
>({
  name: 'useThrottle',
  setup: (ctx) => {
    const {
      value: sourceSignal,
      interval = DEFAULT_THROTTLE_MS,
      leading = true,
      trailing = true,
    } = ctx.config;
    const clampedInterval = clampInterval(interval);

    traceThrottleInit(clampedInterval);

    const internalState = ctx.signal<ThrottleState<unknown>>(
      TS.Ready({ value: sourceSignal.value })
    );

    let timeoutId: ReturnType<typeof setTimeout> | null = null;
    let lastProcessedValue: unknown = sourceSignal.value;
    let trailingValue: unknown = null;
    let hasTrailingValue = false;

    const clearCooldownTimeout = (): void => {
      if (timeoutId !== null) {
        clearTimeout(timeoutId);
        timeoutId = null;
      }
    };

    const throttledValue = ctx.computed(() =>
      getCurrentValue(internalState.value)
    );

    const throttled = ctx.computed(() => getIsThrottled(internalState.value));

    const applyValue = (newValue: unknown): void => {
      traceThrottleUpdate();
      lastProcessedValue = newValue;
      internalState.value = TS.Throttled({
        value: newValue,
        lastValue: getCurrentValue(internalState.value),
      });
    };

    const startCooldown = (): void => {
      timeoutId = setTimeout(() => {
        traceThrottleCooldownEnd();
        timeoutId = null;

        if (trailing && hasTrailingValue) {
          const valueToApply = trailingValue;
          hasTrailingValue = false;
          trailingValue = null;
          lastProcessedValue = valueToApply;
          internalState.value = TS.Throttled({
            value: valueToApply,
            lastValue: getCurrentValue(internalState.value),
          });
          startCooldown();
        } else {
          lastProcessedValue = getCurrentValue(internalState.value);
          internalState.value = TS.Ready({
            value: getCurrentValue(internalState.value),
          });
        }
      }, clampedInterval);
    };

    ctx.effect(() => {
      const newValue = sourceSignal.value;

      if (newValue === lastProcessedValue && !isThrottled(internalState.value)) {
        return undefined;
      }

      const currentlyThrottled = isThrottled(internalState.value);

      if (currentlyThrottled) {
        traceThrottleSkip();
        if (trailing) {
          trailingValue = newValue;
          hasTrailingValue = true;
        }
        return undefined;
      }

      if (leading) {
        applyValue(newValue);
        startCooldown();
      } else {
        trailingValue = newValue;
        hasTrailingValue = true;
        lastProcessedValue = newValue;
        internalState.value = TS.Throttled({
          value: getCurrentValue(internalState.value),
          lastValue: getCurrentValue(internalState.value),
        });
        startCooldown();
      }

      return () => {
        clearCooldownTimeout();
      };
    });

    return {
      value: throttledValue,
      isThrottled: throttled,
    };
  },
});
