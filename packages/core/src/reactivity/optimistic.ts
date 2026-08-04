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
 * Optimistic mutations with ordered rollback.
 *
 * React 19 shipped `useOptimistic`, and the ecosystem immediately documented
 * what it does not do. The gaps are all in the part that produces user-visible
 * bugs:
 *
 * - **Silent rollback.** A failed mutation reverts with no signal, so a deleted
 *   row reappears and a toggled setting quietly flips back. Users cannot
 *   distinguish that from the application losing their work.
 * - **Concurrent mutations.** Rapid repeated actions produce lost updates unless
 *   the application adds generation tokens itself.
 * - **Rollback target drift.** Rollback restores the current `initialState`, so
 *   a parent that has moved on restores the wrong value.
 * - **Three claimants to truth.** Confirmed state, optimistic state, and server
 *   state each assert authority, and reconciling them is left to the caller.
 *
 * The architecture here is what removes those, not extra handling bolted on top.
 * There is exactly one source of truth — the base signal — and pending changes
 * are a *queue projected over it*:
 *
 * ```
 * value = pending.reduce(apply, base)
 * ```
 *
 * Ordered rollback then falls out for free. Removing the failed mutation from
 * the queue and recomputing replays the survivors in order, so failing the
 * second of three leaves the first and third applied. There is no bookkeeping to
 * get wrong because there is no second copy of the state to reconcile.
 *
 * ```ts
 * const todos = optimistic(todosSignal, {
 *   apply: (state, change) => [...state, change],
 *   commit: (change, ctx) => api.create(change, { signal: ctx.signal }),
 *   reconcile: (state, created) => [...state, created],
 *   onRollback: (change, cause) => toast.error(`Could not add ${change.title}`),
 * });
 *
 * const handle = todos.mutate({ title: 'Buy milk' });
 * await handle.settled;
 * ```
 */

import { computed } from './computed.js';
import { signal } from './signal.js';
import { batch, untrack } from './dep.js';
import type { RetryPolicy } from './async-computed.js';
import type { Signal } from '../types/index.js';

/** Lifecycle of a single mutation. */
export type MutationStatus = 'pending' | 'committed' | 'rolled-back';

/** Handed to `commit`. */
export interface CommitContext {
	/** Aborts when the mutation is rolled back or the queue is disposed. */
	readonly signal: AbortSignal;
	/**
	 * Stable across retries of this mutation.
	 *
	 * Send it with the request so a retry after an ambiguous failure — the
	 * response was lost, not the write — cannot create a second record. Without
	 * one, retry turns a network blip into a duplicate charge.
	 */
	readonly idempotencyKey: string;
	/** Zero on the first try, incrementing per retry. */
	readonly attempt: number;
}

export interface MutationHandle<Result> {
	readonly id: string;
	readonly idempotencyKey: string;
	readonly status: MutationStatus;
	/** The failure, once rolled back. */
	readonly error: unknown | undefined;
	/** The server's answer, once committed. */
	readonly result: Result | undefined;
	/** Resolves when this mutation commits or rolls back. Never rejects. */
	readonly settled: Promise<void>;
	/** Rolls this mutation back immediately, cancelling its request. */
	rollback(cause?: unknown): void;
}

/** A mutation still in the queue. */
export interface PendingMutation<Change> {
	readonly id: string;
	readonly idempotencyKey: string;
	readonly change: Change;
	readonly attempt: number;
}

export interface OptimisticOptions<State, Change, Result> {
	/**
	 * Projects a change onto state. Must be pure.
	 *
	 * Called every time the projection recomputes, which is more often than once
	 * per mutation. A version that mutates its argument corrupts the base state
	 * rather than merely misbehaving — see {@link OptimisticQueue} on the
	 * identity check that catches the common form of this mistake.
	 */
	readonly apply: (state: State, change: Change) => State;
	/** Sends the change to the server. */
	readonly commit: (change: Change, context: CommitContext) => Promise<Result>;
	/**
	 * Folds the server's answer into the base state.
	 *
	 * Omit it when the server returns nothing meaningful and the optimistic
	 * projection was already correct — the mutation then simply leaves the queue,
	 * and because the projection recomputes from an unchanged base, the value
	 * does not flicker.
	 */
	readonly reconcile?: (state: State, result: Result, change: Change) => State;
	/**
	 * Called when a mutation rolls back.
	 *
	 * The single most important difference from a silent revert. Without this the
	 * user watches their change undo itself with no explanation, which reads as
	 * the application losing data.
	 */
	readonly onRollback?: (change: Change, cause: unknown) => void;
	/** Called when a mutation commits. */
	readonly onCommit?: (change: Change, result: Result) => void;
	readonly retry?: RetryPolicy;
	/**
	 * Warn when `apply` looks impure. Defaults to on outside production.
	 *
	 * The check is one identity comparison and catches the overwhelmingly common
	 * mistake — mutating the array and returning it. It cannot catch every impure
	 * implementation, and does not pretend to.
	 */
	readonly detectImpureApply?: boolean;
}

