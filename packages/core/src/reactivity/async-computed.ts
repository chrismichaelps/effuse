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

/**
 * Async derived state.
 *
 * Every mainstream framework handles this differently and none handles it
 * fully. Vue documents async inside `computed` as forbidden. VueUse's
 * `computedAsync` works but tracks only dependencies read *before the first
 * await* — anything read after resumption silently never re-triggers. Solid's
 * own reactivity discussion concedes that outside `createResource` it is "very
 * difficult to do async with derivations". React offers nothing and sends you to
 * a query library.
 *
 * They share a root cause. Synchronous dependency tracking collects reads into a
 * call-stack-scoped context, and an `await` unwinds that stack. Reads after
 * resumption land nowhere. Patching tracking across the boundary either loses
 * dependencies or over-collects them, which is why the libraries that try it end
 * up documenting a caveat instead of fixing it.
 *
 * The design here removes the failure rather than defending against it: the
 * tracked part and the async part are separate functions.
 *
 * ```ts
 * const user = asyncComputed({
 *   // Synchronous. Tracked completely, because there is no await in it.
 *   source: () => ({ id: userId.value, page: page.value }),
 *   // Async, and handed an already-resolved value. Nothing left to track.
 *   load: async ({ id, page }, ctx) =>
 *     fetch(`/users/${id}?page=${page}`, { signal: ctx.signal }).then((r) => r.json()),
 * });
 *
 * user.value;    // Value | undefined — reading never throws
 * user.loading;  // boolean
 * user.error;    // unknown | undefined
 * user.stale;    // the value belongs to a previous source
 * ```
 *
 * Everything beyond that split — cancellation, race protection, retry,
 * stale-while-revalidate — exists because applications otherwise hand-roll it,
 * and hand-rolled versions are where the bugs live.
 */

import { computed } from './computed.js';
import { signal } from './signal.js';
import { batch, untrack } from './dep.js';
import { watchEffect } from '../effects/effect.js';
import {
	getAsyncCollector,
	isServerEnvironment,
	takeHydratedValue,
} from './async-hydration.js';
import type { ReadonlySignal } from '../types/index.js';

/** Handed to the loader. */
export interface AsyncLoadContext {
	/**
	 * Aborts when this run is superseded or the computation is disposed.
	 *
	 * Pass it straight to `fetch`. A superseded request that keeps running is
	 * wasted bandwidth on a mobile connection and a held connection slot on a
	 * loaded server.
	 */
	readonly signal: AbortSignal;
	/** Zero for the first try, incrementing per retry. */
	readonly attempt: number;
	/**
	 * Reads a signal and registers it as a dependency of this computation.
	 *
	 * The deliberate exception to the design. Dependencies belong in `source`,
	 * where tracking is exact; this exists for the case where what to load next
	 * is only known after a first request. Reading a signal directly inside
	 * `load` does *not* create a dependency — that is the failure mode of every
	 * other implementation, and here it is at least silent in only one direction.
	 */
	track<T>(source: ReadonlySignal<T>): T;
	/** Throws if this run has been superseded. For loops between awaits. */
	throwIfAborted(): void;
}

export interface RetryPolicy {
	/** Retries after the first failure. `2` means up to three attempts total. */
	readonly attempts: number;
	/** Delay before the given retry. Defaults to exponential backoff capped at 30s. */
	readonly delayMs?: (attempt: number) => number;
	/** Return false to stop retrying a particular error, e.g. a 404. */
	readonly shouldRetry?: (error: unknown, attempt: number) => boolean;
}

