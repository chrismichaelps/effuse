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

import { Effect, Schedule, Duration, Fiber } from 'effect';
import {
	startTracking,
	stopTracking,
	getTrackingPaused,
	resumeTracking,
	pauseTracking,
} from '../reactivity/dep.js';
import type { Dep } from '../reactivity/dep.js';
import { isSuspendToken } from '../suspense/token.js';
import type {
	EffectHandle,
	EffectOptions,
	OnCleanup,
	CleanupFn,
} from '../types/index.js';

export function effect(
	fn: (onCleanup: OnCleanup) => void | Promise<void>,
	options: EffectOptions = {}
): EffectHandle {
	let isActive = true;
	let isPaused = false;
	let isScheduled = false;
	let currentFiber: Fiber.RuntimeFiber<void> | null = null;
	let debounceTimeout: ReturnType<typeof setTimeout> | null = null;
	let cleanupFns: CleanupFn[] = [];
	let subscriptions: (() => void)[] = [];

	function runCleanups(): void {
		for (const cleanup of cleanupFns) {
			try {
				cleanup();
			} catch {
				continue;
			}
		}
		cleanupFns = [];
	}

	function clearSubscriptions(): void {
		for (const unsub of subscriptions) {
			unsub();
		}
		subscriptions = [];
	}

	const onCleanup: OnCleanup = (cleanupFn: CleanupFn): void => {
		cleanupFns.push(cleanupFn);
	};

	function execute(): void {
		if (!isActive || isPaused) return;
		isScheduled = false;

		runCleanups();
		clearSubscriptions();

		const wasPaused = getTrackingPaused();
		resumeTracking();

		startTracking();

		let trackedDeps: Dep[] | undefined;
		try {
			const result = fn(onCleanup);

			trackedDeps = stopTracking();

			if (result instanceof Promise) {
				executeAsync(result);
			}
		} catch (err) {
			if (!trackedDeps) {
				trackedDeps = stopTracking();
			}
			if (isSuspendToken(err)) {
				return;
			}
			throw err;
		} finally {
			if (trackedDeps) {
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

	function executeAsync(promise: Promise<void>): void {
		let effectProgram: Effect.Effect<void, unknown> = Effect.promise(
			() => promise
		);

		if (options.retry) {
			const { times = 3, delay = 1000, strategy = 'constant' } = options.retry;
			const baseSchedule =
				strategy === 'exponential'
					? Schedule.exponential(Duration.millis(delay))
					: Schedule.fixed(Duration.millis(delay));

			const limitedSchedule = Schedule.compose(
				baseSchedule,
				Schedule.recurs(times)
			);

			effectProgram = Effect.retry(effectProgram, limitedSchedule);
		}

		if (options.timeout) {
			effectProgram = Effect.timeout(
				effectProgram,
				Duration.millis(options.timeout)
			);
		}

		const fiber = Effect.runFork(
			Effect.catchAll(effectProgram, () => Effect.void)
		);
		currentFiber = fiber;
	}

	function scheduleRun(): void {
		if (!isActive || isPaused || isScheduled) return;

		if (options.debounce) {
			if (debounceTimeout) {
				clearTimeout(debounceTimeout);
			}
			isScheduled = true;
			debounceTimeout = setTimeout(() => {
				execute();
			}, options.debounce.wait);
		} else if (options.flush === 'post') {
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
			}

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

export function effectOnce(fn: () => void): void {
	const handle = effect(() => {
		fn();
		handle.stop();
	});
}

export { batch } from '../reactivity/dep.js';
export type { OnCleanup } from '../types/index.js';
