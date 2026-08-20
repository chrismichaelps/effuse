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

import type { NexExecutionError } from '../errors/index.js';
import type { OperationType } from '../language/kinds/index.js';

/** What one run did, once it is over. */
export interface OperationTrace {
	/** The trace this run was carried under. */
	readonly traceId: string;
	/** Which kind of operation ran. */
	readonly operation: OperationType;
	/** Its name, when it was given one. */
	readonly operationName: string | undefined;
	/** What the request was priced at. */
	readonly cost: number;
	/** How long the run took, in milliseconds. */
	readonly durationMs: number;
	/** How many problems the response carried. */
	readonly errorCount: number;
	/** Whether anything was resolved, or the request was refused first. */
	readonly ran: boolean;
}

/**
 * Where a server watches its own runs.
 *
 * A handler that answers thousands of requests needs to know which ones were
 * slow, which failed, and what they cost, and it should learn that without the
 * package deciding where the numbers go.
 */
export interface Instrumentation {
	/** Called once per run, after the response is built. */
	readonly onOperation?: ((trace: OperationTrace) => void) | undefined;
	/** Called for each field that failed, as it fails. */
	readonly onFieldError?: ((error: NexExecutionError) => void) | undefined;
}

/**
 * Call a watcher without letting it break what it watches.
 *
 * Telemetry is a side channel: a sink that is down, or a callback that throws,
 * must not turn a good response into a failed one.
 */
export const notify = (call: () => void): void => {
	try {
		call();
	} catch {
		// A watcher's problem is its own.
	}
};

/**
 * Name a run so its parts can be found together afterwards.
 *
 * Uses the platform's own generator where there is one, and falls back to
 * random text where there is not, since a trace only has to be unique among
 * the runs a server is holding.
 */
export const newTraceId = (): string => {
	const generator = globalThis.crypto;
	if (typeof generator?.randomUUID === 'function')
		return generator.randomUUID();

	return `nex-${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`;
};