export interface AsyncComputedOptions<Source, Value> {
	/**
	 * The tracked half. Must be synchronous.
	 *
	 * Every signal this reads becomes a dependency, exactly and completely,
	 * because there is no await to unwind the tracking context.
	 */
	readonly source: () => Source;
	/** The async half. Receives the resolved source; has nothing to track. */
	readonly load: (source: Source, context: AsyncLoadContext) => Promise<Value>;
	/** Value before the first load settles. */
	readonly initialValue?: Value;
	/**
	 * Whether two source values are the same. Defaults to `Object.is`.
	 *
	 * Supply one when the source is an object literal — otherwise every
	 * recomputation produces a new reference and reloads unnecessarily.
	 */
	readonly equals?: (a: Source, b: Source) => boolean;
	readonly retry?: RetryPolicy;
	/**
	 * Keep the previous value while a new one loads. Defaults to true.
	 *
	 * Stale-while-revalidate is the better default: blanking to `undefined` on
	 * every keystroke produces a spinner flash that reads as a slower interface
	 * than briefly stale data does.
	 */
	readonly keepPreviousValue?: boolean;
	/** Start loading immediately. Defaults to true. */
	readonly immediate?: boolean;
	/**
	 * Key under which the server's value travels to the client.
	 *
	 * Supplying it makes the computation server-rendered properly: the renderer
	 * awaits it before serialising, and the client adopts the result instead of
	 * refetching. Without it, the server renders a loading state and the client
	 * immediately requests the same data again — a spinner flash on a page the
	 * server already had, and the request paid for twice.
	 *
	 * Keys must be unique within a page.
	 */
	readonly hydrationKey?: string;
	/** Observability hook. Fires for genuine failures, never for cancellation. */
	readonly onError?: (error: unknown, source: Source) => void;
}

export interface AsyncComputed<Value> {
	/** The current value. Reading never throws. */
	readonly value: Value | undefined;
	/** The failure from the most recent settled run, if it failed. */
	readonly error: unknown | undefined;
	/** True while a run is in flight, including retries. */
	readonly loading: boolean;
	/** True when `value` belongs to a superseded source. */
	readonly stale: boolean;
	/** True once any run has settled, successfully or not. */
	readonly settled: boolean;
	/** Retry attempt of the in-flight run; zero when idle or on the first try. */
	readonly attempt: number;
	/** Reloads with the current source, even if it has not changed. */
	refresh(): void;
	/** Cancels in-flight work and stops tracking. Idempotent. */
	dispose(): void;
	/** Resolves when the current run settles. For tests and SSR. */
	whenSettled(): Promise<void>;
}

/** Exponential backoff, capped so a long outage does not produce hour-long waits. */
const defaultDelayMs = (attempt: number): number =>
	Math.min(30_000, 2 ** attempt * 100);

const sleep = (ms: number, signal: AbortSignal): Promise<void> =>
	new Promise((resolve, reject) => {
		if (signal.aborted) {
			reject(signal.reason as Error);
			return;
		}

		const timer = setTimeout(() => {
			signal.removeEventListener('abort', onAbort);
			resolve();
		}, ms);

		const onAbort = (): void => {
			// Cleared rather than left to fire into a disposed computation. An
			// uncleared timer is the standard way a "disposed" object keeps a
			// closure — and everything it captured — alive.
			clearTimeout(timer);
			reject(signal.reason as Error);
		};

		signal.addEventListener('abort', onAbort, { once: true });
	});

/**
 * Marker for the abort this module raises itself.
 *
 * Distinguishing our own cancellation from a genuine failure matters: a
 * superseded run is normal operation and must not surface as an error, or every
 * keystroke in a search box reports a failure the user never caused.
 */
const SUPERSEDED = Symbol('effuse.asyncComputed.superseded');

const isSuperseded = (error: unknown): boolean =>
	typeof error === 'object' && error !== null && SUPERSEDED in error;

const supersededError = (): Error =>
	Object.assign(new Error('Superseded by a newer run.'), { [SUPERSEDED]: true });

