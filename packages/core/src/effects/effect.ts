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

import { Effect, Fiber } from 'effect';
import {
	startTracking,
	stopTracking,
	getTrackingPaused,
	resumeTracking,
	pauseTracking,
	untrack,
} from '../reactivity/dep.js';
import type { Dep } from '../reactivity/dep.js';
import { isSuspendToken } from '../suspense/Suspense.js';
import type {
	DebounceOptions,
	EffectHandle,
	EffectOptions,
	OnCleanup,
	CleanupFn,
} from '../types/index.js';

// Initialize reactive effect
export function watchEffect(
	fn: (onCleanup: OnCleanup) => void | Promise<void>,
	options: EffectOptions = {}
): EffectHandle {
	let isActive = true;
	let isPaused = false;
	let isScheduled = false;
	let currentFiber: Fiber.RuntimeFiber<void> | null = null;
	let debounceTimeout: ReturnType<typeof setTimeout> | null = null;
	/** Whether another trigger arrived while a debounce window was open. */
	let sawTriggerDuringWait = false;
	let cleanupFns: CleanupFn[] = [];
	let subscriptions: (() => void)[] = [];
	let executionGeneration = 0;

	function runCleanup(cleanup: CleanupFn): void {
		try {
			untrack(cleanup);
		} catch {
			return;
		}
	}

	function runCleanups(): void {
		for (const cleanup of cleanupFns) {
			runCleanup(cleanup);
		}
		cleanupFns = [];
	}

	function clearSubscriptions(): void {
		for (const unsub of subscriptions) {
			unsub();
		}
		subscriptions = [];
	}

	function execute(): void {
		if (!isActive || isPaused) return;
		isScheduled = false;
		const generation = ++executionGeneration;
		const onCleanup: OnCleanup = (cleanupFn: CleanupFn): void => {
			if (!isActive || generation !== executionGeneration) {
				runCleanup(cleanupFn);
				return;
			}
			cleanupFns.push(cleanupFn);
		};

		runCleanups();
		clearSubscriptions();

		const wasPaused = getTrackingPaused();
		resumeTracking();

		startTracking();

		let trackedDeps: Dep[] | undefined;
		let shouldSubscribe = false;
		try {
			const result = fn(onCleanup);

			trackedDeps = stopTracking();
			shouldSubscribe = true;

			if (result instanceof Promise) {
				executeAsync(result);
			}
		} catch (err) {
			if (!trackedDeps) {
				trackedDeps = stopTracking();
			}
			if (isSuspendToken(err)) {
				shouldSubscribe = true;
				return;
			}
			runCleanups();
			throw err;
		} finally {
			if (isActive && shouldSubscribe && trackedDeps) {
				for (const trackedDep of trackedDeps) {
					const unsub = trackedDep.subscribe(scheduleRun);
					subscriptions.push(unsub);
				}
			}

			if (wasPaused) {
				pauseTracking();
			}
		}
	}

	/**
	 * Contains a rejection from an async callback so it cannot become an
	 * unhandled rejection, which terminates the process on Node.
	 *
	 * This used to wrap the promise in `Effect.retry` and `Effect.timeout` for
	 * the `retry` and `timeout` options. Neither did anything: the promise
	 * arrives already created, so retrying re-awaited a settled value instead of
	 * re-invoking the callback, and a timeout cannot cancel a promise, so the
	 * work ran to completion with its result discarded. Both options were
	 * removed rather than left promising behaviour they did not have.
	 */
	function executeAsync(promise: Promise<void>): void {
		const fiber = Effect.runFork(
			Effect.catchAll(Effect.promise(() => promise), () => Effect.void)
		);
		currentFiber = fiber;
	}

	/**
	 * Debounce has to see every trigger, because each one restarts the wait.
	 * The shared `isScheduled` guard used to swallow them: the first trigger set
	 * it, and the rest returned here without reaching the `clearTimeout` that
	 * restarts the window. The effect then ran `wait` after the *first* trigger
	 * rather than the last, which is a trailing-edge throttle.
	 */
	function scheduleDebounced(debounce: DebounceOptions): void {
		const { wait, leading = false, trailing = true } = debounce;

		if (debounceTimeout === null) {
			if (leading) execute();
		} else {
			// Something already fired inside this window, so a trailing run has
			// work to report even when the leading edge already ran.
			sawTriggerDuringWait = true;
			clearTimeout(debounceTimeout);
		}

		isScheduled = true;
		debounceTimeout = setTimeout(() => {
			debounceTimeout = null;
			isScheduled = false;
			// A lone trigger under `leading` has already run; firing again here
			// would run it twice for one burst.
			const fireTrailing = trailing && (!leading || sawTriggerDuringWait);
			sawTriggerDuringWait = false;
			if (fireTrailing) execute();
		}, wait);
	}

	function scheduleRun(): void {
		if (!isActive || isPaused) return;

		if (options.debounce) {
			scheduleDebounced(options.debounce);
			return;
		}

		if (isScheduled) return;

		if (options.flush === 'post') {
			isScheduled = true;
			queueMicrotask(execute);
		} else {
			execute();
		}
	}

	if (options.immediate !== false) {
		execute();
	}

	return {
		stop: (): void => {
			isActive = false;
			runCleanups();
			clearSubscriptions();

			if (debounceTimeout) {
				clearTimeout(debounceTimeout);
				debounceTimeout = null;
			}
			sawTriggerDuringWait = false;

			if (currentFiber) {
				Effect.runFork(Fiber.interrupt(currentFiber));
			}
		},
		pause: (): void => {
			isPaused = true;
		},
		resume: (): void => {
			isPaused = false;
			execute();
		},
	};
}

// Execute once without leaking dependencies into an enclosing effect.
export function effectOnce(fn: () => void): void {
	untrack(fn);
}

export { batch } from '../reactivity/dep.js';
export type { OnCleanup } from '../types/index.js';
