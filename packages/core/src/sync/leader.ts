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
 * Leader election across tabs.
 *
 * The problem it solves is mundane and universal: exactly one tab should hold
 * the websocket, run the poll, or drive the background sync. Without election
 * every open tab does it, and the cost multiplies by however many tabs the user
 * has left open — which for a long-lived application is more than anyone
 * expects.
 *
 * No mainstream framework ships this. The libraries that do — `tab-election`,
 * `broadcast-channel`, RxDB's implementation — exist precisely because
 * hand-rolled versions routinely miss the same three things:
 *
 * - **No fallback when Web Locks is unavailable**, so election silently never
 *   happens and every tab believes it lost.
 * - **No handover when the leader *crashes*** rather than closing cleanly. A
 *   `beforeunload` handler does not run when a tab is killed.
 * - **Split brain during handover**, where two tabs both believe they won.
 *
 * Two strategies are implemented. Web Locks is used where available because the
 * browser releases the lock when the tab dies, however it dies — that single
 * property is what makes crash handover correct rather than best-effort. Where
 * it is absent, a heartbeat protocol approximates it: the leader announces
 * itself on an interval, and a silent leader is presumed dead.
 */

import type { SyncMessage, SyncTransport } from './transport.js';

export interface LeaderElection {
	/** True while this participant holds leadership. */
	readonly isLeader: boolean;
	/** Identifier of this participant. */
	readonly id: string;
	/** Notified whenever leadership is gained or lost. */
	subscribe(handler: (isLeader: boolean) => void): () => void;
	/** Stands down and stops participating. Idempotent. */
	dispose(): void;
}

export interface LeaderElectionOptions {
	/** Name of the contested resource. One election per name. */
	readonly name: string;
	readonly transport: SyncTransport;
	/** How often the leader announces itself. Defaults to 1000ms. */
	readonly heartbeatMs?: number;
	/**
	 * Silence after which the leader is presumed dead. Defaults to 3x heartbeat.
	 *
	 * The multiple matters: at 1x a single delayed heartbeat — a backgrounded tab,
	 * a busy main thread — triggers a spurious election and two tabs briefly both
	 * act as leader.
	 */
	readonly timeoutMs?: number;
	/** Injected for tests. Defaults to `Date.now`. */
	readonly now?: () => number;
	/** Injected for tests. Defaults to `setTimeout`. */
	readonly schedule?: (fn: () => void, ms: number) => () => void;
	/** Force the heartbeat strategy even where Web Locks exists. For tests. */
	readonly preferHeartbeat?: boolean;
}

interface WebLockManager {
	request(
		name: string,
		options: { signal?: AbortSignal },
		callback: () => Promise<void>
	): Promise<void>;
}

const getWebLocks = (): WebLockManager | undefined => {
	const navigatorLike = (
		globalThis as { navigator?: { locks?: WebLockManager } }
	).navigator;

	const locks = navigatorLike?.locks;
	return typeof locks?.request === 'function' ? locks : undefined;
};

const newParticipantId = (): string => {
	const webCrypto = (globalThis as { crypto?: { randomUUID?: () => string } })
		.crypto;

	if (typeof webCrypto?.randomUUID === 'function') return webCrypto.randomUUID();
	return `${String(Date.now())}-${Math.random().toString(36).slice(2)}`;
};

const HEARTBEAT = 'effuse.leader.heartbeat';
const CLAIM = 'effuse.leader.claim';
const RESIGN = 'effuse.leader.resign';

const defaultSchedule = (fn: () => void, ms: number): (() => void) => {
	const timer = setTimeout(fn, ms);
	// `unref` where available, so an election heartbeat cannot hold a Node
	// process open past its work.
	(timer as unknown as { unref?: () => void }).unref?.();
	return () => {
		clearTimeout(timer);
	};
};