export interface OptimisticQueue<State, Change, Result> {
	/** Base state with every pending change projected over it. */
	readonly value: State;
	/** Confirmed state, without pending changes. */
	readonly base: State;
	/** Mutations still in flight, in the order they were queued. */
	readonly pending: readonly PendingMutation<Change>[];
	readonly isMutating: boolean;
	/** Queues a change and starts committing it. */
	mutate(change: Change): MutationHandle<Result>;
	/** Rolls back every pending mutation. */
	rollbackAll(cause?: unknown): void;
	/** Resolves when nothing is pending. Never rejects. */
	whenSettled(): Promise<void>;
	/** Cancels in-flight commits and clears the queue. Idempotent. */
	dispose(): void;
}

interface QueueEntry<Change, Result> {
	readonly id: string;
	readonly idempotencyKey: string;
	readonly change: Change;
	attempt: number;
	readonly controller: AbortController;
	status: MutationStatus;
	error: unknown;
	result: Result | undefined;
	readonly settled: Promise<void>;
	resolveSettled: () => void;
}

let counter = 0;

const nextId = (): string => {
	counter += 1;
	return `m${String(counter)}`;
};

/**
 * A key stable across retries of one mutation.
 *
 * `crypto.randomUUID` where available, and a counter-plus-random fallback
 * otherwise — this runs in browsers, on servers, and in test environments, and
 * an exception on an unavailable global would be a poor reason to fail a write.
 */
const newIdempotencyKey = (): string => {
	const webCrypto = (globalThis as { crypto?: { randomUUID?: () => string } })
		.crypto;

	if (typeof webCrypto?.randomUUID === 'function') {
		return webCrypto.randomUUID();
	}

	return `${String(Date.now())}-${Math.random().toString(36).slice(2)}-${nextId()}`;
};

const defaultDelayMs = (attempt: number): number =>
	Math.min(30_000, 2 ** attempt * 100);

const sleep = (ms: number, abortSignal: AbortSignal): Promise<void> =>
	new Promise((resolve, reject) => {
		if (abortSignal.aborted) {
			reject(abortSignal.reason as Error);
			return;
		}

		const timer = setTimeout(() => {
			abortSignal.removeEventListener('abort', onAbort);
			resolve();
		}, ms);

		const onAbort = (): void => {
			clearTimeout(timer);
			reject(abortSignal.reason as Error);
		};

		abortSignal.addEventListener('abort', onAbort, { once: true });
	});

const isProduction = (): boolean => {
	const env = (globalThis as { process?: { env?: { NODE_ENV?: string } } })
		.process?.env?.NODE_ENV;
	return env === 'production';
};

