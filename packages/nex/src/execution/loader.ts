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

/** How a source answers for many keys at once. */
export type LoadMany<TKey, TValue> = (
	keys: readonly TKey[]
) => Promise<readonly (TValue | undefined)[]>;

/** How to gather keys before asking. */
export interface LoaderOptions<TKey, TValue> {
	/** Answer for every key given, in the order they were given. */
	readonly load: LoadMany<TKey, TValue>;
	/** How many keys may travel in one call. Defaults to no limit. */
	readonly size?: number | undefined;
	/**
	 * What makes two keys the same.
	 *
	 * Needed for keys that are not primitives, since two objects describing the
	 * same thing are still two objects.
	 */
	readonly key?: ((key: TKey) => string) | undefined;
}

/** Asks a source for many things at once, on behalf of callers that asked one. */
export interface Loader<TKey, TValue> {
	/** Ask for one, and travel with everything else asked for this tick. */
	readonly load: (key: TKey) => Promise<TValue | undefined>;
	/** Ask for several at once. */
	readonly loadMany: (
		keys: readonly TKey[]
	) => Promise<readonly (TValue | undefined)[]>;
	/** Forget one answer, or all of them. */
	readonly clear: (key?: TKey) => void;
}

interface Waiting<TKey, TValue> {
	readonly key: TKey;
	readonly identity: string;
	readonly settle: (value: TValue | undefined) => void;
	readonly fail: (reason: unknown) => void;
}

/**
 * Ask once for what a run needs many times.
 *
 * A field on fifty rows asks fifty times for the same handful of things, and a
 * source answering one at a time turns one request into fifty. A loader
 * gathers what is asked for in a tick, asks once, and hands each caller its
 * own answer - so the shape of the request stops deciding the shape of the
 * queries behind it.
 *
 * One loader belongs to one run: what it remembers is what that run has
 * already seen, and giving a server-wide loader to every request would hand
 * one caller's answers to another.
 */
export const createLoader = <TKey, TValue>(
	options: LoaderOptions<TKey, TValue>
): Loader<TKey, TValue> => {
	const identityOf = options.key ?? ((key: TKey): string => String(key));
	const size = options.size ?? Number.POSITIVE_INFINITY;

	/**
	 * Gather until everything already running has had its turn.
	 *
	 * A microtask is not late enough: resolving a field walks a chain of
	 * promises, so rows reach the loader several microtasks apart and a batch
	 * scheduled on the next one would leave with a single key. Waiting for the
	 * next turn of the event loop instead lets the whole tick's work arrive.
	 */
	const gather: (call: () => void) => void =
		typeof setImmediate === 'function'
			? (call): void => void setImmediate(call)
			: (call): void => void setTimeout(call, 0);

	const known = new Map<string, TValue | undefined>();
	let queue: Waiting<TKey, TValue>[] = [];
	let scheduled = false;

	const ask = async (
		waiting: readonly Waiting<TKey, TValue>[]
	): Promise<void> => {
		// One caller per key travels; the rest are answered from what comes back.
		const asked: TKey[] = [];
		const identities: string[] = [];

		for (const entry of waiting) {
			if (identities.includes(entry.identity)) continue;
			identities.push(entry.identity);
			asked.push(entry.key);
		}

		try {
			const answers = await options.load(asked);

			if (answers.length !== asked.length) {
				throw new Error(
					`A loader asked for ${String(asked.length)} keys and the source answered ${String(answers.length)}`
				);
			}

			const byIdentity = new Map<string, TValue | undefined>();
			for (const [index, identity] of identities.entries()) {
				byIdentity.set(identity, answers[index]);
				known.set(identity, answers[index]);
			}

			for (const entry of waiting) entry.settle(byIdentity.get(entry.identity));
		} catch (cause) {
			// Nothing to forget: answers are remembered only once a batch has
			// come back, so a batch that failed left nothing behind and the
			// next caller asks again.
			for (const entry of waiting) entry.fail(cause);
		}
	};

	const enqueue = (entry: Waiting<TKey, TValue>): void => {
		queue.push(entry);

		if (queue.length >= size) {
			const full = queue;
			queue = [];
			void ask(full);
			return;
		}

		if (scheduled) return;
		scheduled = true;

		gather(() => {
			scheduled = false;
			const waiting = queue;
			queue = [];
			if (waiting.length > 0) void ask(waiting);
		});
	};

	const load = (key: TKey): Promise<TValue | undefined> => {
		const identity = identityOf(key);

		if (known.has(identity)) {
			return Promise.resolve(known.get(identity));
		}

		return new Promise<TValue | undefined>((resolve, reject) => {
			enqueue({ key, identity, settle: resolve, fail: reject });
		});
	};

	return {
		load,
		loadMany: (keys) => Promise.all(keys.map(load)),
		clear: (key) => {
			if (key === undefined) known.clear();
			else known.delete(identityOf(key));
		},
	};
};
