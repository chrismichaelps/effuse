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

const TrackingContextStack: Set<Dep>[] = [];

let BatchQueue: Set<() => void> | null = null;
let BatchDepth = 0;
let GlobalVersion = 0;
let TrackingPaused = false;

let pendingEffects = new Set<() => void>();
let effectExecutionDepth = 0;

function flushPendingEffects(): void {
	if (effectExecutionDepth > 0) return;

	while (pendingEffects.size > 0) {
		const effects = [...pendingEffects];
		pendingEffects.clear();
		effectExecutionDepth++;
		try {
			for (const effect of effects) {
				effect();
			}
		} finally {
			effectExecutionDepth--;
		}
	}
}

export class Dep {
	version = 0;
	private subscribers = new Set<() => void>();

	track(): void {
		if (TrackingPaused) return;

		const current = TrackingContextStack[TrackingContextStack.length - 1];
		if (current) {
			current.add(this);
		}
	}

	trigger(): void {
		this.version++;
		GlobalVersion++;
		if (BatchDepth > 0 && BatchQueue) {
			for (const sub of this.subscribers) {
				BatchQueue.add(sub);
			}
		} else {
			for (const sub of this.subscribers) {
				pendingEffects.add(sub);
			}

			if (effectExecutionDepth === 0 && pendingEffects.size > 0) {
				flushPendingEffects();
			}
		}
	}

	subscribe(callback: () => void): () => void {
		this.subscribers.add(callback);
		return () => this.subscribers.delete(callback);
	}

	hasSubscribers(): boolean {
		return this.subscribers.size > 0;
	}

	clear(): void {
		this.subscribers.clear();
	}
}

export function getTrackedDeps(): Dep[] {
	const current = TrackingContextStack[TrackingContextStack.length - 1];
	return current ? [...current] : [];
}

export function startTracking(): void {
	TrackingContextStack.push(new Set());
}

export function stopTracking(): Dep[] {
	const deps = getTrackedDeps();
	TrackingContextStack.pop();
	return deps;
}

export function batch<T>(fn: () => T): T {
	BatchDepth++;
	if (!BatchQueue) {
		BatchQueue = new Set();
	}
	const currentQueue = BatchQueue;
	try {
		return fn();
	} finally {
		BatchDepth--;
		if (BatchDepth === 0) {
			BatchQueue = null;
			for (const cb of currentQueue) {
				cb();
			}
		}
	}
}

export function untrack<T>(fn: () => T): T {
	const wasPaused = TrackingPaused;
	TrackingPaused = true;
	try {
		return fn();
	} finally {
		TrackingPaused = wasPaused;
	}
}

export function getTrackingPaused(): boolean {
	return TrackingPaused;
}

export function pauseTracking(): void {
	TrackingPaused = true;
}

export function resumeTracking(): void {
	TrackingPaused = false;
}

export function isTracking(): boolean {
	return !TrackingPaused && TrackingContextStack.length > 0;
}

export function startBatch(): void {
	BatchDepth++;
	if (!BatchQueue) {
		BatchQueue = new Set();
	}
}

export function endBatch(): void {
	BatchDepth--;
	if (BatchDepth === 0 && BatchQueue) {
		const queue = BatchQueue;
		BatchQueue = null;
		for (const cb of queue) {
			cb();
		}
	}
}

export function getGlobalVersion(): number {
	return GlobalVersion;
}

export function createScope<T>(fn: (dispose: () => void) => T): T {
	const disposers: (() => void)[] = [];

	const runDisposers = (): void => {
		const toRun = [...disposers].reverse();
		for (const d of toRun) {
			d();
		}
	};

	try {
		return fn(runDisposers);
	} catch (err) {
		runDisposers();
		throw err;
	}
}

export function executeUpdates<T>(fn: () => T, init: boolean): T {
	if (init) {
		return fn();
	}
	return batch(fn);
}
