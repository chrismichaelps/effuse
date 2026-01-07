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

import { Array as Arr, Option, Predicate, Record as Rec, pipe } from 'effect';
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

const getDeepOption = (options: WatchOptions | undefined): boolean =>
	pipe(
		Option.fromNullable(options),
		Option.flatMap((o) => Option.fromNullable(o.deep)),
		Option.getOrElse(() => false)
	);

const getImmediateOption = (options: WatchOptions | undefined): boolean =>
	pipe(
		Option.fromNullable(options),
		Option.flatMap((o) => Option.fromNullable(o.immediate)),
		Option.getOrElse(() => false)
	);

const getOnceOption = (options: WatchOptions | undefined): boolean =>
	pipe(
		Option.fromNullable(options),
		Option.flatMap((o) => Option.fromNullable(o.once)),
		Option.getOrElse(() => false)
	);

const createCleanupRunner = (): {
	queue: CleanupFn[];
	run: () => void;
	register: OnCleanup;
} => {
	let queue: CleanupFn[] = [];
	return {
		get queue() {
			return queue;
		},
		run: () => {
			Arr.forEach(queue, (cleanup) => {
				try {
					cleanup();
				} catch {
					/* silent */
				}
			});
			queue = [];
		},
		register: (fn) => {
			queue.push(fn);
		},
	};
};

const handleAsyncResult = (result: void | Promise<void>): void => {
	if (result instanceof Promise) {
		void result;
	}
};

export function watch<T>(
	source: WatchSource<T>,
	callback: WatchCallback<T>,
	options: WatchOptions = {}
): EffectHandle {
	let oldValue: T | undefined;
	let hasRun = false;
	const cleanup = createCleanupRunner();
	const deep = getDeepOption(options);
	const immediate = getImmediateOption(options);
	const once = getOnceOption(options);
	const getter = createGetter(source, deep);

	const handle = effect(
		() => {
			const newValue = getter();

			if (!hasRun) {
				hasRun = true;
				oldValue = deep ? deepClone(newValue) : newValue;
				if (immediate) {
					cleanup.run();
					handleAsyncResult(callback(newValue, undefined, cleanup.register));
				}
				return;
			}

			if (deep || !Object.is(newValue, oldValue)) {
				cleanup.run();
				handleAsyncResult(callback(newValue, oldValue, cleanup.register));
				oldValue = deep ? deepClone(newValue) : newValue;
			}

			if (once) {
				handle.stop();
			}
		},
		{ ...options, immediate: true }
	);

	return handle;
}

const createGetter = <T>(source: WatchSource<T>, deep: boolean): (() => T) => {
	if (Predicate.isFunction(source)) {
		return source as () => T;
	}
	if (isSignal<T>(source)) {
		return () => source.value;
	}
	if (isReactive(source)) {
		return deep
			? () => {
					traverse(source);
					return source as T;
				}
			: () => source as T;
	}
	const sig = signal(source as T);
	return () => sig.value;
};

const traverse = (value: unknown, seen = new WeakSet()): void => {
	if (!Predicate.isObject(value)) return;
	if (seen.has(value)) return;
	seen.add(value);

	if (Array.isArray(value)) {
		Arr.forEach(value, (item) => {
			traverse(item, seen);
		});
	} else {
		Arr.forEach(Rec.keys(value as Record<string, unknown>), (key) => {
			traverse((value as Record<string, unknown>)[key], seen);
		});
	}
};

const deepClone = <T>(value: T): T => {
	if (!Predicate.isObject(value)) return value;

	if (Array.isArray(value)) {
		return Arr.map(value, deepClone) as T;
	}

	return pipe(
		Rec.map(value as Record<string, unknown>, deepClone),
		(cloned) => cloned as T
	);
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
	const deep = getDeepOption(options);
	const immediate = getImmediateOption(options);
	const once = getOnceOption(options);
	const getters = Arr.map(sources, (source) => createGetter(source, deep));
	let oldValues: unknown[] = [];
	let hasRun = false;
	const cleanup = createCleanupRunner();

	const handle = effect(
		() => {
			const newValues = Arr.map(getters, (getter) => getter());

			if (!hasRun) {
				hasRun = true;
				oldValues = Arr.map(newValues, (v) => (deep ? deepClone(v) : v));
				if (immediate) {
					cleanup.run();
					handleAsyncResult(
						callback(
							newValues as never,
							Arr.replicate(undefined, sources.length) as never,
							cleanup.register
						)
					);
				}
				return;
			}

			const hasChanged = Arr.some(
				newValues,
				(v, i) => !Object.is(v, oldValues[i])
			);

			if (hasChanged || deep) {
				cleanup.run();
				handleAsyncResult(
					callback(newValues as never, oldValues as never, cleanup.register)
				);
				oldValues = Arr.map(newValues, (v) => (deep ? deepClone(v) : v));
			}

			if (once) {
				handle.stop();
			}
		},
		{ ...options, immediate: true }
	);

	return handle;
};
