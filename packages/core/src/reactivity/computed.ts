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

import type { ReadonlySignal, Signal } from '../types/index.js';
import {
	Dep,
	startTracking,
	stopTracking,
	getTrackingPaused,
	resumeTracking,
	pauseTracking,
	untrack,
	getGlobalVersion,
} from './dep.js';

/**
 * A computed holds subscriptions on its sources only while something observes
 * it. Subscribing for the lifetime of the source made every source retain
 * every computed that ever read it, because the subscriber closure captures
 * the cell and a computed that is never read again never releases anything.
 *
 * While unobserved the cell validates by version instead: a global version
 * counter rules out the common case in one comparison, and only when that
 * moves does it compare the recorded version of each source.
 */
class ComputedCell<T> {
	private cachedValue: T | undefined;
	private isDirty = true;
	private depInstance = new Dep();
	private getter: () => T;
	private unsubscribers: (() => void)[] = [];
	private computeVersion = 0;
	private stopped = false;
	private trackedDeps: Dep[] = [];
	private trackedVersions: number[] = [];
	private observed = false;
	private validatedGlobalVersion = -1;
	private validating = false;

	constructor(getter: () => T) {
		this.getter = getter;
		this.depInstance.computedOwner = this;
		this.depInstance.onObservationChange((observed) => {
			this.observed = observed;
			if (observed) {
				this.attachSources();
			} else {
				this.cleanup();
			}
		});
	}

	/**
	 * Observed cells learn about changes by push, so `isDirty` answers on its
	 * own and nothing else belongs on this path. Unobserved cells hold no
	 * subscriptions and must pull, but a global version that has not moved
	 * rules that out in one comparison.
	 */
	get value(): T {
		this.depInstance.track();
		if (this.isDirty) {
			this.recompute();
		} else if (
			!this.observed &&
			!this.stopped &&
			getGlobalVersion() !== this.validatedGlobalVersion
		) {
			this.revalidate();
		}
		return this.cachedValue as T;
	}

	/** Establish whether a moved global version actually reached this cell. */
	private revalidate(): void {
		// An unobserved source that is itself a computed has not recomputed, so
		// its dep version cannot answer for it yet. Refresh those sources first,
		// which is what lets a change travel through a chain nobody observes.
		for (const dep of this.trackedDeps) {
			dep.computedOwner?.validate();
		}
		this.validatedGlobalVersion = getGlobalVersion();

		if (
			this.isDirty ||
			this.trackedDeps.some(
				(dep, index) => dep.version !== this.trackedVersions[index]
			)
		) {
			this.recompute();
		}
	}

	/** Bring this cell up to date without reporting a read. */
	validate(): void {
		if (this.validating) return;
		this.validating = true;
		try {
			if (this.isDirty) {
				this.recompute();
			} else if (
				!this.observed &&
				!this.stopped &&
				getGlobalVersion() !== this.validatedGlobalVersion
			) {
				this.revalidate();
			}
		} finally {
			this.validating = false;
		}
	}

	private attachSources(): void {
		if (this.stopped || this.unsubscribers.length > 0) return;

		for (const trackedDep of this.trackedDeps) {
			this.unsubscribers.push(trackedDep.subscribe(() => this.markDirty()));
		}

		// A source may have moved on while nothing was listening.
		const stale = this.trackedDeps.some(
			(dep, index) => dep.version !== this.trackedVersions[index]
		);
		if (stale) {
			this.markDirty();
		}
	}

	get dirty(): boolean {
		return this.isDirty;
	}

	get dep(): Dep {
		return this.depInstance;
	}

	private recompute(): void {
		this.cleanup();
		if (this.stopped) {
			this.cachedValue = untrack(this.getter);
			this.isDirty = false;
			return;
		}

		const wasPaused = getTrackingPaused();
		resumeTracking();
		startTracking();

		try {
			const newValue = this.getter();
			const hasChanged = !Object.is(this.cachedValue, newValue);
			this.cachedValue = newValue;
			this.isDirty = false;
			this.computeVersion++;

			const trackedDeps = stopTracking();

			this.trackedDeps = trackedDeps;
			this.trackedVersions = trackedDeps.map((dep) => dep.version);
			this.validatedGlobalVersion = getGlobalVersion();

			if (this.observed) {
				this.attachSources();
			}

			if (hasChanged) {
				this.depInstance.trigger();
			}
		} catch (err) {
			stopTracking();
			throw err;
		} finally {
			if (wasPaused) {
				pauseTracking();
			}
		}
	}

	private markDirty(): void {
		if (!this.isDirty) {
			this.isDirty = true;
			this.depInstance.trigger();
		}
	}

	private cleanup(): void {
		for (const unsub of this.unsubscribers) {
			unsub();
		}
		this.unsubscribers = [];
	}

	stop(): void {
		this.cleanup();
		this.stopped = true;
	}
}

/**
 * Prototype accessors for the same reason as `SignalCell`: defining them per
 * instance forces a fresh hidden class for every computed created.
 */
class ComputedSignal<T> {
	constructor(private readonly cell: ComputedCell<T>) {}

	get value(): T {
		return this.cell.value;
	}

	get _dep(): Dep {
		return this.cell.dep;
	}

	/** Not enumerable surface; read only by `disposeComputed`. */
	get _cell(): ComputedCell<T> {
		return this.cell;
	}
}

// Build computed signal
export function computed<T>(getter: () => T): ReadonlySignal<T> {
	return new ComputedSignal(new ComputedCell(getter)) as ReadonlySignal<T>;
}

/** Stops dependency subscriptions owned by a computed signal. */
export const disposeComputed = (source: ReadonlySignal<unknown>): void => {
	// A writable view wraps a computed rather than being one, so matching only
	// `ComputedSignal` made disposal a silent no-op for it.
	if (source instanceof WritableComputedSignal) {
		disposeComputed(source._source);
		return;
	}
	if (source instanceof ComputedSignal) {
		source._cell.stop();
	}
};

/**
 * Writable view over a computed.
 *
 * Carries `_dep` through from the underlying computed, because that is what
 * `isSignal` tests for. Forwarding only `value` left the result typed as
 * `Signal<T>` while failing every runtime check: `unref` handed back the
 * wrapper, `getSignalDep` returned null, and binding one to a prop rendered no
 * attribute at all, since an unrecognised object matches no branch in
 * `setElementProp`.
 *
 * Prototype accessors for the same reason as `SignalCell` and `ComputedSignal`:
 * defining them per instance forces a fresh hidden class for every one created.
 */
class WritableComputedSignal<T> {
	constructor(
		private readonly source: ReadonlySignal<T>,
		private readonly write: (value: T) => void
	) {}

	get value(): T {
		return this.source.value;
	}

	set value(next: T) {
		this.write(next);
	}

	get _dep(): Dep | null {
		return (this.source as unknown as { _dep: Dep })._dep;
	}

	/** Not enumerable surface; read only by `disposeComputed`. */
	get _source(): ReadonlySignal<T> {
		return this.source;
	}
}

// Build writable computed signal
export function writableComputed<T>(options: {
	get: () => T;
	set: (value: T) => void;
}): Signal<T> {
	return new WritableComputedSignal(
		computed(options.get),
		options.set
	) as unknown as Signal<T>;
}
