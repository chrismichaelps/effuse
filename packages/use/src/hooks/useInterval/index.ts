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

import { defineHook, type ReadonlySignal } from '@effuse/core';
import { isClient } from '../../internal/utils.js';
import { DEFAULT_INTERVAL_MS } from './constants.js';
import { clampInterval } from './utils.js';
import {
	type IntervalState,
	IntervalState as IS,
	isRunning,
	isPaused,
	getCount,
	getIsActive,
} from './state.js';

export { IntervalState, isRunning, isPaused, isStopped } from './state.js';
export { IntervalError } from './errors.js';

export interface UseIntervalConfig {
	readonly callback: () => void;

	readonly delay?: number;

	readonly immediate?: boolean;
}

export interface UseIntervalReturn {
	readonly count: ReadonlySignal<number>;

	readonly isRunning: ReadonlySignal<boolean>;

	readonly start: () => void;

	readonly pause: () => void;

	readonly stop: () => void;
}

export const useInterval = defineHook<UseIntervalConfig, UseIntervalReturn>({
	name: 'useInterval',
	setup: (ctx) => {
		const {
			callback,
			delay = DEFAULT_INTERVAL_MS,
			immediate = true,
		} = ctx.config;

		const clampedDelay = clampInterval(delay);

		const internalState = ctx.signal<IntervalState>(
			immediate ? IS.Running({ count: 0 }) : IS.Stopped()
		);

		let intervalId: ReturnType<typeof setInterval> | null = null;

		const count = ctx.computed(() => getCount(internalState.value));
		const running = ctx.computed(() => getIsActive(internalState.value));

		const clearCurrentInterval = (): void => {
			if (intervalId !== null) {
				clearInterval(intervalId);
				intervalId = null;
			}
		};

		const start = (): void => {
			if (!isClient()) return;
			clearCurrentInterval();

			const currentCount = isPaused(internalState.value)
				? getCount(internalState.value)
				: 0;

			internalState.value = IS.Running({ count: currentCount });

			intervalId = setInterval(() => {
				const state = internalState.value;
				if (isRunning(state)) {
					callback();
					internalState.value = IS.Running({
						count: getCount(state) + 1,
					});
				}
			}, clampedDelay);
		};

		const pause = (): void => {
			clearCurrentInterval();
			const currentCount = getCount(internalState.value);
			internalState.value = IS.Paused({ count: currentCount });
		};

		const stop = (): void => {
			clearCurrentInterval();
			internalState.value = IS.Stopped();
		};

		ctx.effect(() => {
			if (!isClient()) return undefined;

			if (immediate) {
				start();
			}

			return () => {
				clearCurrentInterval();
			};
		});

		return {
			count,
			isRunning: running,
			start,
			pause,
			stop,
		};
	},
});
