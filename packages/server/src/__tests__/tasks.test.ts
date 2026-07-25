import { describe, it, expect, vi, afterEach } from 'vitest';
import { createTaskScheduler } from '../tasks.js';
import type { TaskEvent } from '../tasks.js';

const tick = async (ms: number): Promise<void> => {
	await vi.advanceTimersByTimeAsync(ms);
};

afterEach(() => {
	vi.useRealTimers();
});

describe('createTaskScheduler', () => {
	it('runs a registered task on its interval', async () => {
		vi.useFakeTimers();
		const scheduler = createTaskScheduler();
		let runs = 0;

		scheduler.register({
			name: 'beat',
			intervalMs: 1000,
			run: () => {
				runs += 1;
			},
		});
		scheduler.start();

		expect(runs).toBe(0); // not until the first interval elapses
		await tick(1000);
		expect(runs).toBe(1);
		await tick(2000);
		expect(runs).toBe(3);

		await scheduler.stop();
	});

	it('runs immediately when runOnStart is set', async () => {
		vi.useFakeTimers();
		const scheduler = createTaskScheduler();
		let runs = 0;

		scheduler.register({
			name: 'warm',
			intervalMs: 1000,
			runOnStart: true,
			run: () => {
				runs += 1;
			},
		});
		scheduler.start();
		await tick(0);

		expect(runs).toBe(1);
		await scheduler.stop();
	});

	it('skips a tick instead of queueing when a run is still in flight', async () => {
		vi.useFakeTimers();
		const scheduler = createTaskScheduler();
		let started = 0;
		let release!: () => void;
		const gate = new Promise<void>((resolve) => {
			release = resolve;
		});

		scheduler.register({
			name: 'slow',
			intervalMs: 100,
			run: async () => {
				started += 1;
				await gate;
			},
		});
		scheduler.start();

		await tick(100); // first run starts and blocks
		expect(started).toBe(1);

		// Several intervals pass while the first run is still in flight.
		await tick(500);
		// Skipped, not queued: a slow dependency must not build a backlog.
		expect(started).toBe(1);

		release();
		await tick(100);
		expect(started).toBe(2);

		await scheduler.stop();
	});

	it('isolates a failing task and keeps scheduling it', async () => {
		vi.useFakeTimers();
		const events: TaskEvent[] = [];
		const scheduler = createTaskScheduler({
			onEvent: (event) => events.push(event),
		});
		let runs = 0;

		scheduler.register({
			name: 'flaky',
			intervalMs: 100,
			run: () => {
				runs += 1;
				throw new Error('task failed');
			},
		});
		scheduler.start();

		await tick(300);

		// It kept running rather than stopping at the first failure.
		expect(runs).toBe(3);
		const failures = events.filter((event) => event.type === 'failure');
		expect(failures).toHaveLength(3);
		expect((failures[0]?.error as Error).message).toBe('task failed');

		await scheduler.stop();
	});

	it('does not let one failing task stop another', async () => {
		vi.useFakeTimers();
		const scheduler = createTaskScheduler({ onEvent: () => undefined });
		let healthy = 0;

		scheduler.register({
			name: 'broken',
			intervalMs: 100,
			run: () => {
				throw new Error('boom');
			},
		});
		scheduler.register({
			name: 'healthy',
			intervalMs: 100,
			run: () => {
				healthy += 1;
			},
		});
		scheduler.start();

		await tick(300);
		expect(healthy).toBe(3);

		await scheduler.stop();
	});

	it('stops scheduling and awaits in-flight work', async () => {
		vi.useFakeTimers();
		const scheduler = createTaskScheduler();
		let completed = false;
		let release!: () => void;
		const gate = new Promise<void>((resolve) => {
			release = resolve;
		});

		scheduler.register({
			name: 'writer',
			intervalMs: 100,
			run: async () => {
				await gate;
				completed = true;
			},
		});
		scheduler.start();
		await tick(100);

		const stopping = scheduler.stop();
		release();
		await vi.advanceTimersByTimeAsync(0);
		await stopping;

		// The in-flight run finished before stop() resolved.
		expect(completed).toBe(true);
	});

	it('aborts the task signal on stop so a task can cooperate', async () => {
		vi.useFakeTimers();
		const scheduler = createTaskScheduler();
		let aborted = false;

		scheduler.register({
			name: 'cooperative',
			intervalMs: 100,
			run: async (ctx) => {
				await new Promise<void>((resolve) => {
					ctx.signal.addEventListener('abort', () => {
						aborted = true;
						resolve();
					});
				});
			},
		});
		scheduler.start();
		await tick(100);

		await scheduler.stop();
		expect(aborted).toBe(true);
	});

	it('bounds stop with a timeout so shutdown cannot hang', async () => {
		vi.useFakeTimers();
		const scheduler = createTaskScheduler();

		scheduler.register({
			name: 'stuck',
			intervalMs: 100,
			// Ignores the abort signal entirely.
			run: () => new Promise<void>(() => undefined),
		});
		scheduler.start();
		await tick(100);

		const stopping = scheduler.stop({ timeoutMs: 500 });
		await vi.advanceTimersByTimeAsync(600);
		await expect(stopping).resolves.toBeUndefined();
	});

	it('is idempotent for repeated start and stop', async () => {
		vi.useFakeTimers();
		const scheduler = createTaskScheduler();
		let runs = 0;

		scheduler.register({
			name: 'once',
			intervalMs: 100,
			run: () => {
				runs += 1;
			},
		});
		scheduler.start();
		scheduler.start(); // must not double-schedule
		await tick(100);
		expect(runs).toBe(1);

		await scheduler.stop();
		await scheduler.stop();
		await tick(500);
		expect(runs).toBe(1); // nothing runs after stop
	});

	it('rejects a duplicate task name', () => {
		const scheduler = createTaskScheduler();
		scheduler.register({ name: 'dup', intervalMs: 100, run: () => undefined });

		expect(() =>
			scheduler.register({ name: 'dup', intervalMs: 100, run: () => undefined })
		).toThrow(/duplicate/i);
	});

	it('rejects a non-positive interval', () => {
		const scheduler = createTaskScheduler();

		expect(() =>
			scheduler.register({ name: 'bad', intervalMs: 0, run: () => undefined })
		).toThrow(/interval/i);
	});

	it('reports start, success, and skip events with durations', async () => {
		vi.useFakeTimers();
		const events: TaskEvent[] = [];
		const scheduler = createTaskScheduler({
			onEvent: (event) => events.push(event),
		});

		scheduler.register({
			name: 'observed',
			intervalMs: 100,
			run: () => undefined,
		});
		scheduler.start();
		await tick(100);

		const types = events.map((event) => event.type);
		expect(types).toContain('start');
		expect(types).toContain('success');
		const success = events.find((event) => event.type === 'success');
		expect(success?.name).toBe('observed');
		expect(success?.durationMs).toBeGreaterThanOrEqual(0);

		await scheduler.stop();
	});
});
