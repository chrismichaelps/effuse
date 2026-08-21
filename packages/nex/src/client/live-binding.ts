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

import type { DocumentNode } from '../language/ast/index.js';
import type { ExecutionResult } from '../execution/index.js';
import type { NexClient } from './client.js';
import type { NexBindingOptions } from './query-binding.js';

/** Told each snapshot as it arrives. */
export type NexLiveListener<TData extends object> = (
	snapshot: ExecutionResult<TData>
) => void;

/** A live operation several things can watch at once. */
export interface NexLiveSource<TData extends object> {
	/**
	 * Start being told, and hand back how to stop.
	 *
	 * The first listener opens the connection and the last one to leave
	 * closes it. Anyone arriving after a snapshot has already been seen is
	 * given it straight away rather than waiting for the next one.
	 */
	readonly subscribe: (listener: NexLiveListener<TData>) => () => void;
	/** The last snapshot seen, if any. */
	readonly snapshot: () => ExecutionResult<TData> | undefined;
	/** Close the connection and forget what was seen, whoever is listening. */
	readonly stop: () => void;
}

/**
 * Turn a live operation into something several things can watch.
 *
 * A client's `subscribe` is one stream for one caller, so a page with ten
 * components watching one operation opens ten connections and answers the
 * same events ten times. This is one connection, shared: it opens when the
 * first listener arrives and closes when the last one leaves.
 *
 * What it hands back is a listener and a snapshot, which is the shape every
 * reactive layer already reads - a signal, a store, `useSyncExternalStore` -
 * so nothing here depends on which one is in use.
 */
export const nexLive = <TData extends object = Record<string, unknown>>(
	client: NexClient,
	request: string | DocumentNode,
	options: NexBindingOptions = {}
): NexLiveSource<TData> => {
	const listeners = new Set<NexLiveListener<TData>>();

	let latest: ExecutionResult<TData> | undefined;
	let running: AsyncGenerator<ExecutionResult<TData>> | undefined;
	let stopping: AbortController | undefined;

	const tell = (snapshot: ExecutionResult<TData>): void => {
		latest = snapshot;

		// A listener's problem is its own: one component that throws must not
		// stop the others being told, or the first broken one wins.
		for (const listener of [...listeners]) {
			try {
				listener(snapshot);
			} catch {
				// Nothing here can do anything about it.
			}
		}
	};

	const close = (): void => {
		stopping?.abort();
		stopping = undefined;

		const ending = running;
		running = undefined;
		void ending?.return(undefined as never).catch(() => undefined);
	};

	const open = (): void => {
		if (running !== undefined) return;

		const controller = new AbortController();
		stopping = controller;

		const stream = client.subscribe<TData>(request, {
			signal: controller.signal,
			...(options.operationName === undefined
				? {}
				: { operationName: options.operationName }),
			...(options.variables === undefined
				? {}
				: { variables: options.variables }),
		});
		running = stream;

		void (async () => {
			try {
				for await (const snapshot of stream) {
					// Whoever was watching may all have left while this was in
					// flight, and telling nobody is work for nobody.
					if (running !== stream) return;
					if (snapshot.errors !== undefined)
						options.onErrors?.(snapshot.errors);
					tell(snapshot);
				}
			} catch {
				// A stream that failed is a stream that ended.
			}
		})();
	};

	return {
		subscribe: (listener) => {
			listeners.add(listener);

			// Someone arriving late should not have to wait for the next event
			// to know what everyone else already knows.
			if (latest !== undefined) {
				try {
					listener(latest);
				} catch {
					// As above.
				}
			}

			open();

			return () => {
				listeners.delete(listener);
				if (listeners.size === 0) close();
			};
		},
		snapshot: () => latest,
		stop: () => {
			listeners.clear();
			latest = undefined;
			close();
		},
	};
};
