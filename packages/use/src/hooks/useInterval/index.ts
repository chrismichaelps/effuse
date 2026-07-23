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
	traceIntervalInit,
	traceIntervalStart,
	traceIntervalTick,
	traceIntervalPause,
	traceIntervalStop,
} from './telemetry.js';
import {
	type IntervalState,
	type IntervalStatus,
	IntervalState as IS,
	isRunning,
	isPaused,
	isStopped,
	getCount,
	getIsActive,
	getStatus,
} from './state.js';

export {
	IntervalState,
	type IntervalStatus,
	isRunning,
	isPaused,
	isStopped,
} from './state.js';
export { IntervalError } from './errors.js';

export interface UseIntervalConfig {
	readonly callback: () => void;

	readonly delay?: number;

	readonly immediate?: boolean;
}

export interface UseIntervalReturn {
	readonly count: ReadonlySignal<number>;

	readonly status: ReadonlySignal<IntervalStatus>;

	readonly isRunning: ReadonlySignal<boolean>;

	readonly isPaused: ReadonlySignal<boolean>;

	readonly isStopped: ReadonlySignal<boolean>;

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

		traceIntervalInit(clampedDelay, immediate);

		const internalState = ctx.signal<IntervalState>(
			immediate && isClient() ? IS.Running({ count: 0 }) : IS.Stopped()
		);

		let intervalId: ReturnType<typeof setInterval> | null = null;

		const count = ctx.computed(() => getCount(internalState.value));
		const status = ctx.computed(() => getStatus(internalState.value));
		const running = ctx.computed(() => getIsActive(internalState.value));
		const paused = ctx.computed(() => isPaused(internalState.value));
		const stopped = ctx.computed(() => isStopped(internalState.value));

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

			traceIntervalStart(clampedDelay);
			internalState.value = IS.Running({ count: currentCount });

			intervalId = setInterval(() => {
				const state = internalState.value;
				if (isRunning(state)) {
					const newCount = getCount(state) + 1;
					traceIntervalTick(newCount);
					callback();
					internalState.value = IS.Running({ count: newCount });
				}
			}, clampedDelay);
		};

		const pause = (): void => {
			if (!isRunning(internalState.value)) return;
			traceIntervalPause();
			clearCurrentInterval();
			const currentCount = getCount(internalState.value);
			internalState.value = IS.Paused({ count: currentCount });
		};

		const stop = (): void => {
			traceIntervalStop();
			clearCurrentInterval();
			internalState.value = IS.Stopped();
		};

		ctx.onMount(() => {
			if (immediate) start();
			return clearCurrentInterval;
		});

		return {
			count,
			status,
			isRunning: running,
			isPaused: paused,
			isStopped: stopped,
			start,
			pause,
			stop,
		};
	},
});
