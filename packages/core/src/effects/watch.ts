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

import { signal, isSignal } from '../reactivity/signal.js';
import { isReactive } from '../reactivity/reactive.js';
import type {
	EffectHandle,
	WatchOptions,
	OnCleanup,
	CleanupFn,
	Signal,
	ReadonlySignal,
} from '../types/index.js';
import { effect } from './effect.js';

export type WatchSource<T> =
	| Signal<T>
	| ReadonlySignal<T>
	| (() => T)
	| (T extends object ? T : never);

export type WatchCallback<T> = (
	newValue: T,
	oldValue: T | undefined,
	onCleanup: OnCleanup
) => void | Promise<void>;

export type DeepWatchCallback<T> = (
	newValue: T,
	oldValue: T,
	onCleanup: OnCleanup
) => void | Promise<void>;

export function watch<T>(
	source: WatchSource<T>,
	callback: WatchCallback<T>,
	options: WatchOptions = {}
): EffectHandle {
	let oldValue: T | undefined;
	let hasRun = false;
	let cleanupQueue: CleanupFn[] = [];

	const runCleanups = (): void => {
		for (const cleanup of cleanupQueue) {
			try {
				cleanup();
			} catch {}
		}
		cleanupQueue = [];
	};

	const onCleanup: OnCleanup = (cleanupFn) => {
		cleanupQueue.push(cleanupFn);
	};

	const getter = createGetter(source, options.deep);

	const handle = effect(
		() => {
			const newValue = getter();

			if (!hasRun) {
				hasRun = true;
				oldValue = options.deep ? deepClone(newValue) : newValue;

				if (options.immediate) {
					runCleanups();
					const result = callback(newValue, undefined, onCleanup);
					if (result instanceof Promise) {
						void result;
					}
				}
				return;
			}

			if (options.deep || !Object.is(newValue, oldValue)) {
				runCleanups();
				const result = callback(newValue, oldValue, onCleanup);
				if (result instanceof Promise) {
					void result;
				}
				oldValue = options.deep ? deepClone(newValue) : newValue;
			}

			if (options.once) {
				handle.stop();
			}
		},
		{
			...options,
			immediate: true,
		}
	);

	return handle;
}

const createGetter = <T>(source: WatchSource<T>, deep?: boolean): (() => T) => {
	if (typeof source === 'function') {
		return source as () => T;
	}

	if (isSignal<T>(source)) {
		return () => source.value;
	}

	if (isReactive(source)) {
		if (deep) {
			return () => {
				traverse(source);
				return source as T;
			};
		}
		return () => source as T;
	}

	const sig = signal(source as T);
	return () => sig.value;
};

const traverse = (value: unknown, seen = new WeakSet()): void => {
	if (typeof value !== 'object' || value === null) {
		return;
	}

	if (seen.has(value)) {
		return;
	}

	seen.add(value);

	if (Array.isArray(value)) {
		for (const item of value) {
			traverse(item, seen);
		}
	} else {
		for (const key of Object.keys(value)) {
			traverse((value as Record<string, unknown>)[key], seen);
		}
	}
};

const deepClone = <T>(value: T): T => {
	if (typeof value !== 'object' || value === null) {
		return value;
	}

	if (Array.isArray(value)) {
		return value.map(deepClone) as T;
	}

	const cloned: Record<string, unknown> = {};
	for (const key of Object.keys(value)) {
		cloned[key] = deepClone((value as Record<string, unknown>)[key]);
	}
	return cloned as T;
};

export const watchMultiple = <T extends readonly WatchSource<unknown>[]>(
	sources: T,
	callback: (
		newValues: {
			[K in keyof T]: T[K] extends WatchSource<infer V> ? V : never;
		},
		oldValues: {
			[K in keyof T]: T[K] extends WatchSource<infer V> ? V | undefined : never;
		},
		onCleanup: OnCleanup
	) => void | Promise<void>,
	options?: WatchOptions
): EffectHandle => {
	const getters = sources.map((source) => createGetter(source, options?.deep));
	let oldValues: unknown[] = [];
	let hasRun = false;
	let cleanupQueue: CleanupFn[] = [];

	const runCleanups = (): void => {
		for (const cleanup of cleanupQueue) {
			try {
				cleanup();
			} catch {}
		}
		cleanupQueue = [];
	};

	const onCleanup: OnCleanup = (cleanupFn) => {
		cleanupQueue.push(cleanupFn);
	};

	const handle = effect(
		() => {
			const newValues = getters.map((getter) => getter());

			if (!hasRun) {
				hasRun = true;
				oldValues = newValues.map((v) => (options?.deep ? deepClone(v) : v));

				if (options?.immediate) {
					runCleanups();
					const result = callback(
						newValues as never,
						new Array(sources.length).fill(undefined) as never,
						onCleanup
					);
					if (result instanceof Promise) void result;
				}
				return;
			}

			const hasChanged = newValues.some((v, i) => !Object.is(v, oldValues[i]));

			if (hasChanged || options?.deep) {
				runCleanups();
				const result = callback(
					newValues as never,
					oldValues as never,
					onCleanup
				);
				if (result instanceof Promise) void result;
				oldValues = newValues.map((v) => (options?.deep ? deepClone(v) : v));
			}

			if (options?.once) {
				handle.stop();
			}
		},
		{ ...options, immediate: true }
	);

	return handle;
};
