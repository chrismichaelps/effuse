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
 * A signal whose value is shared across tabs.
 *
 * The motivating case is unglamorous and universal: signing out in one tab must
 * sign the user out everywhere. Every application that needs it writes the same
 * `BroadcastChannel` plumbing, and the hand-rolled versions consistently miss
 * two things — deterministic conflict resolution when two tabs write at once,
 * and reconciliation for a tab that was suspended and woke with stale state.
 *
 * ## On the server
 *
 * There are no other tabs during a server render, and `BroadcastChannel` does
 * not exist there. The transport degrades to a no-op, no timers or listeners are
 * installed, and the result behaves as an ordinary signal. That is the correct
 * behaviour rather than a fallback: a server render produces the *initial* state
 * for one client, and there is nothing to synchronise with.
 *
 * The practical consequence is that this is safe to construct in shared code
 * that runs on both sides. It will not throw, will not schedule work that
 * outlives the request, and will not attach a `visibilitychange` listener to a
 * `document` that is not there.
 */

import { signal } from '../reactivity/signal.js';
import { untrack } from '../reactivity/dep.js';
import { watchEffect } from '../effects/effect.js';
import {
	createBroadcastTransport,
	createNoopTransport,
	type SyncMessage,
	type SyncTransport,
} from './transport.js';
import { createLeaderElection } from './leader.js';
import type { Signal } from '../types/index.js';

/** A value together with the metadata conflict resolution needs. */
export interface VersionedValue<T> {
	readonly value: T;
	/** When the writing tab produced it, in epoch millis. */
	readonly at: number;
	/** Which tab wrote it. Breaks ties when two writes share a timestamp. */
	readonly origin: string;
}

export interface SyncedSignalOptions<T> {
	/** Channel name. Tabs sharing a name share the value. */
	readonly channel: string;
	/**
	 * Resolves two competing values.
	 *
	 * Defaults to last-write-wins, with the origin id breaking exact ties so the
	 * outcome is deterministic rather than dependent on message arrival order.
	 * Supply a merge for anything where losing a concurrent write is unacceptable.
	 */
	readonly resolve?: (
		mine: VersionedValue<T>,
		theirs: VersionedValue<T>
	) => VersionedValue<T>;
	/** Injected for tests. Defaults to a `BroadcastChannel` transport. */
	readonly transport?: SyncTransport;
	/** Injected for tests. Defaults to `Date.now`. */
	readonly now?: () => number;
	/**
	 * Ask peers for their state when the tab becomes visible again.
	 *
	 * Defaults to true. A backgrounded tab can miss messages entirely — some
	 * browsers suspend timers and event delivery — and would otherwise wake
	 * showing state that is minutes stale with no indication anything is wrong.
	 */
	readonly reconcileOnWake?: boolean;
}

export interface SyncedSignal<T> {
	/** The shared value. Writing broadcasts to other tabs. */
	readonly signal: Signal<T>;
	/** This tab's identifier. */
	readonly origin: string;
	/** Asks peers for their state and resolves against it. */
	reconcile(): void;
	/** Stops syncing and releases the channel. Idempotent. */
	dispose(): void;
}

const UPDATE = 'effuse.sync.update';
const REQUEST = 'effuse.sync.request';

const newOriginId = (): string => {
	const webCrypto = (globalThis as { crypto?: { randomUUID?: () => string } })
		.crypto;

	if (typeof webCrypto?.randomUUID === 'function') return webCrypto.randomUUID();
	return `${String(Date.now())}-${Math.random().toString(36).slice(2)}`;
};

/**
 * Last-write-wins, with a deterministic tie-break.
 *
 * Comparing timestamps alone leaves ties resolved by arrival order, which
 * differs per tab — so two tabs can permanently disagree. Falling back to the
 * origin id makes every tab reach the same answer from the same inputs.
 *
 * The tie-break is only ever reached for genuinely *concurrent* writes, because
 * timestamps are logical rather than raw wall-clock — see `nextStamp`.
 */