export function optimistic<State, Change, Result = void>(
	base: Signal<State>,
	options: OptimisticOptions<State, Change, Result>
): OptimisticQueue<State, Change, Result> {
	const {
		apply,
		commit,
		reconcile,
		onRollback,
		onCommit,
		retry,
		detectImpureApply = !isProduction(),
	} = options;

	const queue = signal<readonly QueueEntry<Change, Result>[]>([]);
	let disposed = false;
	let warnedImpure = false;

	/**
	 * The whole design, in one expression.
	 *
	 * Because the value is *derived* rather than stored, removing a failed
	 * mutation from the queue replays the survivors in order automatically. There
	 * is no separate optimistic copy to repair, which is precisely what makes
	 * ordered rollback fall out rather than needing to be implemented.
	 */
	const projected = computed(() => {
		const confirmed = base.value;
		const entries = queue.value;

		let state = confirmed;

		for (const entry of entries) {
			const next = apply(state, entry.change);

			if (detectImpureApply && !warnedImpure && Object.is(next, state)) {
				warnedImpure = true;
				// A heuristic, and deliberately a warning rather than an error.
				// Returning the same reference is the signature of mutating in place,
				// which corrupts base state because the projection recomputes from
				// base every time. But it is also what a legitimate no-op change
				// returns, so this names both readings instead of asserting one.
				// eslint-disable-next-line no-console
				console.warn(
					'[effuse] optimistic(): `apply` returned the state it was given. ' +
						'If it mutated that state in place, this corrupts the base state — ' +
						'return a new value instead. If the change was intentionally a ' +
						'no-op, set `detectImpureApply: false` to silence this.'
				);
			}

			state = next;
		}

		return state;
	});

	// Derived rather than mapped per read, so repeatedly reading `pending` in a
	// render does not allocate a fresh array each time.
	const pendingView = computed<readonly PendingMutation<Change>[]>(() =>
		queue.value.map((entry) => ({
			id: entry.id,
			idempotencyKey: entry.idempotencyKey,
			change: entry.change,
			attempt: entry.attempt,
		}))
	);

	const removeEntry = (id: string): void => {
		queue.value = untrack(() => queue.value).filter((entry) => entry.id !== id);
	};

	const finish = (
		entry: QueueEntry<Change, Result>,
		status: MutationStatus
	): void => {
		entry.status = status;
		entry.resolveSettled();
	};

	const rollbackEntry = (
		entry: QueueEntry<Change, Result>,
		cause: unknown
	): void => {
		if (entry.status !== 'pending') return;

		entry.error = cause;
		entry.controller.abort(cause);

		batch(() => {
			removeEntry(entry.id);
		});

		finish(entry, 'rolled-back');

		// Fired after the state has already reverted, so a handler that reads the
		// value sees the world it is describing rather than the one about to be
		// undone.
		onRollback?.(entry.change, cause);
	};

	const runCommit = async (entry: QueueEntry<Change, Result>): Promise<void> => {
		const attemptsAllowed = retry?.attempts ?? 0;

		for (let attempt = 0; ; attempt += 1) {
			entry.attempt = attempt;

			try {
				const result = await commit(entry.change, {
					signal: entry.controller.signal,
					idempotencyKey: entry.idempotencyKey,
					attempt,
				});

				// Rolled back or disposed while the request was in flight. Committing
				// now would resurrect a mutation the user already saw reverted.
				if (entry.status !== 'pending' || disposed) return;

				entry.result = result;

				batch(() => {
					if (reconcile !== undefined) {
						base.value = reconcile(untrack(() => base.value), result, entry.change);
					}
					// Base update and queue removal happen together, so the projection
					// recomputes once. Done separately, the value would briefly show the
					// change twice — reconciled into base and still in the queue.
					removeEntry(entry.id);
				});

				finish(entry, 'committed');
				onCommit?.(entry.change, result);
				return;
			} catch (cause) {
				if (entry.status !== 'pending' || disposed) return;

				const mayRetry =
					attempt < attemptsAllowed &&
					(retry?.shouldRetry?.(cause, attempt) ?? true);

				if (!mayRetry) {
					rollbackEntry(entry, cause);
					return;
				}

				try {
					await sleep((retry?.delayMs ?? defaultDelayMs)(attempt), entry.controller.signal);
				} catch {
					// Aborted mid-backoff; the rollback that aborted us already ran.
					return;
				}

				if (entry.status !== 'pending' || disposed) return;
			}
		}
	};

	const queueInstance: OptimisticQueue<State, Change, Result> = {
		get value() {
			return projected.value;
		},
		get base() {
			return base.value;
		},
		get pending() {
			return pendingView.value;
		},
		get isMutating() {
			return queue.value.length > 0;
		},

		mutate: (change) => {
			if (disposed) {
				// A handle is still returned, already rolled back, so a caller awaiting
				// `settled` is not left holding a promise that never resolves.
				const key = newIdempotencyKey();
				return {
					id: nextId(),
					idempotencyKey: key,
					status: 'rolled-back',
					error: new Error('Queue disposed.'),
					result: undefined,
					settled: Promise.resolve(),
					rollback: () => undefined,
				};
			}

			let resolveSettled!: () => void;
			const settled = new Promise<void>((resolve) => {
				resolveSettled = resolve;
			});

			const entry: QueueEntry<Change, Result> = {
				id: nextId(),
				idempotencyKey: newIdempotencyKey(),
				change,
				attempt: 0,
				controller: new AbortController(),
				status: 'pending',
				error: undefined,
				result: undefined,
				settled,
				resolveSettled,
			};

			// Appended, so the projection applies mutations in the order the user
			// made them. Order is part of the semantics: two edits to the same field
			// must land the way they were typed.
			queue.value = [...untrack(() => queue.value), entry];

			void runCommit(entry);

			return {
				id: entry.id,
				idempotencyKey: entry.idempotencyKey,
				get status() {
					return entry.status;
				},
				get error() {
					return entry.error;
				},
				get result() {
					return entry.result;
				},
				settled,
				rollback: (cause) =>
					rollbackEntry(entry, cause ?? new Error('Rolled back by caller.')),
			};
		},

		rollbackAll: (cause) => {
			const reason = cause ?? new Error('Rolled back.');
			for (const entry of untrack(() => queue.value)) {
				rollbackEntry(entry, reason);
			}
		},

		whenSettled: async () => {
			// Looped rather than awaited once: a commit's reconciliation can queue
			// further work, so settling the first batch is not settling the queue.
			// Each entry is awaited on its own promise rather than polled — a
			// microtask poll would spin the event loop for the whole duration of a
			// slow request.
			for (;;) {
				const entries = untrack(() => queue.value);
				if (entries.length === 0) return;

				await Promise.all(entries.map(async (entry) => entry.settled));
			}
		},

		dispose: () => {
			if (disposed) return;
			disposed = true;

			for (const entry of untrack(() => queue.value)) {
				entry.controller.abort(new Error('Queue disposed.'));
				entry.status = 'rolled-back';
				// Released rather than left hanging: a promise that can never resolve
				// is a hang, and a hung caller is harder to diagnose than a failed one.
				entry.resolveSettled();
			}

			queue.value = [];
		},
	};

	return queueInstance;
}
