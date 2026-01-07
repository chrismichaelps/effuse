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

import { Schedule, Duration, Option, pipe } from 'effect';
import {
	DEFAULT_RETRY_COUNT,
	DEFAULT_RETRY_DELAY_MS,
	DEFAULT_RETRY_BACKOFF_FACTOR,
	DEFAULT_RETRY_MAX_DELAY_MS,
} from '../config/index.js';

export type BackoffStrategy = 'exponential' | 'constant' | 'linear';

export interface RetryConfig {
	readonly times: number;
	readonly backoff?: BackoffStrategy;
	readonly delayMs?: number;
	readonly maxDelayMs?: number;
	readonly factor?: number;
	readonly jitter?: boolean;
}

export const buildExponentialSchedule = (
	initialDelayMs: number,
	factor: number,
	maxRetries: number,
	_maxDelayMs: number,
	jitter: boolean
): Schedule.Schedule<number> => {
	let schedule = Schedule.exponential(Duration.millis(initialDelayMs), factor);

	if (jitter) {
		schedule = Schedule.jittered(schedule);
	}

	return schedule.pipe(
		Schedule.intersect(Schedule.recurs(maxRetries)),
		Schedule.map(() => maxRetries)
	);
};

export const buildConstantSchedule = (
	delayMs: number,
	maxRetries: number,
	jitter: boolean
): Schedule.Schedule<number> => {
	let schedule = Schedule.spaced(Duration.millis(delayMs));

	if (jitter) {
		schedule = Schedule.jittered(schedule);
	}

	return schedule.pipe(
		Schedule.intersect(Schedule.recurs(maxRetries)),
		Schedule.map(() => maxRetries)
	);
};

export const buildLinearSchedule = (
	initialDelayMs: number,
	maxRetries: number,
	_maxDelayMs: number,
	jitter: boolean
): Schedule.Schedule<number> => {
	let schedule = Schedule.linear(Duration.millis(initialDelayMs));

	if (jitter) {
		schedule = Schedule.jittered(schedule);
	}

	return schedule.pipe(
		Schedule.intersect(Schedule.recurs(maxRetries)),
		Schedule.map(() => maxRetries)
	);
};

export const buildRetrySchedule = (
	config?: RetryConfig
): Schedule.Schedule<number> => {
	const optConfig = Option.fromNullable(config);
	const times = pipe(
		optConfig,
		Option.flatMap((c) => Option.fromNullable(c.times)),
		Option.getOrElse(() => DEFAULT_RETRY_COUNT)
	);
	const backoff = pipe(
		optConfig,
		Option.flatMap((c) => Option.fromNullable(c.backoff)),
		Option.getOrElse((): BackoffStrategy => 'exponential')
	);
	const delayMs = pipe(
		optConfig,
		Option.flatMap((c) => Option.fromNullable(c.delayMs)),
		Option.getOrElse(() => DEFAULT_RETRY_DELAY_MS)
	);
	const maxDelayMs = pipe(
		optConfig,
		Option.flatMap((c) => Option.fromNullable(c.maxDelayMs)),
		Option.getOrElse(() => DEFAULT_RETRY_MAX_DELAY_MS)
	);
	const factor = pipe(
		optConfig,
		Option.flatMap((c) => Option.fromNullable(c.factor)),
		Option.getOrElse(() => DEFAULT_RETRY_BACKOFF_FACTOR)
	);
	const jitter = pipe(
		optConfig,
		Option.flatMap((c) => Option.fromNullable(c.jitter)),
		Option.getOrElse(() => true)
	);

	if (times <= 0) {
		return Schedule.stop.pipe(Schedule.map(() => 0));
	}

	switch (backoff) {
		case 'exponential':
			return buildExponentialSchedule(
				delayMs,
				factor,
				times,
				maxDelayMs,
				jitter
			);
		case 'constant':
			return buildConstantSchedule(delayMs, times, jitter);
		case 'linear':
			return buildLinearSchedule(delayMs, times, maxDelayMs, jitter);
		default:
			return buildExponentialSchedule(
				delayMs,
				factor,
				times,
				maxDelayMs,
				jitter
			);
	}
};

export const buildRefetchSchedule = (
	intervalMs: number
): Schedule.Schedule<number> => {
	return Schedule.forever.pipe(
		Schedule.intersect(Schedule.spaced(Duration.millis(intervalMs))),
		Schedule.map(() => 1)
	);
};