const lastWriteWins = <T>(
	mine: VersionedValue<T>,
	theirs: VersionedValue<T>
): VersionedValue<T> => {
	if (theirs.at > mine.at) return theirs;
	if (theirs.at < mine.at) return mine;
	return theirs.origin > mine.origin ? theirs : mine;
};

interface DocumentLike {
	visibilityState?: string;
	addEventListener(type: string, listener: () => void): void;
	removeEventListener(type: string, listener: () => void): void;
}

const getDocument = (): DocumentLike | undefined => {
	const candidate = (globalThis as { document?: DocumentLike }).document;
	return typeof candidate?.addEventListener === 'function' ? candidate : undefined;
};

export function syncedSignal<T>(
	source: Signal<T>,
	options: SyncedSignalOptions<T>
): SyncedSignal<T> {
	const {
		channel,
		resolve = lastWriteWins,
		now = () => Date.now(),
		reconcileOnWake = true,
	} = options;

	const origin = newOriginId();

	// Explicitly no-op where there is no channel — a server render, or a webview
	// without BroadcastChannel. Constructing the real transport there would not
	// throw, but being deliberate about it keeps the server path obvious rather
	// than incidental.
	const transport =
		options.transport ??
		(typeof globalThis.BroadcastChannel === 'function'
			? createBroadcastTransport(channel)
			: createNoopTransport());

	let disposed = false;
	// Set while applying a peer's value, so writing it back does not echo. Without
	// this, two tabs bounce a value between them forever.
	let applying = false;

	/**
	 * The highest timestamp this tab has seen, from anyone.
	 *
	 * Wall-clock time alone is not enough. `Date.now()` has millisecond
	 * resolution, so two writes can genuinely share a timestamp — and worse, a
	 * write made *after* adopting a peer's value can carry the same stamp as the
	 * value it replaces. Last-write-wins then resolves that tie by origin, the
	 * peer rejects the newer value, and the two tabs disagree permanently. That is
	 * split brain, and it is reachable with an ordinary clock.
	 *
	 * Stamping each write as `max(wallClock, highestSeen + 1)` makes a causally
	 * later write strictly greater, so the tie-break is only ever reached by
	 * writes that are truly concurrent — where either answer is defensible and all
	 * that matters is that every tab picks the same one.
	 */
	let highestSeenAt = now();

	const nextStamp = (): number => {
		highestSeenAt = Math.max(now(), highestSeenAt + 1);
		return highestSeenAt;
	};

	let local: VersionedValue<T> = {
		value: untrack(() => source.value),
		at: now(),
		origin,
	};

	const versionSignal = signal(local);

	const broadcast = (entry: VersionedValue<T>): void => {
		transport.post({
			type: UPDATE,
			channel,
			value: entry.value,
			at: entry.at,
			origin: entry.origin,
		} as SyncMessage);
	};

	const adopt = (entry: VersionedValue<T>): void => {
		// Advancing on adoption is what makes the next local write causally later
		// than the value it builds on.
		highestSeenAt = Math.max(highestSeenAt, entry.at);
		local = entry;
		versionSignal.value = entry;

		applying = true;
		try {
			source.value = entry.value;
		} finally {
			applying = false;
		}
	};

	const readIncoming = (message: SyncMessage): VersionedValue<T> | undefined => {
		if (message['channel'] !== channel) return undefined;
		if (typeof message['origin'] !== 'string') return undefined;
		if (typeof message['at'] !== 'number' || !Number.isFinite(message['at'])) {
			return undefined;
		}

		return {
			value: message['value'] as T,
			at: message['at'],
			origin: message['origin'],
		};
	};

	const unsubscribe = transport.subscribe((message) => {
		if (disposed) return;

		const type = message['type'];

		if (type === REQUEST) {
			if (message['channel'] !== channel) return;
			// A waking tab asked what the current value is. Answering unconditionally
			// is right: it resolves against every reply it gets, so more answers make
			// its outcome more correct, not less.
			broadcast(local);
			return;
		}

		if (type !== UPDATE) return;

		const incoming = readIncoming(message);
		if (incoming === undefined) return;
		if (incoming.origin === origin) return;

		highestSeenAt = Math.max(highestSeenAt, incoming.at);

		const winner = resolve(local, incoming);

		// Only applied when the peer actually won. Adopting our own value would
		// still fire subscribers, and a sign-out handler running because a peer
		// echoed our state back is a real bug, not a harmless extra notification.
		if (winner.origin === local.origin && winner.at === local.at) return;

		adopt(winner);
	});

	// Local writes are broadcast. Reading through the effect means any write —
	// from anywhere in the application, not only through this wrapper — is shared,
	// which is what makes this composable with code that has never heard of it.
	const stop = watchEffect(() => {
		const current = source.value;

		if (applying || disposed) return;

		untrack(() => {
			if (Object.is(current, local.value)) return;

			local = { value: current, at: nextStamp(), origin };
			versionSignal.value = local;
			broadcast(local);
		});
	});

	const requestPeerState = (): void => {
		if (disposed) return;
		transport.post({ type: REQUEST, channel } as SyncMessage);
	};

	const doc = reconcileOnWake ? getDocument() : undefined;

	const onVisibility = (): void => {
		if (doc?.visibilityState === 'visible') requestPeerState();
	};

	// Guarded rather than assumed: there is no `document` during a server render,
	// and attaching a listener to one that is not there would throw on import in
	// shared code.
	doc?.addEventListener('visibilitychange', onVisibility);

	return {
		signal: source,
		origin,

		reconcile: requestPeerState,

		dispose: () => {
			if (disposed) return;
			disposed = true;

			stop.stop();
			unsubscribe();
			doc?.removeEventListener('visibilitychange', onVisibility);
			transport.close();
		},
	};
}

