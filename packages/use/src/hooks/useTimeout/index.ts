import { defineHook, type ReadonlySignal } from '@effuse/core';
import { isClient } from '../../internal/utils.js';
import {
	DEFAULT_TIMEOUT_MS,
	TIMEOUT_UPDATE_INTERVAL_MS,
} from './constants.js';
import { timeoutCallbackFailed, type TimeoutError } from './errors.js';
import { traceTimeout } from './telemetry.js';
import { validateTimeoutDelay } from './utils.js';

export { TimeoutError, type TimeoutErrorCode } from './errors.js';

export type TimeoutStatus = 'idle' | 'running' | 'paused' | 'completed';

export interface UseTimeoutConfig {
	readonly callback: () => void;
	readonly delay?: number;
	readonly immediate?: boolean;
}

export interface UseTimeoutReturn {
	readonly status: ReadonlySignal<TimeoutStatus>;
	readonly remaining: ReadonlySignal<number>;
	readonly isRunning: ReadonlySignal<boolean>;
	readonly isCompleted: ReadonlySignal<boolean>;
	readonly error: ReadonlySignal<TimeoutError | null>;
	readonly start: () => void;
	readonly pause: () => void;
	readonly cancel: () => void;
	readonly restart: () => void;
}

export const useTimeout = defineHook<UseTimeoutConfig, UseTimeoutReturn>({
	name: 'useTimeout',
	setup: (ctx) => {
		const {
			callback,
			delay: configuredDelay = DEFAULT_TIMEOUT_MS,
			immediate = true,
		} = ctx.config;
		const delay = validateTimeoutDelay(configuredDelay);
		const status = ctx.signal<TimeoutStatus>('idle');
		const remaining = ctx.signal(delay);
		const error = ctx.signal<TimeoutError | null>(null);
		const running = ctx.computed(() => status.value === 'running');
		const completed = ctx.computed(() => status.value === 'completed');
		let timerId: ReturnType<typeof setTimeout> | null = null;
		let deadline = 0;
		let generation = 0;
		let ownerDisposed = false;

		traceTimeout('init', { 'timeout.delay': delay, 'timeout.immediate': immediate });

		const clearTimer = (): void => {
			generation += 1;
			if (timerId !== null) {
				clearTimeout(timerId);
				timerId = null;
			}
		};

		const finish = (): void => {
			timerId = null;
			remaining.value = 0;
			status.value = 'completed';
			traceTimeout('complete');
			try {
				callback();
			} catch (cause) {
				error.value = timeoutCallbackFailed(cause);
				traceTimeout('error');
			}
		};

		const schedule = (duration: number): void => {
			clearTimer();
			const currentGeneration = generation;
			deadline = Date.now() + duration;
			remaining.value = duration;
			status.value = 'running';

			const tick = (): void => {
				if (currentGeneration !== generation) return;
				const nextRemaining = Math.max(0, deadline - Date.now());
				remaining.value = nextRemaining;
				if (nextRemaining === 0) {
					finish();
					return;
				}
				timerId = setTimeout(
					tick,
					Math.min(nextRemaining, TIMEOUT_UPDATE_INTERVAL_MS)
				);
			};

			timerId = setTimeout(
				tick,
				Math.min(duration, TIMEOUT_UPDATE_INTERVAL_MS)
			);
		};

		const start = (): void => {
			if (ownerDisposed || !isClient() || status.value === 'running') return;
			error.value = null;
			const duration = status.value === 'paused' ? remaining.value : delay;
			traceTimeout('start', { 'timeout.remaining': duration });
			schedule(duration);
		};

		const pause = (): void => {
			if (ownerDisposed || status.value !== 'running') return;
			const nextRemaining = Math.max(0, deadline - Date.now());
			clearTimer();
			remaining.value = nextRemaining;
			status.value = 'paused';
			traceTimeout('pause', { 'timeout.remaining': nextRemaining });
		};

		const cancel = (): void => {
			if (ownerDisposed) return;
			clearTimer();
			remaining.value = delay;
			status.value = 'idle';
			error.value = null;
			traceTimeout('cancel');
		};

		const restart = (): void => {
			if (ownerDisposed) return;
			clearTimer();
			remaining.value = delay;
			status.value = 'idle';
			error.value = null;
			traceTimeout('restart');
			if (isClient()) schedule(delay);
		};

		ctx.onMount(() => {
			if (immediate) start();
			return () => {
				ownerDisposed = true;
				clearTimer();
				remaining.value = delay;
				status.value = 'idle';
				error.value = null;
			};
		});

		return {
			status,
			remaining,
			isRunning: running,
			isCompleted: completed,
			error,
			start,
			pause,
			cancel,
			restart,
		};
	},
});
