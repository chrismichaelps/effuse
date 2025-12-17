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
} from './dep.js';

class ComputedCell<T> {
	private cachedValue: T | undefined;
	private isDirty = true;
	private depInstance = new Dep();
	private getter: () => T;
	private unsubscribers: (() => void)[] = [];
	private computeVersion = 0;

	constructor(getter: () => T) {
		this.getter = getter;
		this.recompute();
	}

	get value(): T {
		this.depInstance.track();
		if (this.isDirty) {
			this.recompute();
		}
		return this.cachedValue as T;
	}

	get dirty(): boolean {
		return this.isDirty;
	}

	get dep(): Dep {
		return this.depInstance;
	}

	private recompute(): void {
		this.cleanup();

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

			for (const trackedDep of trackedDeps) {
				const unsub = trackedDep.subscribe(() => {
					this.markDirty();
				});
				this.unsubscribers.push(unsub);
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
	}
}

export function computed<T>(getter: () => T): ReadonlySignal<T> {
	const cell = new ComputedCell(getter);

	const computedSignal = {
		get value(): T {
			return cell.value;
		},
		get _dep() {
			return cell.dep;
		},
	};

	return computedSignal as ReadonlySignal<T>;
}

export function writableComputed<T>(options: {
	get: () => T;
	set: (value: T) => void;
}): Signal<T> {
	const readonlyComputed = computed(options.get);

	return {
		get value(): T {
			return readonlyComputed.value;
		},
		set value(newValue: T) {
			options.set(newValue);
		},
	};
}