/**
 * Runs work in exactly one tab, moving it if that tab goes away.
 *
 * The companion to {@link syncedSignal}: one holds a value everywhere, this
 * holds a job somewhere. The returned disposer stops participating; the
 * `onElected` cleanup runs whenever leadership is lost, including on disposal.
 */
export interface LeaderTaskHandle {
	readonly isLeader: () => boolean;
	dispose(): void;
}

export const whenLeader = (
	onElected: () => void | (() => void),
	options: {
		readonly name: string;
		readonly transport?: SyncTransport;
		readonly heartbeatMs?: number;
		readonly timeoutMs?: number;
		readonly now?: () => number;
		readonly schedule?: (fn: () => void, ms: number) => () => void;
		readonly preferHeartbeat?: boolean;
	}
): LeaderTaskHandle => {
	const transport =
		options.transport ??
		(typeof globalThis.BroadcastChannel === 'function'
			? createBroadcastTransport(`effuse.leader.${options.name}`)
			: createNoopTransport());

	let cleanup: (() => void) | undefined;

	const election = createLeaderElection({
		name: options.name,
		transport,
		...(options.heartbeatMs === undefined ? {} : { heartbeatMs: options.heartbeatMs }),
		...(options.timeoutMs === undefined ? {} : { timeoutMs: options.timeoutMs }),
		...(options.now === undefined ? {} : { now: options.now }),
		...(options.schedule === undefined ? {} : { schedule: options.schedule }),
		...(options.preferHeartbeat === undefined
			? {}
			: { preferHeartbeat: options.preferHeartbeat }),
	});

	const unsubscribe = election.subscribe((isLeader) => {
		if (isLeader) {
			if (cleanup !== undefined) return;
			const result = onElected();
			cleanup = typeof result === 'function' ? result : undefined;
			return;
		}

		// Cleanup runs on losing leadership, not only on disposal. A tab that is
		// demoted must release the socket it opened, or the successor's connection
		// is the second one rather than the only one.
		cleanup?.();
		cleanup = undefined;
	});

	return {
		isLeader: () => election.isLeader,
		dispose: () => {
			unsubscribe();
			cleanup?.();
			cleanup = undefined;
			election.dispose();
			transport.close();
		},
	};
};
