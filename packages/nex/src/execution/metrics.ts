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

import type {
	FieldTrace,
	Instrumentation,
	OperationTrace,
} from './instrumentation.js';

/** How much of one thing a server has seen. */
export interface Tally {
	/** How many there were. */
	readonly total: number;
	/** How many of those carried a problem. */
	readonly failed: number;
	/** How long they took altogether, in milliseconds. */
	readonly totalDurationMs: number;
	/** The longest one seen, in milliseconds. */
	readonly slowestMs: number;
}

/** What a server has seen since it started, or since it last forgot. */
export interface MetricsSnapshot {
	readonly operations: Tally & {
		/** What the requests were priced at altogether. */
		readonly totalCost: number;
		/** The same tally, per named operation. */
		readonly byName: Readonly<Record<string, Tally>>;
	};
	/** A tally per field that had a resolver, by coordinate. */
	readonly fields: Readonly<Record<string, Tally>>;
}

/** How much to remember. */
export interface MetricsOptions {
	/**
	 * How many names to keep a tally for. Defaults to 200.
	 *
	 * An operation name comes from whoever sent the request, so keeping one
	 * tally per name is a way to be run out of memory by a caller that makes
	 * up a new name each time. Once this many are held, the totals still
	 * count everything and only the breakdown stops growing.
	 */
	readonly maxNames?: number | undefined;
}

/** Counting what a server has seen, and reading it back. */
export interface Metrics {
	/** Hand this to a run, and it counts itself. */
	readonly instrumentation: Instrumentation;
	/** What has been seen so far, as of now. */
	readonly snapshot: () => MetricsSnapshot;
	/** Forget everything counted so far. */
	readonly reset: () => void;
}

interface Counter {
	total: number;
	failed: number;
	totalDurationMs: number;
	slowestMs: number;
}

const empty = (): Counter => ({
	total: 0,
	failed: 0,
	totalDurationMs: 0,
	slowestMs: 0,
});

const record = (
	counter: Counter,
	durationMs: number,
	failed: boolean
): void => {
	counter.total += 1;
	if (failed) counter.failed += 1;
	counter.totalDurationMs += durationMs;
	counter.slowestMs = Math.max(counter.slowestMs, durationMs);
};

const readOut = (
	counters: ReadonlyMap<string, Counter>
): Record<string, Tally> => {
	const out: Record<string, Tally> = {};
	for (const [key, counter] of counters) out[key] = { ...counter };
	return out;
};

const DEFAULT_MAX_NAMES = 200;

/**
 * Count what a server is doing, without deciding where the numbers go.
 *
 * The hooks a run reports through say what happened once; this is what turns
 * that into a number a server can read - how many requests, how many carried
 * problems, what they cost, and which field is the slow one. Hand the
 * snapshot to whatever scrapes it.
 *
 * Nothing here is a timer or a background task: counting happens on the run
 * that is already happening, and reading is a copy of what has been counted.
 */
export const createMetrics = (options: MetricsOptions = {}): Metrics => {
	const maxNames = options.maxNames ?? DEFAULT_MAX_NAMES;

	let operations = empty();
	let totalCost = 0;
	let byName = new Map<string, Counter>();
	let fields = new Map<string, Counter>();

	const forName = (name: string): Counter | undefined => {
		const already = byName.get(name);
		if (already !== undefined) return already;
		if (byName.size >= maxNames) return undefined;

		const fresh = empty();
		byName.set(name, fresh);
		return fresh;
	};

	const onOperation = (trace: OperationTrace): void => {
		const failed = trace.errorCount > 0;
		record(operations, trace.durationMs, failed);
		totalCost += trace.cost;

		if (trace.operationName === undefined) return;
		const named = forName(trace.operationName);
		if (named !== undefined) record(named, trace.durationMs, failed);
	};

	const onField = (trace: FieldTrace): void => {
		const coordinate = `${trace.parentTypeName}.${trace.fieldName}`;
		const counter = fields.get(coordinate) ?? empty();
		fields.set(coordinate, counter);
		record(counter, trace.durationMs, trace.failed);
	};

	return {
		instrumentation: { onOperation, onField },
		snapshot: () => ({
			operations: {
				...operations,
				totalCost,
				byName: readOut(byName),
			},
			fields: readOut(fields),
		}),
		reset: () => {
			operations = empty();
			totalCost = 0;
			byName = new Map();
			fields = new Map();
		},
	};
};
