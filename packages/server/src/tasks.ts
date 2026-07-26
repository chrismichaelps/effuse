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

/**
 * Recurring background work, owned by the framework so applications do not
 * rebuild it on a bare `setInterval` and get the hard parts wrong.
 *
 * The properties that matter in production, in the order they bite:
 *
 * - **No overlap.** A tick arriving while the previous run is still in flight
 *   is *skipped*, never queued. Queueing turns a temporarily slow dependency
 *   into an unbounded backlog, precisely when it is already struggling.
 * - **Error isolation.** A throwing task is reported and rescheduled. It never
 *   rejects into the process and never stops the other tasks.
 * - **Graceful stop.** `stop()` cancels future ticks and awaits in-flight runs,
 *   aborting their signal so a task can cooperate, bounded by a timeout so a
 *   task that ignores the signal cannot hang shutdown forever.
 * - **Observability.** Every run reports start, success, failure, or skip with
 *   a duration, so a task that quietly stopped working is visible.
 *
 * Multi-instance boundary: without a shared lock, N instances run a task N
 * times. Applications that need exactly-once semantics across instances must
 * supply their own lock. This is a documented property, not an oversight —
 * silently running a billing job N times would be worse than not shipping it.
 */

export interface TaskContext {
	/** Aborted when the scheduler stops, so a run can exit cooperatively. */
	readonly signal: AbortSignal;
	readonly name: string;
}

export interface TaskDefinition {
	readonly name: string;
	/** Milliseconds between runs. Must be positive. */
	readonly intervalMs: number;
	/** Run once immediately on `start()` instead of after one interval. */
	readonly runOnStart?: boolean;
	readonly run: (context: TaskContext) => void | Promise<void>;
}

export type TaskEventType = 'start' | 'success' | 'failure' | 'skip';

export interface TaskEvent {
	readonly type: TaskEventType;
	readonly name: string;
	readonly durationMs?: number;
	readonly error?: unknown;
}

export interface TaskSchedulerOptions {
	readonly onEvent?: (event: TaskEvent) => void;
}

export interface TaskStopOptions {
	/** Milliseconds to await in-flight runs before returning anyway. */
	readonly timeoutMs?: number;
}

export interface TaskScheduler {
	register(task: TaskDefinition): void;
	start(): void;
	stop(options?: TaskStopOptions): Promise<void>;
	readonly running: boolean;
}

/** Default budget for awaiting in-flight task runs during shutdown. */
export const DEFAULT_TASK_STOP_TIMEOUT_MS = 10_000;

interface TaskState {
	readonly definition: TaskDefinition;
	timer: ReturnType<typeof setInterval> | undefined;
	inFlight: Promise<void> | undefined;
}

export const createTaskScheduler = (
	options: TaskSchedulerOptions = {}
): TaskScheduler => {
	const tasks = new Map<string, TaskState>();
	const emit = options.onEvent;
	let started = false;
	let controller: AbortController | undefined;

	const runOnce = (state: TaskState): void => {
		// Overlap guard: skip rather than queue.
		if (state.inFlight) {
			emit?.({ type: 'skip', name: state.definition.name });
			return;
		}

		const signal = controller?.signal ?? new AbortController().signal;
		const startedAt = Date.now();
		emit?.({ type: 'start', name: state.definition.name });

		// Defer the body by a microtask so `state.inFlight` is assigned before
		// anything can clear it. An async IIFE would run synchronously through
		// its `finally` when `run` throws synchronously, clearing the flag
		// before the assignment below and wedging the task permanently.
		const settle = Promise.resolve().then(async () => {
			try {
				await state.definition.run({
					signal,
					name: state.definition.name,
				});
				emit?.({
					type: 'success',
					name: state.definition.name,
					durationMs: Date.now() - startedAt,
				});
			} catch (error) {
				// Isolated: reported, never rethrown into the timer callback,
				// so one task cannot take down the process or its siblings.
				emit?.({
					type: 'failure',
					name: state.definition.name,
					durationMs: Date.now() - startedAt,
					error,
				});
			} finally {
				state.inFlight = undefined;
			}
		});

		state.inFlight = settle;
	};

	const scheduler: TaskScheduler = {
		register(task) {
			if (tasks.has(task.name)) {
				throw new TypeError(`Duplicate scheduled task name "${task.name}".`);
			}
			if (!Number.isFinite(task.intervalMs) || task.intervalMs <= 0) {
				throw new TypeError(
					`Scheduled task "${task.name}" requires a positive intervalMs.`
				);
			}
			tasks.set(task.name, {
				definition: task,
				timer: undefined,
				inFlight: undefined,
			});
		},

		start() {
			if (started) return;
			started = true;
			controller = new AbortController();

			for (const state of tasks.values()) {
				if (state.definition.runOnStart) runOnce(state);
				state.timer = setInterval(() => {
					runOnce(state);
				}, state.definition.intervalMs);
				// Never hold the process open for a background timer.
				(state.timer as { unref?: () => void }).unref?.();
			}
		},

		async stop(stopOptions = {}) {
			if (!started) return;
			started = false;

			for (const state of tasks.values()) {
				if (state.timer !== undefined) clearInterval(state.timer);
				state.timer = undefined;
			}

			// Ask in-flight runs to wind down, then await them within budget.
			controller?.abort();
			controller = undefined;

			const pending = [...tasks.values()]
				.map((state) => state.inFlight)
				.filter((value): value is Promise<void> => value !== undefined);
			if (pending.length === 0) return;

			const timeoutMs = stopOptions.timeoutMs ?? DEFAULT_TASK_STOP_TIMEOUT_MS;
			let timer: ReturnType<typeof setTimeout> | undefined;
			const budget = new Promise<void>((resolve) => {
				timer = setTimeout(resolve, timeoutMs);
				(timer as { unref?: () => void }).unref?.();
			});

			try {
				await Promise.race([Promise.allSettled(pending), budget]);
			} finally {
				if (timer !== undefined) clearTimeout(timer);
			}
		},

		get running() {
			return started;
		},
	};

	return scheduler;
};