export function asyncComputed<Source, Value>(
	options: AsyncComputedOptions<Source, Value>
): AsyncComputed<Value> {
	const {
		source,
		load,
		initialValue,
		equals = Object.is,
		retry,
		keepPreviousValue = true,
		immediate = true,
		onError,
	} = options;

	const { hydrationKey } = options;

	// Adopted before any signal is created, so the computation starts settled with
	// the server's value rather than flashing a loading state and replacing it.
	const hydrated =
		hydrationKey !== undefined && !isServerEnvironment()
			? takeHydratedValue(hydrationKey)
			: { found: false, value: undefined };

	const valueSignal = signal<Value | undefined>(
		hydrated.found ? (hydrated.value as Value) : initialValue
	);
	const errorSignal = signal<unknown>(undefined);
	const loadingSignal = signal(false);
	const staleSignal = signal(false);
	const settledSignal = signal(hydrated.found);
	const attemptSignal = signal(0);

	/**
	 * Dependencies discovered through `ctx.track`, and the watchers holding them.
	 *
	 * These cannot ride on the main effect. `ctx.track` is called from inside the
	 * loader — after the effect has already run and collected its dependencies —
	 * so anything registered then would not be observed until the *next* run, and
	 * nothing would trigger that next run. A dedicated watcher per dependency is
	 * what makes the escape hatch actually work rather than appear to.
	 */
	const dynamicDependencies = new Set<ReadonlySignal<unknown>>();
	const dynamicWatchers: { stop: () => void }[] = [];

	const sourceComputed = computed(source);

	let generation = 0;
	let controller: AbortController | undefined;
	let disposed = false;
	let lastSource: { value: Source } | undefined;
	// The hydrated case skips its first load for the same reason `immediate: false`
	// does — the value is already correct. A later source change still loads.
	let skipFirstRun = !immediate || hydrated.found;
	let settledResolvers: (() => void)[] = [];

	const notifySettled = (): void => {
		const resolvers = settledResolvers;
		settledResolvers = [];
		for (const resolve of resolvers) resolve();
	};

	const abortInFlight = (): void => {
		controller?.abort(supersededError());
		controller = undefined;
	};

	/**
	 * Applies a state change without tracking.
	 *
	 * `run` is invoked synchronously from inside the effect, so any signal *read*
	 * there would become one of the effect's dependencies. Reading `settled` to
	 * decide staleness would then re-run the effect the moment a load settles,
	 * which re-runs the load, which settles again — an infinite loop that only
	 * appears once something actually resolves.
	 */
	const applyState = (mutate: () => void): void => {
		untrack(() => {
			batch(mutate);
		});
	};

	const run = (nextSource: Source): void => {
		if (disposed) return;

		// Every previous run is superseded the moment a new one starts. Aborting
		// before the generation increments keeps the two in lockstep, so a
		// resolution can never find itself current after having been aborted.
		abortInFlight();

		generation += 1;
		const thisGeneration = generation;

		const runController = new AbortController();
		controller = runController;

		const isCurrent = (): boolean => !disposed && thisGeneration === generation;

		applyState(() => {
			loadingSignal.value = true;
			attemptSignal.value = 0;
			// The previous value is retained but marked stale rather than blanked.
			// Blanking produces a spinner flash on every keystroke, which reads as a
			// slower interface than briefly showing the last result.
			if (!keepPreviousValue) valueSignal.value = undefined;
			staleSignal.value = keepPreviousValue && settledSignal.value;
		});

		const contextFor = (attempt: number): AsyncLoadContext => ({
			signal: runController.signal,
			attempt,
			track: <T,>(dependency: ReadonlySignal<T>): T => {
				const value = untrack(() => dependency.value);

				if (!dynamicDependencies.has(dependency as ReadonlySignal<unknown>)) {
					dynamicDependencies.add(dependency as ReadonlySignal<unknown>);

					// A watcher per dependency, skipping its own first run so that
					// registering a dependency does not immediately reload.
					let primed = false;
					dynamicWatchers.push(
						watchEffect(() => {
							void dependency.value;
							if (!primed) {
								primed = true;
								return;
							}
							if (disposed) return;
							run(untrack(() => sourceComputed.value));
						})
					);
				}

				return value;
			},
			throwIfAborted: () => {
				if (runController.signal.aborted) {
					throw runController.signal.reason as Error;
				}
			},
		});

		const attemptLoad = async (attempt: number): Promise<void> => {
			try {
				// Awaited inside the try so a loader that throws synchronously —
				// rather than returning a rejected promise — is caught by this path
				// too.
				const result = await load(nextSource, contextFor(attempt));

				if (!isCurrent()) return;

				applyState(() => {
					valueSignal.value = result;
					errorSignal.value = undefined;
					loadingSignal.value = false;
					staleSignal.value = false;
					settledSignal.value = true;
					attemptSignal.value = attempt;
				});

				notifySettled();
			} catch (error) {
				// A superseded run is normal operation, not a failure. Reporting it
				// would make every keystroke in a search box surface an error the user
				// never caused.
				if (isSuperseded(error) || !isCurrent()) return;

				const attemptsAllowed = retry?.attempts ?? 0;
				const mayRetry =
					attempt < attemptsAllowed &&
					(retry?.shouldRetry?.(error, attempt) ?? true);

				if (mayRetry) {
					const delay = (retry?.delayMs ?? defaultDelayMs)(attempt);

					try {
						await sleep(delay, runController.signal);
					} catch {
						// Aborted mid-backoff. Nothing to report and nothing to commit.
						return;
					}

					if (!isCurrent()) return;

					applyState(() => {
						attemptSignal.value = attempt + 1;
					});

					await attemptLoad(attempt + 1);
					return;
				}

				applyState(() => {
					errorSignal.value = error;
					loadingSignal.value = false;
					staleSignal.value = false;
					settledSignal.value = true;
					attemptSignal.value = attempt;
				});

				onError?.(error, nextSource);
				notifySettled();
			}
		};

		void attemptLoad(0);
	};

	const handle = watchEffect(() => {
		const nextSource = sourceComputed.value;

		const unchanged =
			lastSource !== undefined && equals(lastSource.value, nextSource);

		lastSource = { value: nextSource };

		if (unchanged) return;

		// `immediate: false` skips only the very first evaluation. A later source
		// change still loads — the option defers the initial fetch, it does not
		// make the computation permanently manual.
		if (skipFirstRun) {
			skipFirstRun = false;
			return;
		}

		run(nextSource);
	});

	const instance: AsyncComputed<Value> = {
		get value() {
			return valueSignal.value;
		},
		get error() {
			return errorSignal.value;
		},
		get loading() {
			return loadingSignal.value;
		},
		get stale() {
			return staleSignal.value;
		},
		get settled() {
			return settledSignal.value;
		},
		get attempt() {
			return attemptSignal.value;
		},

		refresh: () => {
			if (disposed) return;
			run(untrack(() => sourceComputed.value));
		},

		dispose: () => {
			if (disposed) return;
			disposed = true;

			// Aborted before the effect stops, so an in-flight loader watching the
			// signal observes the cancellation rather than resolving into a
			// computation that no longer exists.
			abortInFlight();
			handle.stop();
			for (const watcher of dynamicWatchers) watcher.stop();
			dynamicWatchers.length = 0;
			dynamicDependencies.clear();

			applyState(() => {
				loadingSignal.value = false;
				staleSignal.value = false;
			});

			// Anyone awaiting settlement is released rather than left holding a
			// promise that can now never resolve.
			notifySettled();
		},

		whenSettled: () =>
			new Promise<void>((resolve) => {
				const idle = untrack(
					() => disposed || (!loadingSignal.value && settledSignal.value)
				);
				if (idle) {
					resolve();
					return;
				}
				settledResolvers.push(resolve);
			}),
	};

	// Registered with the ambient collector so a server render can await this
	// before serialising, and dispose it when the request settles. The collector
	// lives in async context rather than a module global: concurrent requests
	// interleave across every await in Node, and a shared global would hand one
	// request's data to another.
	if (hydrationKey !== undefined && isServerEnvironment()) {
		getAsyncCollector()?.register({
			hydrationKey,
			whenSettled: () => instance.whenSettled(),
			peek: () => untrack(() => valueSignal.value),
			isLoading: () => untrack(() => loadingSignal.value || !settledSignal.value),
			dispose: () => {
				instance.dispose();
			},
		});
	}

	return instance;
}