export const createLeaderElection = (
	options: LeaderElectionOptions
): LeaderElection => {
	const {
		name,
		transport,
		heartbeatMs = 1000,
		timeoutMs = heartbeatMs * 3,
		now = () => Date.now(),
		schedule = defaultSchedule,
		preferHeartbeat = false,
	} = options;

	const id = newParticipantId();
	const handlers = new Set<(isLeader: boolean) => void>();

	let leader = false;
	let disposed = false;
	let cancelTimer: (() => void) | undefined;
	let lockAbort: AbortController | undefined;
	let lastSeenLeaderAt = 0;
	let knownLeaderId: string | undefined;

	const notify = (): void => {
		for (const handler of [...handlers]) {
			try {
				handler(leader);
			} catch {
				// A subscriber that throws must not prevent its peers from learning
				// they are now the leader — that would leave the resource unowned.
			}
		}
	};

	const setLeader = (next: boolean): void => {
		if (leader === next || disposed) return;
		leader = next;
		notify();
	};

	// A transport that goes nowhere means this participant is alone. Electing
	// immediately is correct and avoids waiting out a timeout for peers that
	// cannot reply. This is the server-render and no-BroadcastChannel case.
	if (!transport.connected) {
		leader = true;

		return {
			get isLeader() {
				return leader;
			},
			id,
			subscribe: (handler) => {
				handlers.add(handler);
				// Called immediately so a subscriber never misses the transition it
				// was created to observe.
				handler(leader);
				return () => {
					handlers.delete(handler);
				};
			},
			dispose: () => {
				if (disposed) return;
				disposed = true;
				leader = false;
				handlers.clear();
			},
		};
	}

	const post = (type: string): void => {
		transport.post({ type, name, id } satisfies SyncMessage);
	};

	/**
	 * Web Locks strategy.
	 *
	 * The lock is held by a promise that never resolves, so the browser releases
	 * it when the tab goes away — cleanly closed, crashed, or killed by the OS.
	 * That is the property a heartbeat can only approximate, and it is why this
	 * path is preferred wherever it exists.
	 */
	const startWebLocks = (locks: WebLockManager): void => {
		lockAbort = new AbortController();

		void locks
			.request(`effuse.leader.${name}`, { signal: lockAbort.signal }, async () => {
				if (disposed) return;
				setLeader(true);

				// Held until disposal aborts the request.
				await new Promise<void>((resolve) => {
					lockAbort?.signal.addEventListener('abort', () => {
						resolve();
					}, { once: true });
				});
			})
			.catch(() => {
				// Aborted on disposal, or the lock was never granted. Neither is an
				// error worth surfacing — losing an election is the normal outcome
				// for every tab but one.
			});
	};

	/**
	 * Heartbeat strategy.
	 *
	 * The leader announces on an interval; peers presume it dead after silence.
	 * Ties are broken by the lexically smallest id, which is deterministic and
	 * requires no extra round trip — important because a round trip during
	 * election is exactly when split brain occurs.
	 */
	const tick = (): void => {
		if (disposed) return;

		if (leader) {
			post(HEARTBEAT);
			cancelTimer = schedule(tick, heartbeatMs);
			return;
		}

		const silentFor = now() - lastSeenLeaderAt;

		if (silentFor >= timeoutMs) {
			// Claim, then wait one heartbeat before assuming the claim stood. A
			// competing claim from a smaller id arrives in that window and defers us.
			knownLeaderId = id;
			post(CLAIM);

			cancelTimer = schedule(() => {
				if (disposed) return;
				if (knownLeaderId === id) {
					setLeader(true);
					post(HEARTBEAT);
					lastSeenLeaderAt = now();
				}
				cancelTimer = schedule(tick, heartbeatMs);
			}, heartbeatMs);
			return;
		}

		cancelTimer = schedule(tick, heartbeatMs);
	};

	const onMessage = (message: SyncMessage): void => {
		if (disposed) return;
		if (message['name'] !== name) return;

		const type = message['type'];
		const senderId = message['id'];
		if (typeof type !== 'string' || typeof senderId !== 'string') return;

		if (type === HEARTBEAT) {
			lastSeenLeaderAt = now();
			knownLeaderId = senderId;

			// Two leaders can coexist for a moment after a partition heals. The
			// smaller id keeps it; the other stands down immediately rather than
			// waiting for a timeout, because two tabs holding one socket is the
			// failure this whole module exists to prevent.
			if (leader && senderId < id) {
				setLeader(false);
			}
			return;
		}

		if (type === CLAIM) {
			if (leader) {
				// Assert incumbency. A claimant that hears this defers.
				post(HEARTBEAT);
				return;
			}

			// Lowest id wins, deterministically and without another round trip.
			if (knownLeaderId === undefined || senderId < knownLeaderId) {
				knownLeaderId = senderId;
			}
			return;
		}

		if (type === RESIGN && senderId === knownLeaderId) {
			// The leader left cleanly. Treat it as immediately silent so the next
			// election starts now rather than after the full timeout.
			lastSeenLeaderAt = 0;
			knownLeaderId = undefined;
		}
	};

	const unsubscribe = transport.subscribe(onMessage);

	const locks = preferHeartbeat ? undefined : getWebLocks();

	if (locks !== undefined) {
		startWebLocks(locks);
	} else {
		// Start one heartbeat interval in, so a tab opening alongside an existing
		// leader hears a heartbeat before deciding the position is vacant.
		cancelTimer = schedule(tick, heartbeatMs);
	}

	return {
		get isLeader() {
			return leader;
		},
		id,

		subscribe: (handler) => {
			handlers.add(handler);
			handler(leader);
			return () => {
				handlers.delete(handler);
			};
		},

		dispose: () => {
			if (disposed) return;
			disposed = true;

			// Announced before tearing down, so peers start their election now
			// instead of waiting out the silence timeout.
			if (leader) post(RESIGN);

			leader = false;
			cancelTimer?.();
			cancelTimer = undefined;
			lockAbort?.abort();
			lockAbort = undefined;
			unsubscribe();
			handlers.clear();
		},
	};
};
