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
 * Server-side rendering support for {@link asyncComputed}.
 *
 * Without this, an async computation is worse than useless under SSR: the server
 * renders a loading state, the client hydrates and immediately refetches, and the
 * user sees a spinner flash on a page the server already had the data for. The
 * request is paid for twice and the markup is wrong both times.
 *
 * Two halves solve it.
 *
 * **On the server**, a per-request collector gathers every async computation
 * created during render so the renderer can await them all before serialising.
 * The collector is carried in async context rather than a module global —
 * concurrent requests interleave across every `await` in Node, and a module-level
 * "current collector" would hand one request's data to another. That is a data
 * leak between users, not merely a bug.
 *
 * **On the client**, the serialised values are adopted as initial state and the
 * first load is skipped entirely. The computation starts settled, with the
 * server's value, and only reloads when its source actually changes.
 */

import { createAsyncContextStorage } from '../utils/async-context.js';

/** A computation registered with a collector. */
export interface CollectableAsyncComputed {
	/** Where the value is stored in the hydration payload. */
	readonly hydrationKey: string;
	/** Resolves when the current run settles. */
	readonly whenSettled: () => Promise<void>;
	/** The settled value, read without tracking. */
	readonly peek: () => unknown;
	/** True while a run is in flight. */
	readonly isLoading: () => boolean;
	readonly dispose: () => void;
}

export interface AsyncCollectorSettleOptions {
	/**
	 * How many times to re-check for newly-registered computations.
	 *
	 * A load can create another computation — a page fetches a user, then the
	 * user's permissions. Each pass is a render wave. The bound exists because an
	 * unbounded loop turns a cyclic dependency into a hung request rather than a
	 * slow one, and a hung request is far harder to diagnose.
	 */
	readonly maxWaves?: number;
	/** Overall budget. Exceeding it settles with whatever is ready. */
	readonly timeoutMs?: number;
}

export interface AsyncCollector {
	register(entry: CollectableAsyncComputed): void;
	/** Awaits every registered computation, including ones created while awaiting. */
	settle(options?: AsyncCollectorSettleOptions): Promise<void>;
	/** The values to embed in the hydration payload. */
	serialize(): Record<string, unknown>;
	/** Disposes every registered computation. Call when the request settles. */
	dispose(): void;
	/** How many computations were collected. For diagnostics. */
	readonly size: () => number;
}

const DEFAULT_MAX_WAVES = 5;
const DEFAULT_TIMEOUT_MS = 10_000;

/**
 * Per-request storage.
 *
 * Native `AsyncLocalStorage` where available; core's stack fallback otherwise.
 * The distinction matters under load — see the module comment.
 */
const collectorStorage = createAsyncContextStorage<AsyncCollector>();

export const createAsyncCollector = (): AsyncCollector => {
	const entries = new Map<string, CollectableAsyncComputed>();

	return {
		register: (entry) => {
			// Keyed, so the same computation registering twice across render waves
			// does not produce duplicate awaits. A collision between two genuinely
			// different computations is a caller mistake, and last-wins keeps it
			// visible as a wrong value rather than a silent double-fetch.
			entries.set(entry.hydrationKey, entry);
		},

		settle: async (options = {}) => {
			const maxWaves = options.maxWaves ?? DEFAULT_MAX_WAVES;
			const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
			const deadline = Date.now() + timeoutMs;

			for (let wave = 0; wave < maxWaves; wave += 1) {
				const pending = [...entries.values()].filter((entry) =>
					entry.isLoading()
				);

				if (pending.length === 0) return;

				const remaining = deadline - Date.now();
				if (remaining <= 0) return;

				// Raced against the budget rather than awaited unconditionally. A
				// provider that never responds must degrade to a page rendered
				// without that data, not a request that never returns.
				await Promise.race([
					Promise.all(pending.map(async (entry) => entry.whenSettled())),
					new Promise<void>((resolve) => {
						const timer = setTimeout(resolve, remaining);
						// `unref` where available, so a pending budget timer cannot hold
						// a Node process open past its work.
						(timer as unknown as { unref?: () => void }).unref?.();
					}),
				]);
			}
		},

		serialize: () => {
			const state: Record<string, unknown> = {};

			for (const [key, entry] of entries) {
				const value = entry.peek();
				// `undefined` is omitted rather than serialised. It survives neither
				// JSON nor a round trip, and emitting it would have the client adopt
				// "loaded, and the answer is nothing" for something that never loaded.
				if (value === undefined) continue;
				state[key] = value;
			}

			return state;
		},

		dispose: () => {
			for (const entry of entries.values()) entry.dispose();
			entries.clear();
		},

		size: () => entries.size,
	};
};

/** Runs `fn` with `collector` as the ambient collector for anything it creates. */
export const runWithAsyncCollector = <R>(
	collector: AsyncCollector,
	fn: () => R
): R => collectorStorage.run(collector, fn);

/** The ambient collector, if this is running inside a server render. */
export const getAsyncCollector = (): AsyncCollector | undefined =>
	collectorStorage.getStore();

/**
 * Values the server sent, on the client.
 *
 * A module-level map is safe here in a way it is not on the server: a browser
 * page is one document with one payload, so there is no second request to leak
 * into.
 */
let hydratedState: Record<string, unknown> | undefined;

/** Installs the server's payload. Call once, before the first render. */
export const hydrateAsyncState = (
	state: Record<string, unknown> | undefined
): void => {
	hydratedState = state;
};

/** Reads a hydrated value, and consumes it so a later remount refetches. */
export const takeHydratedValue = (
	key: string
): { readonly found: boolean; readonly value: unknown } => {
	if (hydratedState === undefined) return { found: false, value: undefined };
	if (!Object.prototype.hasOwnProperty.call(hydratedState, key)) {
		return { found: false, value: undefined };
	}

	const value = hydratedState[key];

	// Consumed rather than left in place. The payload describes the *initial*
	// render; a component remounted later must fetch fresh data rather than
	// silently resurrect a value that may be minutes old.
	delete hydratedState[key];

	return { found: true, value };
};

/** Clears the payload. Exposed for tests and for a full client-side reset. */
export const clearHydratedAsyncState = (): void => {
	hydratedState = undefined;
};

/** True when there is no DOM, i.e. this is a server render. */
export const isServerEnvironment = (): boolean => typeof window === 'undefined';
