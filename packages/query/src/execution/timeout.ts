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

import { Effect, Duration } from 'effect';
import { TimeoutError } from '../errors/index.js';
import { DEFAULT_TIMEOUT_MS } from '../config/index.js';

const applyTimeout = <A, E>(
	effect: Effect.Effect<A, E>,
	timeoutMs: number,
	queryKey?: readonly unknown[]
): Effect.Effect<A, E | TimeoutError> =>
	effect.pipe(
		Effect.timeoutFail({
			duration: Duration.millis(timeoutMs),
			onTimeout: () =>
				new TimeoutError({
					durationMs: timeoutMs,
					queryKey,
				}),
		})
	);

const withDefaultTimeout = <A, E>(
	effect: Effect.Effect<A, E>,
	queryKey?: readonly unknown[]
): Effect.Effect<A, E | TimeoutError> =>
	applyTimeout(effect, DEFAULT_TIMEOUT_MS, queryKey);

export { applyTimeout, withDefaultTimeout };
